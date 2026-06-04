-- Exclui aditivos de reequilíbrio econômico-financeiro (revisão, repactuação, reajuste)
-- do cálculo acumulado do limite de 25% previsto no art. 125 da Lei 14.133/21.
-- Esses institutos não estão sujeitos ao limite percentual e nunca devem gerar alerta.

CREATE OR REPLACE FUNCTION public.recalcular_alertas_aditivos_contrato(p_contrato_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_user_id UUID;
  v_valor_original NUMERIC;
  v_objeto TEXT;
  v_total_acrescimo NUMERIC;
  v_total_qtd_acrescimo NUMERIC;
  v_qtd_total_contrato NUMERIC;
  v_pct_valor NUMERIC;
  v_pct_qtd NUMERIC;
  v_limite NUMERIC := 25.0;
  v_ultimo_aditivo TEXT;
  v_tem_quant BOOLEAN;
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto
  INTO v_user_id, v_valor_original, v_objeto
  FROM public.contratos c WHERE c.id = p_contrato_id;

  IF v_user_id IS NULL THEN RETURN; END IF;

  -- Limpa alertas legais anteriores deste contrato (recálculo completo)
  DELETE FROM public.contrato_ia_auditoria
  WHERE contrato_id = p_contrato_id AND origem = 'alerta_limite_legal';

  -- Limite especial para reformas/obras/engenharia (art. 125, §1º)
  IF lower(COALESCE(v_objeto,'')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  -- Verifica se há ao menos um aditivo sujeito ao limite (exclui reequilíbrio/revisão/repactuação/reajuste)
  SELECT EXISTS (
    SELECT 1 FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
      AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste')
      AND (
        lower(translate(COALESCE(tipo,''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))
          ~ '(valor|quantitativ|quantidade|acrescim|supressa|misto)'
        OR COALESCE(valor_acrescimo,0) > 0
        OR COALESCE(quantidade_acrescimo,0) > 0
      )
  ) INTO v_tem_quant;

  IF NOT v_tem_quant THEN RETURN; END IF;

  -- Soma apenas aditivos sujeitos ao limite (exclui os 3 institutos de reequilíbrio)
  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste');

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = p_contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  -- Pega o número do aditivo mais recente sujeito ao limite para referência
  SELECT 'Aditivo nº ' || COALESCE(numero_aditivo,'?')
  INTO v_ultimo_aditivo
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo NOT IN ('reequilibrio', 'revisao', 'repactuacao', 'reajuste')
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
