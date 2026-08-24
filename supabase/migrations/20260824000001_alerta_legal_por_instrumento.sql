-- =============================================================================
-- O alerta legal passa a olhar QUE INSTRUMENTO está sendo alterado
--
-- A ATA SRP 022/2024 recebeu "acréscimos acumulados em VALOR atingiram 120,43%
-- — Limite legal Lei 14.133/21, art. 125: 25%". A conta fecha (R$ 8.494.080 +
-- R$ 10.229.184 = o valor global de R$ 18.723.264), mas a lei citada é a de
-- outro instrumento: `recalcular_alertas_aditivos_contrato` lia `contratos`
-- pelo id e nunca olhava `tipo_documento`. Para ela, ata e contrato eram a
-- mesma coisa.
--
-- Não são. O art. 125 rege alteração de CONTRATO. A Ata de Registro de Preços
-- é compromisso para futura contratação (art. 6º, XLV), e nela valem outras
-- regras:
--
--   * Decreto 11.462/2023, art. 30 — é VEDADO acrescer os quantitativos
--     registrados na ata. Não há teto de 25% a estourar: não se acresce.
--   * Decreto 11.462/2023, art. 32, §§ 3º e 4º — adesão de órgão não
--     participante tem teto próprio: 50% por aderente, e o total das adesões
--     não pode exceder o DOBRO do quantitativo registrado.
--
-- Ou seja, o aviso estava errado de um dos dois jeitos, e o sistema não tinha
-- como saber qual: se os R$ 10,2 mi foram ADESÕES, não são acréscimo e o alerta
-- é falso; se foram acréscimo à ata, o aviso é brando demais — não é "passou
-- dos 25%", é conduta vedada.
--
-- O que falta para decidir não é regra, é DADO: `contrato_aditivos.tipo` não
-- tem como dizer "adesão". Esta migration dá esse vocabulário e faz a função
-- ramificar por instrumento.
--
-- MUDANÇA DE CLASSIFICAÇÃO É DECISÃO DE ALGUÉM: nenhum aditivo existente é
-- reclassificado aqui. Enquanto ninguém disser o que foram, a ata recebe um
-- aviso que declara a dúvida em vez de afirmar uma infração sob a lei errada.
-- =============================================================================

-- ── 1 · vocabulário: a ata passa a poder dizer "adesão" ──────────────────────
--
-- `tipo` é texto livre (nunca teve CHECK), então nada quebra. O COMMENT é o
-- registro de quais valores o sistema entende — é o que a UI espelha.
COMMENT ON COLUMN public.contrato_aditivos.tipo IS
  'O que o aditivo faz. Sujeitos ao teto do art. 125 (contrato): valor, '
  'quantidade, valor_quantidade, escopo, prazo. Fora do teto, por não '
  'acrescerem objeto: reequilibrio, revisao, repactuacao, reajuste. '
  'Exclusivos de ATA SRP: adesao (órgão não participante, Decreto 11.462/2023 '
  'art. 32) e remanejamento (redistribuição entre participantes, sem acrescer '
  'o total registrado). Espelho no front: TIPOS_ADITIVO em '
  'src/components/contratos/ContratoAditivos.tsx.';

-- ── 2 · o alerta ramifica por instrumento ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_alertas_aditivos_contrato(p_contrato_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_user_id UUID;
  v_valor_original NUMERIC;
  v_objeto TEXT;
  v_tipo_documento TEXT;
  v_total_acrescimo NUMERIC;
  v_total_qtd_acrescimo NUMERIC;
  v_qtd_total_contrato NUMERIC;
  v_pct_valor NUMERIC;
  v_pct_qtd NUMERIC;
  v_limite NUMERIC := 25.0;
  v_ultimo_aditivo TEXT;
  v_tem_quant BOOLEAN;
  v_total_adesao NUMERIC;
  v_pct_adesao NUMERIC;
  v_classificados BOOLEAN;
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto, COALESCE(c.tipo_documento, 'contrato')
  INTO v_user_id, v_valor_original, v_objeto, v_tipo_documento
  FROM public.contratos c WHERE c.id = p_contrato_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Recálculo é completo: limpa o que havia antes deste contrato.
  DELETE FROM public.contrato_ia_auditoria
  WHERE contrato_id = p_contrato_id AND origem = 'alerta_limite_legal';

  -- ═══ ATA DE REGISTRO DE PREÇOS ═════════════════════════════════════════════
  IF v_tipo_documento = 'ata_srp' THEN
    -- Adesão não é acréscimo: mede-se contra o dobro do registrado (art. 32, §4º).
    SELECT COALESCE(SUM(valor_acrescimo), 0)
    INTO v_total_adesao
    FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id AND tipo = 'adesao';

    -- Tudo que acresce e NÃO é adesão, remanejamento ou reequilíbrio: na ata,
    -- isso é o que o art. 30 veda.
    SELECT COALESCE(SUM(valor_acrescimo), 0)
    INTO v_total_acrescimo
    FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
      AND tipo NOT IN ('adesao', 'remanejamento', 'reequilibrio', 'revisao', 'repactuacao', 'reajuste');

    -- Já houve classificação nesta ata? Sem isso, o sistema não sabe o que
    -- aconteceu — e afirmar infração sob a lei errada é pior do que perguntar.
    SELECT EXISTS (
      SELECT 1 FROM public.contrato_aditivos
      WHERE contrato_id = p_contrato_id AND tipo IN ('adesao', 'remanejamento')
    ) INTO v_classificados;

    SELECT 'Aditivo nº ' || COALESCE(numero_aditivo, '?')
    INTO v_ultimo_aditivo
    FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
    ORDER BY created_at DESC LIMIT 1;

    IF NOT v_classificados AND (v_total_acrescimo > 0) AND COALESCE(v_valor_original, 0) > 0 THEN
      v_pct_valor := ROUND((v_total_acrescimo / v_valor_original) * 100, 2);
      INSERT INTO public.contrato_ia_auditoria
        (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
      VALUES (
        p_contrato_id, 'alerta_ata_classificar',
        'ATA SRP — Decreto 11.462/2023, arts. 30 e 32',
        'Esta ATA registra R$ ' || v_total_acrescimo::TEXT || ' de acréscimos (' ||
        v_pct_valor::TEXT || '% sobre R$ ' || v_valor_original::TEXT || '), mas nenhum ' ||
        'aditivo foi classificado. Na ARP, ACRÉSCIMO de quantitativo é vedado (art. 30), ' ||
        'enquanto ADESÃO de órgão não participante é permitida até o dobro do registrado ' ||
        '(art. 32, §4º). Classifique os aditivos como "adesao" ou "remanejamento" para o ' ||
        'sistema aplicar a regra certa.',
        'alerta_limite_legal', v_user_id, v_ultimo_aditivo
      );
    END IF;

    -- Classificado como acréscimo puro na ata: vedado, e o percentual não importa.
    IF v_classificados AND v_total_acrescimo > 0 THEN
      INSERT INTO public.contrato_ia_auditoria
        (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
      VALUES (
        p_contrato_id, 'alerta_ata_acrescimo_vedado',
        'Decreto 11.462/2023, art. 30: acréscimo vedado',
        'ATENÇÃO: R$ ' || v_total_acrescimo::TEXT || ' lançados como acréscimo à ATA. ' ||
        'É vedado acrescer os quantitativos registrados na ata de registro de preços. ' ||
        'Se foram adesões de órgãos não participantes, reclassifique como "adesao".',
        'alerta_limite_legal', v_user_id, v_ultimo_aditivo
      );
    END IF;

    -- Teto das adesões: o DOBRO do registrado, somadas todas (art. 32, §4º).
    IF v_total_adesao > 0 AND COALESCE(v_valor_original, 0) > 0 THEN
      v_pct_adesao := ROUND((v_total_adesao / v_valor_original) * 100, 2);
      IF v_pct_adesao > 100.0 THEN
        INSERT INTO public.contrato_ia_auditoria
          (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
        VALUES (
          p_contrato_id, 'alerta_ata_adesao',
          'Limite legal Decreto 11.462/2023, art. 32, §4º: 100% (o dobro do registrado)',
          'ATENÇÃO: adesões acumuladas atingiram ' || v_pct_adesao::TEXT ||
          '% do registrado (R$ ' || v_total_adesao::TEXT || ' sobre R$ ' ||
          v_valor_original::TEXT || '). O total das adesões não pode exceder o dobro ' ||
          'do quantitativo de cada item registrado.',
          'alerta_limite_legal', v_user_id, v_ultimo_aditivo
        );
      END IF;
    END IF;

    RETURN;
  END IF;

  -- ═══ CONTRATO ══════════════════════════════════════════════════════════════
  -- Daqui para baixo, o comportamento é o mesmo de antes.

  -- Limite especial para reformas/obras/engenharia (art. 125, §1º).
  IF lower(COALESCE(v_objeto, '')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
      AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste', 'adesao', 'remanejamento')
      AND (
        lower(translate(COALESCE(tipo,''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))
          ~ '(valor|quantitativ|quantidade|acrescim|supressa|misto)'
        OR COALESCE(valor_acrescimo,0) > 0
        OR COALESCE(quantidade_acrescimo,0) > 0
      )
  ) INTO v_tem_quant;

  IF NOT v_tem_quant THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste', 'adesao', 'remanejamento');

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = p_contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  SELECT 'Aditivo nº ' || COALESCE(numero_aditivo,'?')
  INTO v_ultimo_aditivo
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste', 'adesao', 'remanejamento')
  ORDER BY created_at DESC LIMIT 1;

  IF v_total_acrescimo > 0 AND v_pct_valor >= v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      p_contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21, art. 125: ' || v_limite::TEXT || '%',
      'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || v_pct_valor::TEXT || '% (R$ ' || v_total_acrescimo::TEXT || ' sobre R$ ' || COALESCE(v_valor_original,0)::TEXT || ')',
      'alerta_limite_legal', v_user_id, v_ultimo_aditivo
    );
  END IF;

  IF v_total_qtd_acrescimo > 0 AND v_pct_qtd >= 25.0 THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      p_contrato_id, 'alerta_aditivo_quantidade',
      'Limite legal Lei 14.133/21, art. 125: 25%',
      'ATENÇÃO: acréscimos acumulados em QUANTIDADE atingiram ' || v_pct_qtd::TEXT || '% (' || v_total_qtd_acrescimo::TEXT || ' sobre ' || v_qtd_total_contrato::TEXT || ')',
      'alerta_limite_legal', v_user_id, v_ultimo_aditivo
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recalcular_alertas_aditivos_contrato: %', SQLERRM;
END; $$;

COMMENT ON FUNCTION public.recalcular_alertas_aditivos_contrato(UUID) IS
  'Recalcula os alertas legais de um contrato ou ata. Ramifica por '
  'tipo_documento: contrato segue o teto do art. 125 da Lei 14.133/2021 '
  '(25%, ou 50% em reforma/obra/engenharia); ata_srp segue o Decreto '
  '11.462/2023 — acréscimo de quantitativo vedado (art. 30) e adesão limitada '
  'ao dobro do registrado (art. 32, §4º).';

-- ── 3 · reaplica nas atas, para o aviso antigo sair da tela ──────────────────
-- Só atas: contrato nenhum muda de comportamento nesta migration.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.contratos WHERE COALESCE(tipo_documento,'contrato') = 'ata_srp' LOOP
    PERFORM public.recalcular_alertas_aditivos_contrato(r.id);
  END LOOP;
END $$;
