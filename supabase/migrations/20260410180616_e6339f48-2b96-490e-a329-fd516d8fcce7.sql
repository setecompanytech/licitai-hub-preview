
-- Trigger: when a contrato_pedido is created, auto-create a fin_contas_pagar entry
CREATE OR REPLACE FUNCTION public.fn_sync_pedido_to_cp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
  v_contrato_numero TEXT;
  v_fornecedor TEXT;
BEGIN
  -- Only trigger on insert with relevant status
  IF NEW.status NOT IN ('pendente', 'aprovado', 'em_separacao') THEN
    RETURN NEW;
  END IF;

  -- Get empresa_id and contrato info
  SELECT c.empresa_id, c.numero_contrato, c.orgao
  INTO v_empresa_id, v_contrato_numero, v_fornecedor
  FROM public.contratos c
  WHERE c.id = NEW.contrato_id;

  IF v_empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if already synced
  IF EXISTS (
    SELECT 1 FROM public.fin_contas_pagar
    WHERE pedido_ref = NEW.id::text AND empresa_id = v_empresa_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Create CP entry
  INSERT INTO public.fin_contas_pagar (
    empresa_id,
    favorecido_nome,
    numero_documento,
    descricao,
    valor_documento,
    data_emissao,
    data_vencimento,
    status,
    origem,
    pedido_ref
  ) VALUES (
    v_empresa_id,
    COALESCE(v_fornecedor, 'Fornecedor'),
    COALESCE(v_contrato_numero, '') || '/PED-' || COALESCE(NEW.numero_pedido, NEW.id::text),
    'Pedido #' || COALESCE(NEW.numero_pedido, '') || ' - Contrato ' || COALESCE(v_contrato_numero, ''),
    COALESCE(NEW.valor_total, 0),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'aberto',
    'pedido_contrato',
    NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_sync_pedido_to_cp: % - pedido: %', SQLERRM, NEW.id;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_sync_pedido_to_cp ON public.contrato_pedidos;
CREATE TRIGGER trg_sync_pedido_to_cp
  AFTER INSERT ON public.contrato_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_pedido_to_cp();

-- Add pedido_ref and origem columns to fin_contas_pagar if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fin_contas_pagar' AND column_name = 'pedido_ref') THEN
    ALTER TABLE public.fin_contas_pagar ADD COLUMN pedido_ref text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fin_contas_pagar' AND column_name = 'origem') THEN
    ALTER TABLE public.fin_contas_pagar ADD COLUMN origem text DEFAULT 'manual';
  END IF;
END $$;
