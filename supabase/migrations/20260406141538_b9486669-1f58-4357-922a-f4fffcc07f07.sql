
-- 1. Add cost fields to contrato_pedidos
ALTER TABLE public.contrato_pedidos
  ADD COLUMN IF NOT EXISTS custo_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_total numeric NOT NULL DEFAULT 0;

-- 2. Add permissoes column (JSONB) to empresa_membros for granular module access
ALTER TABLE public.empresa_membros
  ADD COLUMN IF NOT EXISTS permissoes jsonb DEFAULT '[]'::jsonb;

-- 3. Update the trigger to also compute custo_total on contrato_custos from pedidos
-- (custo_total = custo_unitario * quantidade, auto-calculated)
CREATE OR REPLACE FUNCTION public.calcular_custo_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.custo_unitario IS NOT NULL AND NEW.custo_unitario > 0 THEN
    NEW.custo_total := NEW.custo_unitario * NEW.quantidade;
  ELSE
    NEW.custo_total := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calcular_custo_pedido
  BEFORE INSERT OR UPDATE ON public.contrato_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_custo_pedido();

-- 4. Add custo_total_pedidos to contratos for aggregation
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS custo_total_pedidos numeric NOT NULL DEFAULT 0;

-- 5. Update the saldo trigger to also aggregate custo_total
CREATE OR REPLACE FUNCTION public.atualizar_saldo_item_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_id uuid;
  v_item_id uuid;
  v_total_qty numeric;
  v_total_val numeric;
  v_total_custo numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contrato_id := OLD.contrato_id;
    v_item_id := OLD.contrato_item_id;
  ELSE
    v_contrato_id := NEW.contrato_id;
    v_item_id := NEW.contrato_item_id;
  END IF;

  IF v_item_id IS NOT NULL THEN
    SELECT COALESCE(SUM(quantidade), 0), COALESCE(SUM(valor_total), 0)
    INTO v_total_qty, v_total_val
    FROM public.contrato_pedidos
    WHERE contrato_item_id = v_item_id AND status != 'cancelado';

    UPDATE public.contrato_itens
    SET quantidade_consumida = v_total_qty,
        saldo_quantitativo = quantidade_contratada - v_total_qty,
        saldo_financeiro = valor_total - v_total_val,
        updated_at = now()
    WHERE id = v_item_id;
  END IF;

  SELECT COALESCE(SUM(valor_total), 0), COALESCE(SUM(custo_total), 0)
  INTO v_total_val, v_total_custo
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  UPDATE public.contratos
  SET valor_consumido = v_total_val,
      custo_total_pedidos = v_total_custo,
      updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
