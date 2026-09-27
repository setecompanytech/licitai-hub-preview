-- ============================================================================
-- Número do item: o termo preenche o que o cadastro não tem; 772/2024 acertado
-- ============================================================================
--
-- O caso (26/09, 23:22): na tabela do 1º TA do 772/2024 o açúcar e o arroz
-- apareciam sem número e no fim da lista. A importação do contrato gravou
-- neles o elemento de despesa ("3.3.90.32.03", "3.3.90.32.00") — o cabeçalho
-- da dotação que a tabela traz logo acima do item 1 — no lugar do número.
-- A leitura do termo sabia ("lido como item 1"), o cadastro não.
--
-- Duas coisas:
--   1) aplicar o termo passa a adotar o número lido do documento quando o
--      item não tem código numérico, guardando o código anterior na
--      observação do item;
--   2) os dois itens do 772/2024 recebem 1 e 2, com o elemento de despesa
--      preservado na observação.
-- A leitura (`extrair-contrato-pdf`) também deixou de aceitar elemento de
-- despesa como código — deploy à parte.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk, depois da 20260926000003.

-- ── 1) Aplicar adota o número lido quando o cadastro não tem ────────────────
CREATE OR REPLACE FUNCTION public.aplicar_itens_do_aditivo_interno(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato uuid;
  v_numero text;
  v_tipo text;
  v_motivo text;
  v_observacao text;
  v_linha record;
  v_atual numeric;
  v_codigo text;
  v_aplicadas int := 0;
  v_numerados int := 0;
BEGIN
  SELECT contrato_id, numero_aditivo, tipo INTO v_contrato, v_numero, v_tipo
    FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL THEN
    RAISE EXCEPTION 'Termo aditivo % não existe', p_aditivo_id;
  END IF;
  v_motivo := public.motivo_do_historico_pelo_termo(v_tipo);
  v_observacao := 'Termo ' || COALESCE(v_numero, '') || ' (' || COALESCE(v_tipo, '') || '), aplicado pelas linhas do termo';

  FOR v_linha IN
    SELECT * FROM public.contrato_aditivo_itens
     WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NULL
     ORDER BY created_at
  LOOP
    SELECT valor_unitario, codigo_item INTO v_atual, v_codigo
      FROM public.contrato_itens
     WHERE id = v_linha.contrato_item_id AND contrato_id = v_contrato
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % não pertence ao contrato do termo', v_linha.contrato_item_id;
    END IF;

    -- O número do item, quando o cadastro não o tem e o termo o diz.
    IF v_linha.numero_item_lido ~ '^\d{1,4}$'
       AND (v_codigo IS NULL OR v_codigo !~ '^\d{1,4}$')
       AND NOT EXISTS (
         SELECT 1 FROM public.contrato_itens
          WHERE contrato_id = v_contrato AND codigo_item = v_linha.numero_item_lido
            AND id <> v_linha.contrato_item_id) THEN
      UPDATE public.contrato_itens
         SET codigo_item = v_linha.numero_item_lido,
             observacoes = CASE
               WHEN v_codigo IS NULL OR btrim(v_codigo) = '' THEN observacoes
               ELSE concat_ws(' | ', observacoes, 'Código anterior (lido na importação): ' || v_codigo)
             END,
             updated_at = now()
       WHERE id = v_linha.contrato_item_id;
      v_numerados := v_numerados + 1;
    END IF;

    IF v_linha.valor_unitario_novo IS NOT NULL THEN
      UPDATE public.contrato_aditivo_itens
         SET valor_unitario_anterior = COALESCE(valor_unitario_anterior, v_atual)
       WHERE id = v_linha.id;
      UPDATE public.contrato_itens
         SET valor_unitario_original = COALESCE(valor_unitario_original, valor_unitario),
             valor_unitario = v_linha.valor_unitario_novo,
             updated_at = now()
       WHERE id = v_linha.contrato_item_id;
      UPDATE public.contrato_item_precos_historico h
         SET motivo = v_motivo,
             observacao = COALESCE(h.observacao, v_observacao)
       WHERE h.id = (
         SELECT id FROM public.contrato_item_precos_historico
          WHERE contrato_item_id = v_linha.contrato_item_id AND motivo IS NULL
          ORDER BY created_at DESC LIMIT 1);
    END IF;

    UPDATE public.contrato_aditivo_itens
       SET aplicado_em = now(), updated_at = now()
     WHERE id = v_linha.id;
    v_aplicadas := v_aplicadas + 1;
  END LOOP;

  UPDATE public.contrato_aditivos
     SET itens_aplicados_em = now(), updated_at = now()
   WHERE id = p_aditivo_id
     AND EXISTS (SELECT 1 FROM public.contrato_aditivo_itens WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NOT NULL);

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato);
  RETURN jsonb_build_object('aplicadas', v_aplicadas, 'numerados', v_numerados);
END $$;
REVOKE ALL ON FUNCTION public.aplicar_itens_do_aditivo_interno(uuid) FROM PUBLIC, anon, authenticated;

-- ── 2) Os dois itens do 772/2024 ────────────────────────────────────────────
UPDATE public.contrato_itens
   SET codigo_item = '1',
       observacoes = concat_ws(' | ', observacoes, 'Elemento de despesa lido na importação como código: 3.3.90.32.03'),
       updated_at = now()
 WHERE id = '7c4a2bb2-d218-4b82-b7d8-edc37ae9a2fa'
   AND contrato_id = '429bd2b3-8364-4775-ada7-5d1e18949523'
   AND codigo_item = '3.3.90.32.03';

UPDATE public.contrato_itens
   SET codigo_item = '2',
       observacoes = concat_ws(' | ', observacoes, 'Elemento de despesa lido na importação como código: 3.3.90.32.00'),
       updated_at = now()
 WHERE id = '384ee8d2-3270-4261-91a5-b980273dda39'
   AND contrato_id = '429bd2b3-8364-4775-ada7-5d1e18949523'
   AND codigo_item = '3.3.90.32.00';

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT codigo_item, left(descricao, 30), valor_unitario
--     FROM public.contrato_itens
--    WHERE contrato_id = '429bd2b3-8364-4775-ada7-5d1e18949523'
--    ORDER BY codigo_item::int;
--   -- Esperado: 18 linhas, 1 a 18; 1 = AÇÚCAR 6,81; 2 = ARROZ 8,56.
