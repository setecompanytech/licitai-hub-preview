-- ═══════════════════════════════════════════════════════════════════════════
-- Prorrogação fora do alerta do art. 125 — desta vez na função que EXISTE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SUBSTITUI a 20260831000008, que nunca pôde ser aplicada: eu a escrevi de
-- cabeça, contra uma função (`fn_alerta_legal_contrato`) e uma tabela
-- (`contrato_auditoria`) que NÃO EXISTEM — teria criado uma função órfã que
-- gatilho nenhum chama e falhado no DELETE. O erro veio à tona quando a
-- conferência devolveu `relation "contrato_auditoria" does not exist`
-- (01/09). Mesma família do `contratos.cliente_id`: objeto deduzido em vez de
-- lido. A função real é `recalcular_alertas_aditivos_contrato` (da
-- 20260824000001) e grava em `contrato_ia_auditoria`.
--
-- O DEFEITO em si continua o mesmo de antes: o 1º TA do 149/2024 — prorrogação
-- de fornecimento contínuo (art. 107) registrada como `prazo_quantidade` com a
-- estimativa do novo período — disparou "acréscimos acumulados em QUANTIDADE
-- atingiram 100,00%". A soma era por EXCLUSÃO (e um regex que casa 'quantidade'
-- no NOME do tipo), então a renovação anual entrou como acréscimo. Renovação
-- do art. 107 abre novo período; não consome o teto do art. 125. Tratá-la como
-- acréscimo faz todo contrato contínuo estourar na primeira prorrogação.
--
-- A lista vira INCLUSÃO — valor, quantidade, valor_quantidade, escopo — a
-- mesma de `consomeLimiteDoArt125` no front. Com exclusão, todo tipo novo
-- entra na conta por omissão; foi exatamente assim que a prorrogação entrou.
--
-- O ramo de ATA SRP não muda em nada.

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

  -- ═══ ATA DE REGISTRO DE PREÇOS — inalterado ════════════════════════════════
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
        'Esta ATA registra R$ ' || v_total_acrescimo::TEXT || ' de acréscimos (' ||
        v_pct_valor::TEXT || '% sobre R$ ' || v_valor_original::TEXT || '), mas nenhum ' ||
        'aditivo foi classificado. Na ARP, ACRÉSCIMO de quantitativo é vedado (art. 30), ' ||
        'enquanto ADESÃO de órgão não participante é permitida até o dobro do registrado ' ||
        '(art. 32, §4º). Classifique os aditivos como "adesao" ou "remanejamento" para o ' ||
        'sistema aplicar a regra certa.',
        'alerta_limite_legal', v_user_id, v_ultimo_aditivo
      );
    END IF;

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

  IF lower(COALESCE(v_objeto, '')) ~ '(reforma|engenharia|obra)' THEN
    v_limite := 50.0;
  END IF;

  -- ── A soma que importa: só o que ACRESCE dentro da mesma vigência ─────────
  --
  -- Por INCLUSÃO, não por exclusão. A versão anterior excluía seis tipos e
  -- ainda casava 'quantidade' por regex no NOME — `prazo_quantidade`, que é
  -- prorrogação de contínuo com a estimativa do novo período (art. 107),
  -- entrava como acréscimo e acusava 100% na primeira renovação. Com
  -- inclusão, tipo novo fica de fora até alguém decidir que ele entra.
  SELECT EXISTS (
    SELECT 1 FROM public.contrato_aditivos
    WHERE contrato_id = p_contrato_id
      AND tipo IN ('valor', 'quantidade', 'valor_quantidade', 'escopo')
      AND (COALESCE(valor_acrescimo,0) > 0 OR COALESCE(quantidade_acrescimo,0) > 0)
  ) INTO v_tem_quant;

  IF NOT v_tem_quant THEN RETURN; END IF;

  SELECT COALESCE(SUM(valor_acrescimo),0), COALESCE(SUM(quantidade_acrescimo),0)
  INTO v_total_acrescimo, v_total_qtd_acrescimo
  FROM public.contrato_aditivos
  WHERE contrato_id = p_contrato_id
    AND tipo IN ('valor', 'quantidade', 'valor_quantidade', 'escopo');

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
    AND tipo IN ('valor', 'quantidade', 'valor_quantidade', 'escopo')
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
  'Recalcula os alertas legais de um contrato ou ata. Contrato: teto do art. '
  '125 da Lei 14.133/2021 (25%, ou 50% em reforma/obra/engenharia), somando '
  'POR INCLUSÃO só o que acresce na mesma vigência — valor, quantidade, '
  'valor_quantidade, escopo. Prorrogação (art. 107) fica fora: renovação de '
  'período não consome o teto. ATA SRP: Decreto 11.462/2023 (arts. 30 e 32).';

-- ── Reprocessa quem tem alerta de limite: o falso sai, o verdadeiro fica ────
-- O recálculo da própria função apaga e refaz — não é DELETE cego.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT a.contrato_id
    FROM public.contrato_ia_auditoria a
    JOIN public.contratos c ON c.id = a.contrato_id
    WHERE a.origem = 'alerta_limite_legal'
      AND COALESCE(c.tipo_documento, 'contrato') <> 'ata_srp'
  LOOP
    PERFORM public.recalcular_alertas_aditivos_contrato(r.contrato_id);
  END LOOP;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--
--   SELECT c.numero_contrato, a.campo, a.valor_novo
--     FROM public.contrato_ia_auditoria a
--     JOIN public.contratos c ON c.id = a.contrato_id
--    WHERE a.origem = 'alerta_limite_legal'
--    ORDER BY c.numero_contrato;
--
-- O 149/2024 não deve aparecer: o único aditivo dele é `prazo_quantidade`.
