-- ═══════════════════════════════════════════════════════════════════════════
-- 20260909000001 · Prorrogação contínua (arts. 106/107) fora do teto do 125
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O 2º T.A. do 068/2025 renova o quantitativo do período (fornecimento
-- contínuo prorrogado) — isso NÃO é acréscimo unilateral do art. 125, e o
-- alerta de 25% dispararia indevidamente contra um +100% legítimo. O tipo
-- novo 'prorrogacao_continua' entra na lista de isentos do gatilho.

CREATE OR REPLACE FUNCTION public.alerta_limite_aditivo_25pct()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_valor_original NUMERIC;
  v_total_acrescimo NUMERIC;
  v_total_qtd_acrescimo NUMERIC;
  v_qtd_total_contrato NUMERIC;
  v_pct_valor NUMERIC;
  v_pct_qtd NUMERIC;
  v_objeto TEXT;
  v_limite NUMERIC := 25.0;
  v_tipo_norm TEXT;
  v_avalia_valor BOOLEAN := false;
  v_avalia_qtd BOOLEAN := false;

  -- Escrito UMA vez. Antes a mesma regra vivia em três condições que
  -- precisavam concordar entre si, e não concordavam.
  --   reequilibrio, revisao  → art. 124, II, "d": recompõem, não ampliam
  --   repactuacao, reajuste  → art. 136, I: apostila, não aditivo
  --   adesao, remanejamento  → instrumentos da ata, teto próprio
  --   prorrogacao (contínua) → arts. 106/107: renova o período, não amplia
  --                            o objeto — fora do teto do art. 125 (09/09)
  c_isentos CONSTANT TEXT :=
    '(reequilibr|revisao|repactua|reajust|adesao|remanejam|prorrogac)';
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto
  INTO v_user_id, v_valor_original, v_objeto
  FROM public.contratos c WHERE c.id = NEW.contrato_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Reforma/obra/engenharia: limite ampliado para 50% (art. 125, §1º)
  IF lower(COALESCE(v_objeto,'')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  v_tipo_norm := translate(
    lower(COALESCE(NEW.tipo, '')),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
  );

  -- Isento é isento: sai antes de qualquer outra decisão, e o reforço abaixo
  -- não tem como reacendê-lo.
  IF v_tipo_norm ~ c_isentos THEN
    RETURN NEW;
  END IF;

  -- Tipos quantitativos, sujeitos ao art. 125.
  IF v_tipo_norm ~ '(valor|quantitativ|quantidade|acrescim|supressa|misto)' THEN
    v_avalia_valor := true;
    v_avalia_qtd := true;
  END IF;

  -- Reforço para tipo genérico que traz acréscimo real ("outros" com valor).
  -- Continua valendo, mas já não alcança os isentos.
  IF NOT v_avalia_valor AND COALESCE(NEW.valor_acrescimo,0) > 0 THEN
    v_avalia_valor := true;
  END IF;
  IF NOT v_avalia_qtd AND COALESCE(NEW.quantidade_acrescimo,0) > 0 THEN
    v_avalia_qtd := true;
  END IF;

  -- Nada a avaliar (ex.: aditivo de prazo puro, art. 107).
  IF NOT v_avalia_valor AND NOT v_avalia_qtd THEN
    RETURN NEW;
  END IF;

  -- O acumulado também ignora os isentos. Era este o defeito grande: mesmo
  -- avaliando um aditivo legítimo, a soma trazia junto todo o reajuste do
  -- contrato e o percentual saía inflado.
  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos
  WHERE contrato_id = NEW.contrato_id
    AND translate(
          lower(COALESCE(tipo,'')),
          'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
        ) !~ c_isentos;

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = NEW.contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  IF v_avalia_valor AND v_total_acrescimo > 0 AND v_pct_valor >= v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21, art. 125: ' || v_limite::TEXT || '%',
      'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || v_pct_valor::TEXT || '% (R$ ' || v_total_acrescimo::TEXT || ' sobre R$ ' || COALESCE(v_valor_original,0)::TEXT || '). '
        || 'Não entram nesta conta reajuste, repactuação, reequilíbrio, revisão, adesão e remanejamento.',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  IF v_avalia_qtd AND v_total_qtd_acrescimo > 0 AND v_pct_qtd >= 25.0 THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_quantidade',
      'Limite legal Lei 14.133/21, art. 125: 25%',
      'ATENÇÃO: acréscimos acumulados em QUANTIDADE atingiram ' || v_pct_qtd::TEXT || '% (' || v_total_qtd_acrescimo::TEXT || ' sobre ' || v_qtd_total_contrato::TEXT || ')',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'alerta_limite_aditivo_25pct: %', SQLERRM;
  RETURN NEW;
END; $function$
;
