-- =============================================================================
-- O teto do art. 125 mede-se sobre o valor inicial ATUALIZADO
--
-- A letra da lei: "até 25% do valor INICIAL ATUALIZADO do contrato". O
-- atualizado é o original corrigido pelos institutos que não acrescem objeto —
-- reequilíbrio, reajuste, revisão, repactuação. O alerta dividia pelo original
-- CRU, e o caso concreto mostrou o estrago que isso faria: o 2º termo do
-- contrato 068/2025 acresce R$ 2.557.296,00, que o órgão calculou —
-- corretamente — como 25,00% exatos do valor reequilibrado (R$ 10.229.184,00);
-- sobre o original cru (R$ 6.370.560,00), o sistema acusaria falsos 40,14%.
--
-- Falso alerta legal é caro duas vezes: manda tratar de infração inexistente e
-- ensina a ignorar o alerta verdadeiro.
-- =============================================================================

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
  v_base_atualizada NUMERIC;
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
    SELECT COALESCE(SUM(valor_acrescimo), 0)
    INTO v_total_adesao
    FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id AND tipo = 'adesao';

    SELECT COALESCE(SUM(valor_acrescimo), 0)
    INTO v_total_acrescimo
    FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
      AND tipo NOT IN ('adesao', 'remanejamento', 'reequilibrio', 'revisao', 'repactuacao', 'reajuste');

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
        'Esta ATA registra ' || public.formatar_brl(v_total_acrescimo) || ' de acréscimos (' ||
        public.formatar_numero(v_pct_valor) || '% sobre ' || public.formatar_brl(v_valor_original) ||
        '), mas nenhum aditivo foi classificado. Na ARP, ACRÉSCIMO de quantitativo é vedado ' ||
        '(art. 30), enquanto ADESÃO de órgão não participante é permitida até o dobro do ' ||
        'registrado (art. 32, §4º). Classifique os aditivos como "adesao" ou "remanejamento" ' ||
        'para o sistema aplicar a regra certa.',
        'alerta_limite_legal', v_user_id, v_ultimo_aditivo
      );
    END IF;

    IF v_classificados AND v_total_acrescimo > 0 THEN
      INSERT INTO public.contrato_ia_auditoria
        (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
      VALUES (
        p_contrato_id, 'alerta_ata_acrescimo_vedado',
        'Decreto 11.462/2023, art. 30: acréscimo vedado',
        'ATENÇÃO: ' || public.formatar_brl(v_total_acrescimo) || ' lançados como acréscimo à ' ||
        'ATA. É vedado acrescer os quantitativos registrados na ata de registro de preços. ' ||
        'Se foram adesões de órgãos não participantes, reclassifique como "adesao".',
        'alerta_limite_legal', v_user_id, v_ultimo_aditivo
      );
    END IF;

    IF v_total_adesao > 0 AND COALESCE(v_valor_original, 0) > 0 THEN
      v_pct_adesao := ROUND((v_total_adesao / v_valor_original) * 100, 2);
      IF v_pct_adesao > 100.0 THEN
        INSERT INTO public.contrato_ia_auditoria
          (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
        VALUES (
          p_contrato_id, 'alerta_ata_adesao',
          'Limite legal Decreto 11.462/2023, art. 32, §4º: 100% (o dobro do registrado)',
          'ATENÇÃO: adesões acumuladas atingiram ' || public.formatar_numero(v_pct_adesao) ||
          '% do registrado (' || public.formatar_brl(v_total_adesao) || ' sobre ' ||
          public.formatar_brl(v_valor_original) || '). O total das adesões não pode exceder ' ||
          'o dobro do quantitativo de cada item registrado.',
          'alerta_limite_legal', v_user_id, v_ultimo_aditivo
        );
      END IF;
    END IF;

    RETURN;
  END IF;

  -- ═══ CONTRATO ══════════════════════════════════════════════════════════════

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

  -- A base do art. 125 é o valor inicial ATUALIZADO: original + efeito líquido
  -- dos institutos fora-do-objeto (reequilíbrio, reajuste, revisão,
  -- repactuação). É sobre ela que os 25% se medem.
  SELECT COALESCE(v_valor_original, 0) + COALESCE(SUM(
    COALESCE(valor_acrescimo, 0) - COALESCE(valor_supressao, 0)
  ), 0)
  INTO v_base_atualizada
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste');

  v_pct_valor := CASE WHEN COALESCE(v_base_atualizada,0) > 0
    THEN ROUND((v_total_acrescimo / v_base_atualizada) * 100, 2) ELSE 0 END;

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

  IF v_total_acrescimo > 0 AND v_pct_valor > v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      p_contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21, art. 125: ' || public.formatar_numero(v_limite, 0) || '% do valor inicial atualizado',
      'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || public.formatar_numero(v_pct_valor) ||
      '% (' || public.formatar_brl(v_total_acrescimo) || ' sobre o valor inicial atualizado de ' ||
      public.formatar_brl(v_base_atualizada) || ')',
      'alerta_limite_legal', v_user_id, v_ultimo_aditivo
    );
  END IF;

  IF v_total_qtd_acrescimo > 0 AND v_pct_qtd > 25.0 THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      p_contrato_id, 'alerta_aditivo_quantidade',
      'Limite legal Lei 14.133/21, art. 125: 25%',
      'ATENÇÃO: acréscimos acumulados em QUANTIDADE atingiram ' || public.formatar_numero(v_pct_qtd) ||
      '% (' || public.formatar_numero(v_total_qtd_acrescimo, 0) || ' sobre ' ||
      public.formatar_numero(v_qtd_total_contrato, 0) || ')',
      'alerta_limite_legal', v_user_id, v_ultimo_aditivo
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'recalcular_alertas_aditivos_contrato: %', SQLERRM;
END; $$;

COMMENT ON FUNCTION public.recalcular_alertas_aditivos_contrato(UUID) IS
  'Recalcula os alertas legais de um contrato ou ata. Contrato: teto do art. '
  '125 medido sobre o VALOR INICIAL ATUALIZADO (original + reequilíbrio/'
  'reajuste/revisão/repactuação líquidos); dispara só ACIMA do limite — no '
  'limite exato é lícito. Ata: Decreto 11.462/2023 (arts. 30 e 32).';

-- Reaplica em todos: a base mudou para contratos com institutos fora-do-objeto.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.contratos LOOP
    PERFORM public.recalcular_alertas_aditivos_contrato(r.id);
  END LOOP;
END $$;
