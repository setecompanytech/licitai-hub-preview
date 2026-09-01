-- ═══════════════════════════════════════════════════════════════════════════
-- O saldo do item acompanha o aditivo — em quantidade E em valor
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O 149/2024 expôs em produção (01/09):
--
--   contrato   Global R$ 162.360,00  ✓ (o TA de +81.180 somou)
--   empenho    saldo R$ 40.690,20    ✓ (os pedidos baixam)
--   item       −597 QCG / −R$ 13.387,35   ✗✗
--
-- Dois defeitos no mesmo lugar:
--
--   1. A versão de `aplicar_aditivo_contrato` VIGENTE NO BANCO recalcula o
--      saldo quantitativo do item só na criação do aditivo — a EDIÇÃO
--      (0 → 3.600) atualizou o global e deixou o item para trás. As
--      migrations deste repo são coladas à mão, e a versão do repositório
--      (20260505205929, que cobre UPDATE) não confere com o comportamento
--      observado.
--
--   2. O saldo FINANCEIRO do item nunca recebeu acréscimo de aditivo, em
--      versão alguma: só a quantidade era rateada. O financeiro do item vivia
--      de decrementos incrementais sobre a base original — depois do TA, a
--      base mentia.
--
-- ── A cura é a mesma de sempre nesta casa: saldo DERIVADO, não incremental ──
--
-- O recálculo passa a reconstruir os dois saldos do item do zero a cada
-- mudança de aditivo:
--
--   saldo_qtd = contratada + rateio_qtd(aditivos) − consumo_qtd(pedidos)
--   saldo_fin = contratada×VU + rateio_val(aditivos) − consumo_fin(pedidos)
--
-- com o consumo somado de `contrato_pedidos` (status <> cancelado), e o
-- rateio proporcional à participação do item na quantidade original — o
-- mesmo critério do rateio de cotas. SEM piso em zero: déficit é informação
-- (os alertas da Extração dependem dele para avisar), e GREATEST(0, …)
-- esconderia exatamente o que precisa aparecer.

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
  v_total_qtd_acresc NUMERIC;
  v_total_qtd_supr  NUMERIC;
  v_ultima_data_fim DATE;
  v_data_inicio DATE;
  v_qtd_total_original NUMERIC;
BEGIN
  v_contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  SELECT
    COALESCE(SUM(valor_acrescimo), 0),
    COALESCE(SUM(valor_supressao), 0),
    COALESCE(SUM(quantidade_acrescimo), 0),
    COALESCE(SUM(quantidade_supressao), 0)
  INTO v_total_acrescimo, v_total_supressao, v_total_qtd_acresc, v_total_qtd_supr
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id;

  SELECT nova_data_fim INTO v_ultima_data_fim
  FROM public.contrato_aditivos
  WHERE contrato_id = v_contrato_id AND nova_data_fim IS NOT NULL
  ORDER BY nova_data_fim DESC LIMIT 1;

  SELECT data_inicio INTO v_data_inicio FROM public.contratos WHERE id = v_contrato_id;

  UPDATE public.contratos
  SET
    valor_global = COALESCE(valor_global_original, 0) + v_total_acrescimo - v_total_supressao,
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

  -- ── Os saldos do item, reconstruídos do zero ──────────────────────────────
  SELECT COALESCE(SUM(quantidade_contratada), 0)
  INTO v_qtd_total_original
  FROM public.contrato_itens
  WHERE contrato_id = v_contrato_id;

  IF v_qtd_total_original > 0 THEN
    UPDATE public.contrato_itens AS ci
    SET
      saldo_quantitativo =
        ci.quantidade_contratada
        + (v_total_qtd_acresc - v_total_qtd_supr) * (ci.quantidade_contratada / v_qtd_total_original)
        - COALESCE((
            SELECT SUM(p.quantidade) FROM public.contrato_pedidos p
             WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
          ), 0),
      saldo_financeiro =
        ci.quantidade_contratada * COALESCE(ci.valor_unitario, 0)
        + (v_total_acrescimo - v_total_supressao) * (ci.quantidade_contratada / v_qtd_total_original)
        - COALESCE((
            SELECT SUM(p.valor_total) FROM public.contrato_pedidos p
             WHERE p.contrato_item_id = ci.id AND p.status <> 'cancelado'
          ), 0),
      updated_at = now()
    WHERE ci.contrato_id = v_contrato_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.aplicar_aditivo_contrato() IS
  'Reaplica os aditivos ao contrato e aos itens a cada INSERT/UPDATE/DELETE '
  'em contrato_aditivos. Saldos do item DERIVADOS do zero (contratada + '
  'rateio dos aditivos − consumo real dos pedidos), em quantidade E em valor '
  '— a versão anterior só rateava quantidade, e só na criação. Sem piso em '
  'zero: déficit é informação que os alertas mostram.';

-- O gatilho garante os três eventos, qualquer que fosse o estado anterior.
DROP TRIGGER IF EXISTS trg_aplicar_aditivo ON public.contrato_aditivos;
CREATE TRIGGER trg_aplicar_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON public.contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_aditivo_contrato();

-- ── Reprocessa todo contrato que tem aditivo ────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT contrato_id FROM public.contrato_aditivos LOOP
    UPDATE public.contrato_aditivos SET updated_at = now()
      WHERE id = (SELECT id FROM public.contrato_aditivos
                   WHERE contrato_id = r.contrato_id LIMIT 1);
  END LOOP;
END $$;

-- ── Conferência (149/2024) ──────────────────────────────────────────────────
--
--   SELECT i.saldo_quantitativo, i.saldo_financeiro
--     FROM public.contrato_itens i
--     JOIN public.contratos c ON c.id = i.contrato_id
--    WHERE c.numero_contrato = '149/2024';
--
-- Esperado: saldo_quantitativo = 3.600 + 3.600 − 4.197 = 3.003
--           saldo_financeiro  = 81.180 + 81.180 − 94.567,35 = 67.792,65
-- (o financeiro do item passa a bater com o saldo do contrato — mesma conta,
--  mesmo resultado, como deve ser num contrato de item único.)
