-- ============================================================================
-- Saldo financeiro do item: aditivo de PREÇO não entra no rateio de valor
-- ============================================================================
--
-- Auditoria de custos do contrato 068/2025 (22/09/2026), decisão 14 do dono.
--
-- A fórmula única de 01/09 faz: valor do item + rateio de TODOS os aditivos
-- (valor) − consumo. Mas o aditivo de reequilíbrio (art. 124, II, "d"),
-- assim como reajuste, repactuação e revisão, muda o PREÇO — e o preço já é
-- regravado no item (`valor_unitario` 15,80 → 25,37; `valor_total` acompanha).
-- Somar o valor do aditivo em cima do item já reprecificado conta o
-- reequilíbrio duas vezes: no 068/2025, saldo de R$ 14.087.808 contra
-- R$ 10.229.184 reais (403.200 kg × R$ 25,37).
--
-- MEDIDO ANTES DE MEXER (regra da casa desde 01/09): consulta somente leitura
-- em 22/09 comparando, item a item, o saldo gravado com "saldo_quantitativo ×
-- preço atual" e com "sem os aditivos de preço". UM único item da base inteira
-- diverge (o do 068/2025), e as duas fórmulas dão o mesmo R$ 10.229.184. A
-- correção abaixo é a segunda: mantém a autoridade "contratada + rateio dos
-- aditivos − consumo real" e só tira do rateio de VALOR os aditivos que mudam
-- preço (tipos 'reequilibrio', 'revisao', 'repactuacao', 'reajuste' — os
-- mesmos de `lib/contratos/instrumentos.ts` e de `ContratoItens.tsx`).
-- Quantidade não muda: aditivo de preço não traz quilos.

CREATE OR REPLACE FUNCTION public.recalcular_saldos_itens_do_contrato(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_acresc_val NUMERIC;
  v_supr_val   NUMERIC;
  v_acresc_qtd NUMERIC;
  v_supr_qtd   NUMERIC;
  v_qtd_total  NUMERIC;
BEGIN
  -- Só os aditivos que trazem QUANTIDADE/VALOR novo rateiam valor. Os de
  -- preço já estão no `valor_unitario` do item.
  SELECT
    COALESCE(SUM(valor_acrescimo) FILTER (WHERE tipo NOT IN ('reequilibrio','revisao','repactuacao','reajuste')), 0),
    COALESCE(SUM(valor_supressao) FILTER (WHERE tipo NOT IN ('reequilibrio','revisao','repactuacao','reajuste')), 0),
    COALESCE(SUM(quantidade_acrescimo), 0),
    COALESCE(SUM(quantidade_supressao), 0)
  INTO v_acresc_val, v_supr_val, v_acresc_qtd, v_supr_qtd
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id;

  SELECT COALESCE(SUM(quantidade_contratada), 0)
  INTO v_qtd_total
  FROM public.contrato_itens
  WHERE contrato_id = p_contrato_id;

  IF v_qtd_total <= 0 THEN RETURN; END IF;

  UPDATE public.contrato_itens AS ci
  SET
    quantidade_consumida = COALESCE((
      SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
       WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
    ), 0),
    saldo_quantitativo =
      ci.quantidade_contratada
      + (v_acresc_qtd - v_supr_qtd) * (ci.quantidade_contratada / v_qtd_total)
      - COALESCE((
          SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
           WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
        ), 0),
    saldo_financeiro =
      COALESCE(NULLIF(ci.valor_total, 0), ci.quantidade_contratada * COALESCE(ci.valor_unitario, 0))
      + (v_acresc_val - v_supr_val) * (ci.quantidade_contratada / v_qtd_total)
      - COALESCE((
          SELECT SUM(p.valor_total) FROM public.contrato_pedidos p
           WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
        ), 0),
    updated_at = now()
  WHERE ci.contrato_id = p_contrato_id;
END;
$$;

COMMENT ON FUNCTION public.recalcular_saldos_itens_do_contrato(uuid) IS
  'A ÚNICA fórmula do saldo de item: contratada + rateio dos aditivos − consumo real dos pedidos, em quantidade e em valor. '
  'Aditivo de PREÇO (reequilíbrio, revisão, repactuação, reajuste) não entra no rateio de valor: o preço novo já está no item.';

-- Reprocessa todos os contratos com item — só o 068/2025 muda (medido em 22/09).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT contrato_id FROM public.contrato_itens LOOP
    PERFORM public.recalcular_saldos_itens_do_contrato(r.contrato_id);
  END LOOP;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT c.numero_contrato, i.saldo_quantitativo, i.saldo_financeiro, i.saldo_quantitativo * i.valor_unitario AS pelo_preco
--     FROM public.contrato_itens i JOIN public.contratos c ON c.id = i.contrato_id
--    WHERE abs(i.saldo_financeiro - i.saldo_quantitativo * i.valor_unitario) > 1;
-- Esperado: nenhuma linha (antes: só o 068/2025, com 14.087.808 × 10.229.184).
