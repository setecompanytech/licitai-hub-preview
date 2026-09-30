-- ============================================================================
-- Dados: 4º Termo Aditivo ao Contrato 772/2024 (Barcarena) — reequilíbrio de
-- 4 itens (art. 124, II, "d"), assinado em 20/08/2026 — REGISTRO + APLICAÇÃO
-- ============================================================================
--
-- 30/09/2026. O banco tinha só o 1º, 2º e 3º termos; o 4º (documento
-- "4º TAC 772-2024 - ETHOS Ass.pdf") reequilibra: item 4 R$ 7,15 → 8,95;
-- item 6 R$ 1,50 → 3,21; item 9 R$ 9,00 → 13,68; item 11 R$ 5,84 → 7,60.
-- valor_aditivo = Σ (Δ preço × quantidade do período do 3º TA), como o 1º TA:
-- 1,80×2411 + 1,71×2411 + 4,68×4822 + 1,76×4822 = 39.516,29.
-- Mesmo molde do 1º TA (user_id do admin da ETHOS). Idempotente.
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

DO $$
DECLARE
  v_contrato uuid := '429bd2b3-8364-4775-ada7-5d1e18949523';
  v_empresa  uuid := '6fd7ea75-b22b-4947-a4c2-170c07d53e3d';
  v_user     uuid := '1d964cb3-81b3-42f6-b909-4c2c7d4983a4';
  v_aditivo  uuid;
BEGIN
  SELECT id INTO v_aditivo FROM public.contrato_aditivos
   WHERE contrato_id = v_contrato AND numero_aditivo = '4º Termo Aditivo';
  IF v_aditivo IS NULL THEN
    INSERT INTO public.contrato_aditivos
      (contrato_id, user_id, numero_aditivo, tipo, valor_aditivo, valor_acrescimo, valor_supressao,
       prazo_adicional_dias, quantidade_acrescimo, quantidade_supressao, referencia_tipo,
       data_aditivo, data_assinatura, data_efeitos, com_ressalva, fundamento_legal, justificativa)
    VALUES
      (v_contrato, v_user, '4º Termo Aditivo', 'reequilibrio', 39516.29, 39516.29, 0,
       0, 0, 0, 'contrato',
       '2026-08-20', '2026-08-20', '2026-08-20', false,
       'Lei 14.133/2021, art. 124, II, "d" — revisão para reequilíbrio econômico-financeiro; fora do limite do art. 125',
       'Recomposição de preços dos insumos (reequilíbrio econômico-financeiro) dos itens 4, 6, 9 e 11, conforme 4º Termo Aditivo assinado em 20/08/2026.')
    RETURNING id INTO v_aditivo;
  END IF;

  -- As 4 linhas do termo (anterior → novo), no molde da leitura do 1º TA.
  INSERT INTO public.contrato_aditivo_itens
    (empresa_id, contrato_id, aditivo_id, contrato_item_id, user_id, numero_item_lido, valor_lido,
     valor_unitario_anterior, valor_unitario_novo, quantidade_acrescimo, quantidade_supressao, origem, editado)
  SELECT v_empresa, v_contrato, v_aditivo, i.id, v_user, i.codigo_item, l.novo,
         l.anterior, l.novo, 0, 0, 'manual', false
    FROM (VALUES ('4', 7.15, 8.95), ('6', 1.50, 3.21), ('9', 9.00, 13.68), ('11', 5.84, 7.60)) AS l(item, anterior, novo)
    JOIN public.contrato_itens i ON i.contrato_id = v_contrato AND i.codigo_item = l.item
  ON CONFLICT (aditivo_id, contrato_item_id) DO NOTHING;

  -- Aplica (regrava o preço vigente e a trilha), só se ainda não aplicado.
  IF (SELECT itens_aplicados_em FROM public.contrato_aditivos WHERE id = v_aditivo) IS NULL THEN
    PERFORM public.aplicar_itens_do_aditivo_interno(v_aditivo);
  END IF;
END $$;

-- Higiene: item nunca alterado ganha o original = vigente, para a coluna
-- "Contrato Original" ficar completa (3, 6, 9, 14, 16, 18).
UPDATE public.contrato_itens
   SET valor_unitario_original = valor_unitario
 WHERE contrato_id = '429bd2b3-8364-4775-ada7-5d1e18949523'
   AND valor_unitario_original IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.contrato_aditivo_itens ai WHERE ai.contrato_item_id = contrato_itens.id AND ai.valor_unitario_novo IS NOT NULL);

-- Conferência:
-- SELECT i.codigo_item, i.valor_unitario_original, i.valor_unitario FROM public.contrato_itens i
--  WHERE i.contrato_id = '429bd2b3-8364-4775-ada7-5d1e18949523' ORDER BY i.codigo_item::int;
-- Esperado: 4 → 8,95 · 6 → 3,21 · 9 → 13,68 · 11 → 7,60; os demais como estavam.
