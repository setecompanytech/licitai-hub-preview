
-- 1) Tipo de documento na tabela contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'contrato'
    CHECK (tipo_documento IN ('contrato','ata_srp')),
  ADD COLUMN IF NOT EXISTS ata_srp_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_ata TEXT,
  ADD COLUMN IF NOT EXISTS validade_ata_meses INTEGER,
  ADD COLUMN IF NOT EXISTS permite_carona BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_contratos_tipo_documento ON public.contratos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_contratos_ata_srp_id ON public.contratos(ata_srp_id) WHERE ata_srp_id IS NOT NULL;

-- 2) Aditivos polimórficos
ALTER TABLE public.contrato_aditivos
  ADD COLUMN IF NOT EXISTS referencia_tipo TEXT NOT NULL DEFAULT 'contrato'
    CHECK (referencia_tipo IN ('contrato','ata_srp'));

CREATE INDEX IF NOT EXISTS idx_aditivos_referencia_tipo ON public.contrato_aditivos(referencia_tipo);

COMMENT ON COLUMN public.contrato_aditivos.referencia_tipo IS
  'Indica se o aditivo refere-se a um Contrato Administrativo ou a uma ATA SRP. O contrato_id sempre aponta para contratos.id.';

-- 3) Vincular item de contrato a item de ATA SRP
ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS ata_item_id UUID REFERENCES public.contrato_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantidade_ata_consumida NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contrato_itens_ata_item ON public.contrato_itens(ata_item_id) WHERE ata_item_id IS NOT NULL;

-- 4) Trigger de recálculo de saldo da ATA
CREATE OR REPLACE FUNCTION public.recalc_saldo_ata_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ata_item_id UUID;
  v_total_consumido NUMERIC;
BEGIN
  v_ata_item_id := COALESCE(NEW.ata_item_id, OLD.ata_item_id);
  IF v_ata_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(ci.quantidade_contratada), 0)
  INTO v_total_consumido
  FROM public.contrato_itens ci
  JOIN public.contratos c ON c.id = ci.contrato_id
  WHERE ci.ata_item_id = v_ata_item_id
    AND c.tipo_documento = 'contrato'
    AND COALESCE(c.status, 'ativo') NOT IN ('cancelado','rescindido');

  UPDATE public.contrato_itens
  SET quantidade_ata_consumida = v_total_consumido,
      saldo_quantitativo = GREATEST(quantidade_contratada - v_total_consumido, 0),
      updated_at = now()
  WHERE id = v_ata_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_saldo_ata_item ON public.contrato_itens;
CREATE TRIGGER trg_recalc_saldo_ata_item
AFTER INSERT OR UPDATE OF quantidade_contratada, ata_item_id OR DELETE
ON public.contrato_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_saldo_ata_item();

-- 5) View consolidada
CREATE OR REPLACE VIEW public.atas_srp_resumo
WITH (security_invoker = true)
AS
SELECT
  a.id, a.user_id, a.empresa_id,
  a.numero_contrato, a.numero_ata,
  a.orgao_contratante, a.objeto,
  a.data_inicio, a.data_fim,
  a.valor_global, a.valor_global_original,
  a.permite_carona, a.validade_ata_meses, a.status,
  (SELECT COUNT(*) FROM public.contratos c
    WHERE c.ata_srp_id = a.id AND c.tipo_documento = 'contrato') AS qtd_contratos_derivados,
  (SELECT COALESCE(SUM(c.valor_global), 0) FROM public.contratos c
    WHERE c.ata_srp_id = a.id AND c.tipo_documento = 'contrato'
      AND COALESCE(c.status,'ativo') NOT IN ('cancelado','rescindido')) AS valor_consumido_total,
  (SELECT COUNT(*) FROM public.contrato_itens ci
    WHERE ci.contrato_id = a.id) AS qtd_itens
FROM public.contratos a
WHERE a.tipo_documento = 'ata_srp';

COMMENT ON VIEW public.atas_srp_resumo IS 'Visão consolidada das ATAs SRP com contadores de contratos derivados.';
