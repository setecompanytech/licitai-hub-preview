-- ═══════════════════════════════════════════════════════════════════════════
-- O limite do art. 125 conta só o que a lei manda contar
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O gatilho `alerta_limite_aditivo_25pct` grava alerta de auditoria quando os
-- acréscimos acumulados passam de 25% (50% em obra/serviço de engenharia).
-- Ele já sabia quais tipos ficam de fora — a 20260505192100 acertou isso — mas
-- dois pontos anulavam o acerto.
--
-- ── Defeito 1: o reforço reativava a avaliação ──────────────────────────────
--
--     IF NOT v_avalia_valor AND COALESCE(NEW.valor_acrescimo,0) > 0 THEN
--       v_avalia_valor := true;
--     END IF;
--
-- O reforço existe por bom motivo: cobrir quem escolheu tipo genérico e lançou
-- acréscimo real. Só que um REAJUSTE sempre traz `valor_acrescimo > 0` — é a
-- definição dele. Então o reforço reacendia a avaliação justamente no tipo que
-- a linha de cima tinha acabado de isentar.
--
-- ── Defeito 2, maior: a soma acumulava tudo ─────────────────────────────────
--
--     SELECT COALESCE(SUM(valor_acrescimo),0) ...
--       FROM public.contrato_aditivos WHERE contrato_id = NEW.contrato_id;
--
-- Sem filtro de tipo. Mesmo quando o gatilho avaliava um aditivo legítimo de
-- valor, o percentual acumulado somava junto reajuste, repactuação, adesão e
-- remanejamento. Num contrato com R$ 50.000 de reajuste e R$ 20.000 de
-- acréscimo real, o alerta acusava R$ 70.000 sobre o valor original.
--
-- ── Por que isso importa ────────────────────────────────────────────────────
--
-- Lei 14.133/2021, art. 136, I: reajuste e repactuação de preços PREVISTOS no
-- próprio contrato são registrados por simples apostila, dispensado o termo
-- aditivo. Apostila não é alteração do ajuste — é registro do que já estava
-- pactuado —, e por isso não consome o limite do art. 125.
--
-- Reequilíbrio (art. 124, II, "d") e revisão restabelecem a equação econômica
-- rompida por fato superveniente: recompõem o contrato, não o ampliam.
--
-- Adesão (Decreto 11.462/2023, art. 32, §4º) tem teto próprio, e remanejamento
-- redistribui entre participantes sem acrescer o total registrado.
--
-- ── E havia duas autoridades sobre o mesmo número ───────────────────────────
--
-- A tela de Aditivos já filtrava certo (`FORA_DO_ART_125` em
-- ContratoAditivos.tsx) e mostrava, digamos, "12% de 25%". O gatilho, olhando
-- os mesmos aditivos, gravava alerta dizendo "atingiram 70%". Os dois números
-- na mesma tela, discordando, sem nada explicando qual valia.
--
-- Este arquivo alinha o gatilho à régua da tela. A lista de isenção passa a
-- estar escrita uma vez, num lugar só do gatilho, em vez de espalhada por três
-- condições que precisavam concordar entre si.

CREATE OR REPLACE FUNCTION public.alerta_limite_aditivo_25pct()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
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
  c_isentos CONSTANT TEXT :=
    '(reequilibr|revisao|repactua|reajust|adesao|remanejam)';
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
END; $$;

COMMENT ON FUNCTION public.alerta_limite_aditivo_25pct() IS
  'Alerta quando os acréscimos acumulados atingem o limite do art. 125 da Lei '
  '14.133/2021 (25%, ou 50% em obra e serviço de engenharia). Ficam de fora, e '
  'também não entram no acumulado: reajuste e repactuação (art. 136, I — '
  'registrados por apostila), reequilíbrio e revisão (art. 124, II, "d" — '
  'recompõem a equação, não ampliam o objeto), adesão (teto próprio no Decreto '
  '11.462/2023, art. 32, §4º) e remanejamento (redistribui entre participantes '
  'sem acrescer o registrado). Mesma régua da tela de Aditivos.';

-- ── Limpeza dos alertas gerados pela regra antiga ───────────────────────────
-- Alerta legal que não devia existir é pior do que alerta nenhum: ensina a
-- ignorar o alarme, e o próximo — verdadeiro — passa despercebido.
--
-- Só apaga o que foi gerado PELO GATILHO (origem = 'alerta_limite_legal') e
-- cujo aditivo é de tipo isento. Auditoria feita por gente ou por IA fica.
DELETE FROM public.contrato_ia_auditoria a
USING public.contrato_aditivos ad
WHERE a.origem = 'alerta_limite_legal'
  AND a.contrato_id = ad.contrato_id
  AND a.arquivo_nome = 'Aditivo nº ' || COALESCE(ad.numero_aditivo,'?')
  AND translate(
        lower(COALESCE(ad.tipo,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'
      ) ~ '(reequilibr|revisao|repactua|reajust|adesao|remanejam)';

-- ── Conferência ─────────────────────────────────────────────────────────────
--
-- 1. Alertas de limite que sobraram, com o tipo do aditivo que os gerou.
--    Nenhum deve ser de tipo isento.
--
--    SELECT ad.tipo, count(*)
--      FROM public.contrato_ia_auditoria a
--      JOIN public.contrato_aditivos ad
--        ON ad.contrato_id = a.contrato_id
--       AND a.arquivo_nome = 'Aditivo nº ' || COALESCE(ad.numero_aditivo,'?')
--     WHERE a.origem = 'alerta_limite_legal'
--     GROUP BY 1 ORDER BY 2 DESC;
--
-- 2. O acumulado por contrato, como o gatilho passa a enxergar — e é o mesmo
--    número que a tela de Aditivos mostra:
--
--    SELECT c.numero_contrato, c.valor_global_original,
--           SUM(ad.valor_acrescimo) FILTER (
--             WHERE translate(lower(COALESCE(ad.tipo,'')),
--                   'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
--                   !~ '(reequilibr|revisao|repactua|reajust|adesao|remanejam)'
--           ) AS acrescimo_que_conta,
--           SUM(ad.valor_acrescimo) AS acrescimo_total
--      FROM public.contratos c
--      JOIN public.contrato_aditivos ad ON ad.contrato_id = c.id
--     GROUP BY 1,2
--    HAVING SUM(ad.valor_acrescimo) > 0
--     ORDER BY 4 DESC;
