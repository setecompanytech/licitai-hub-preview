-- Corrige o trigger de alerta legal para respeitar a Lei 14.133/21:
-- Os limites do art. 125 (25% / 50% para reformas/obras) aplicam-se APENAS a
-- alterações quantitativas (acréscimos/supressões de valor ou quantidade).
-- Aditivos de PRAZO/VIGÊNCIA (art. 107 e art. 124, II) NÃO se sujeitam a esse limite.

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
  v_tipo TEXT;
  v_tipo_norm TEXT;
  v_avalia_valor BOOLEAN := false;
  v_avalia_qtd BOOLEAN := false;
BEGIN
  SELECT c.user_id, c.valor_global_original, c.objeto
  INTO v_user_id, v_valor_original, v_objeto
  FROM public.contratos c WHERE c.id = NEW.contrato_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Reforma/obra/engenharia: limite ampliado para 50% (art. 125, §1º)
  IF lower(COALESCE(v_objeto,'')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  -- Normaliza o tipo do aditivo
  v_tipo := lower(COALESCE(NEW.tipo, ''));
  v_tipo_norm := translate(v_tipo, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');

  -- Decide quais limites avaliar com base no tipo do aditivo
  -- Tipos quantitativos (sujeitos a art. 125): valor, quantitativo, quantidade, supressao, acrescimo, misto
  -- Tipos qualitativos/temporais (NÃO sujeitos): prazo, vigencia, qualitativo, reequilibrio, repactuacao, reajuste, subcontratacao, garantia, outros
  IF v_tipo_norm ~ '(valor|quantitativ|quantidade|acrescim|supressa|misto)' THEN
    v_avalia_valor := true;
    v_avalia_qtd := true;
  END IF;

  -- Reforço: só avalia se o próprio aditivo trouxer um acréscimo > 0 no respectivo eixo
  IF NOT v_avalia_valor AND COALESCE(NEW.valor_acrescimo,0) > 0 THEN
    v_avalia_valor := true;
  END IF;
  IF NOT v_avalia_qtd AND COALESCE(NEW.quantidade_acrescimo,0) > 0 THEN
    v_avalia_qtd := true;
  END IF;

  -- Se nada a avaliar, encerra silenciosamente (ex.: aditivo de prazo/vigência)
  IF NOT v_avalia_valor AND NOT v_avalia_qtd THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos WHERE contrato_id = NEW.contrato_id;

  v_pct_valor := CASE WHEN COALESCE(v_valor_original,0) > 0
    THEN ROUND((v_total_acrescimo / v_valor_original) * 100, 2) ELSE 0 END;

  SELECT COALESCE(SUM(quantidade_contratada),0) INTO v_qtd_total_contrato
  FROM public.contrato_itens WHERE contrato_id = NEW.contrato_id;

  v_pct_qtd := CASE WHEN COALESCE(v_qtd_total_contrato,0) > 0
    THEN ROUND((v_total_qtd_acrescimo / v_qtd_total_contrato) * 100, 2) ELSE 0 END;

  -- Alerta de VALOR: só quando aplicável e quando há acréscimo real
  IF v_avalia_valor AND v_total_acrescimo > 0 AND v_pct_valor >= v_limite THEN
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (
      NEW.contrato_id, 'alerta_aditivo_valor',
      'Limite legal Lei 14.133/21, art. 125: ' || v_limite::TEXT || '%',
      'ATENÇÃO: acréscimos acumulados em VALOR atingiram ' || v_pct_valor::TEXT || '% (R$ ' || v_total_acrescimo::TEXT || ' sobre R$ ' || COALESCE(v_valor_original,0)::TEXT || ')',
      'alerta_limite_legal', v_user_id,
      'Aditivo nº ' || COALESCE(NEW.numero_aditivo,'?')
    );
  END IF;

  -- Alerta de QUANTIDADE: só quando aplicável e quando há acréscimo real
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

-- Limpeza: remove alertas legais previamente gerados de forma incorreta para
-- aditivos do tipo "prazo" / "vigência" (que não se submetem ao art. 125).
DELETE FROM public.contrato_ia_auditoria a
USING public.contrato_aditivos ad
WHERE a.origem = 'alerta_limite_legal'
  AND a.contrato_id = ad.contrato_id
  AND a.arquivo_nome = ('Aditivo nº ' || COALESCE(ad.numero_aditivo,'?'))
  AND lower(translate(COALESCE(ad.tipo,''), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) ~ '(prazo|vigenc|qualitativ|reequilibri|repactuac|reajuste|subcontrata|garantia)'
  AND COALESCE(ad.valor_acrescimo,0) = 0
  AND COALESCE(ad.quantidade_acrescimo,0) = 0;