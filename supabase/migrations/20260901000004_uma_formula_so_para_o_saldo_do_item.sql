-- ═══════════════════════════════════════════════════════════════════════════
-- Uma fórmula só para o saldo do item
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A 20260901000003 corrigiu o gatilho de ADITIVOS: item = contratada + rateio
-- dos aditivos − consumo. Conferido no 149/2024: 3.003 QCG / R$ 67.792,65 ✓.
--
-- Duas notas lançadas depois, o item estava em −1.097 / −24.662,35 — a base
-- SEM aditivos outra vez. O vetor: o gatilho de PEDIDOS
-- (`atualizar_saldo_item_contrato`, de 20260315) recalcula o saldo com a
-- fórmula antiga:
--
--     saldo_quantitativo = quantidade_contratada − consumo        ← sem aditivos
--     saldo_financeiro   = valor_total(item)     − consumo        ← sem aditivos
--
-- Cada lançamento de pedido DESFAZIA o que o gatilho de aditivos tinha
-- aplicado. Duas funções, duas fórmulas para o mesmo número — o princípio 1
-- do CLAUDE.md (vocabulário único) aplicado a saldos: cópias divergem sempre,
-- é só questão de qual roda por último.
--
-- A cura: UMA função dona da fórmula, chamada pelos dois gatilhos.

-- ── A autoridade ────────────────────────────────────────────────────────────
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
  SELECT
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0),
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

  -- Derivado do zero, nunca incremental: contratada + rateio dos aditivos −
  -- consumo real dos pedidos. Rateio proporcional à participação do item na
  -- quantidade original. Sem piso em zero — déficit é informação que os
  -- alertas mostram.
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
  'A ÚNICA fórmula do saldo de item: contratada + rateio dos aditivos − '
  'consumo real dos pedidos, em quantidade e em valor. Chamada pelos gatilhos '
  'de contrato_aditivos E de contrato_pedidos — duas fórmulas para o mesmo '
  'número divergem sempre, e foi assim que cada pedido lançado desfazia o '
  'rateio do aditivo.';

-- ── Gatilho de PEDIDOS: consumo do contrato aqui; itens, na autoridade ──────
CREATE OR REPLACE FUNCTION public.atualizar_saldo_item_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contrato_id UUID;
  v_total_val NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato_id);

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_val
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  UPDATE public.contratos
  SET valor_consumido = v_total_val,
      saldo_remanescente = valor_global - v_total_val,
      updated_at = now()
  WHERE id = v_contrato_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ── Gatilho de ADITIVOS: contrato aqui; itens, na mesma autoridade ──────────
CREATE OR REPLACE FUNCTION public.aplicar_aditivo_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_contrato_id UUID;
  v_total_acrescimo NUMERIC;
  v_total_supressao NUMERIC;
  v_ultima_data_fim DATE;
  v_data_inicio DATE;
  v_total_pedidos NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  SELECT data_inicio INTO v_data_inicio FROM public.contratos WHERE id = v_contrato_id;

  -- O saldo do contrato acompanha o global novo na hora — sem esperar o
  -- próximo pedido disparar o outro gatilho.
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pedidos
  FROM public.contrato_pedidos
  WHERE contrato_id = v_contrato_id AND status != 'cancelado';

  UPDATE public.contratos
  SET
    valor_global = COALESCE(valor_global_original, 0) + v_total_acrescimo - v_total_supressao,
    valor_consumido = v_total_pedidos,
    saldo_remanescente = (COALESCE(valor_global_original, 0) + v_total_acrescimo - v_total_supressao) - v_total_pedidos,
    data_fim = COALESCE(v_ultima_data_fim, data_fim),
    vigencia_meses = CASE
      WHEN COALESCE(v_ultima_data_fim, data_fim) IS NOT NULL AND v_data_inicio IS NOT NULL THEN
        GREATEST(1, ROUND(
          (EXTRACT(EPOCH FROM (COALESCE(v_ultima_data_fim, data_fim)::timestamp - v_data_inicio::timestamp)) / 86400) / 30
        )::int)
      ELSE vigencia_meses
    END,
    updated_at = now()
  WHERE id = v_contrato_id;

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato_id);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

-- ── Reprocessa todos os contratos que têm item ──────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT contrato_id FROM public.contrato_itens LOOP
    PERFORM public.recalcular_saldos_itens_do_contrato(r.contrato_id);
  END LOOP;
END $$;

-- ── Conferência (149/2024, com 8 pedidos = R$ 105.842,35 / 4.697 un) ────────
--
--   SELECT i.saldo_quantitativo, i.saldo_financeiro
--     FROM public.contrato_itens i
--     JOIN public.contratos c ON c.id = i.contrato_id
--    WHERE c.numero_contrato = '149/2024';
--
-- Esperado: 2.503 e 56.517,65 — o item batendo com o saldo do contrato. E o
-- teste que prova a cura de verdade: lançar o PRÓXIMO pedido e conferir que o
-- item desconta só o pedido, sem perder o aditivo.
