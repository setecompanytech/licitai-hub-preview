-- 1) Custo unitário separado do valor de venda
ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_total NUMERIC GENERATED ALWAYS AS (custo_unitario * quantidade_contratada) STORED;

ALTER TABLE public.contrato_itens
  ADD COLUMN IF NOT EXISTS estrutura TEXT;

-- 2) Detecção da estrutura na ATA
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_estrutura_detectado_ia TEXT,
  ADD COLUMN IF NOT EXISTS tipo_estrutura_confianca NUMERIC;

-- 3) Garante pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 4) RPC de match item-extraído ↔ item-da-ATA
CREATE OR REPLACE FUNCTION public.match_itens_ata(
  p_ata_id UUID,
  p_itens JSONB
) RETURNS TABLE (
  indice INT,
  ata_item_id UUID,
  ata_codigo TEXT,
  ata_descricao TEXT,
  ata_saldo_qtd NUMERIC,
  ata_valor_unitario NUMERIC,
  similaridade REAL,
  motivo TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_item JSONB;
  v_idx INT := 0;
  v_codigo TEXT;
  v_descricao TEXT;
  v_match RECORD;
BEGIN
  FOR v_item IN SELECT jsonb_array_elements(p_itens) LOOP
    v_codigo := NULLIF(trim(v_item->>'codigo_item'), '');
    v_descricao := NULLIF(trim(v_item->>'descricao'), '');
    v_match := NULL;

    IF v_codigo IS NOT NULL THEN
      SELECT ci.id AS m_id, ci.codigo_item AS m_cod, ci.descricao AS m_desc,
             GREATEST(ci.quantidade_contratada - COALESCE(ci.quantidade_ata_consumida,0), 0) AS m_saldo,
             ci.valor_unitario AS m_vu, 1.0::REAL AS m_sim, 'codigo_exato'::TEXT AS m_mot
      INTO v_match
      FROM public.contrato_itens ci
      WHERE ci.contrato_id = p_ata_id
        AND lower(trim(ci.codigo_item)) = lower(v_codigo)
      LIMIT 1;
    END IF;

    IF v_match IS NULL AND v_descricao IS NOT NULL THEN
      SELECT ci.id AS m_id, ci.codigo_item AS m_cod, ci.descricao AS m_desc,
             GREATEST(ci.quantidade_contratada - COALESCE(ci.quantidade_ata_consumida,0), 0) AS m_saldo,
             ci.valor_unitario AS m_vu,
             extensions.similarity(lower(ci.descricao), lower(v_descricao))::REAL AS m_sim,
             'descricao_similar'::TEXT AS m_mot
      INTO v_match
      FROM public.contrato_itens ci
      WHERE ci.contrato_id = p_ata_id
        AND extensions.similarity(lower(ci.descricao), lower(v_descricao)) >= 0.4
      ORDER BY extensions.similarity(lower(ci.descricao), lower(v_descricao)) DESC
      LIMIT 1;
    END IF;

    indice := v_idx;
    IF v_match IS NOT NULL THEN
      ata_item_id := v_match.m_id;
      ata_codigo := v_match.m_cod;
      ata_descricao := v_match.m_desc;
      ata_saldo_qtd := v_match.m_saldo;
      ata_valor_unitario := v_match.m_vu;
      similaridade := v_match.m_sim;
      motivo := v_match.m_mot;
    ELSE
      ata_item_id := NULL; ata_codigo := NULL; ata_descricao := NULL;
      ata_saldo_qtd := NULL; ata_valor_unitario := NULL; similaridade := 0.0;
      motivo := 'sem_correspondencia';
    END IF;
    RETURN NEXT;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

-- 5) Trigger: saldo financeiro do item da ATA
CREATE OR REPLACE FUNCTION public.recalc_saldo_financeiro_ata_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_item_id UUID;
  v_total_valor NUMERIC;
BEGIN
  v_ata_item_id := COALESCE(NEW.ata_item_id, OLD.ata_item_id);
  IF v_ata_item_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(ci.valor_total), 0)
  INTO v_total_valor
  FROM public.contrato_itens ci
  JOIN public.contratos c ON c.id = ci.contrato_id
  WHERE ci.ata_item_id = v_ata_item_id
    AND c.tipo_documento = 'contrato'
    AND COALESCE(c.status,'vigente') NOT IN ('cancelado','rescindido');

  UPDATE public.contrato_itens
  SET saldo_financeiro = GREATEST(valor_total - v_total_valor, 0),
      updated_at = now()
  WHERE id = v_ata_item_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_saldo_financeiro_ata_item ON public.contrato_itens;
CREATE TRIGGER trg_recalc_saldo_financeiro_ata_item
AFTER INSERT OR UPDATE OF valor_total, ata_item_id, contrato_id OR DELETE
ON public.contrato_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_saldo_financeiro_ata_item();

-- 6) Trigger: valor_consumido do contrato-pai (ATA)
CREATE OR REPLACE FUNCTION public.recalc_consumo_ata_pai()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ata_id UUID;
  v_total_consumido NUMERIC;
BEGIN
  v_ata_id := COALESCE(NEW.ata_srp_id, OLD.ata_srp_id);
  IF v_ata_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(c.valor_global), 0)
  INTO v_total_consumido
  FROM public.contratos c
  WHERE c.ata_srp_id = v_ata_id
    AND c.tipo_documento = 'contrato'
    AND COALESCE(c.status, 'vigente') NOT IN ('cancelado','rescindido');

  UPDATE public.contratos
  SET valor_consumido = v_total_consumido,
      updated_at = now()
  WHERE id = v_ata_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Trigger separado para INSERT/UPDATE (que pode usar NEW) e outro para DELETE (que usa OLD)
DROP TRIGGER IF EXISTS trg_recalc_consumo_ata_pai_iu ON public.contratos;
CREATE TRIGGER trg_recalc_consumo_ata_pai_iu
AFTER INSERT OR UPDATE OF valor_global, status, ata_srp_id
ON public.contratos
FOR EACH ROW
WHEN (NEW.ata_srp_id IS NOT NULL)
EXECUTE FUNCTION public.recalc_consumo_ata_pai();

DROP TRIGGER IF EXISTS trg_recalc_consumo_ata_pai_d ON public.contratos;
CREATE TRIGGER trg_recalc_consumo_ata_pai_d
AFTER DELETE
ON public.contratos
FOR EACH ROW
WHEN (OLD.ata_srp_id IS NOT NULL)
EXECUTE FUNCTION public.recalc_consumo_ata_pai();