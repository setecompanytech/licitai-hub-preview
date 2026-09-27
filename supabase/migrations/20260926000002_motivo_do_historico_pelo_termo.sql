-- ============================================================================
-- Aplicar itens do termo: o motivo da trilha de preço respeita a lista da casa
-- ============================================================================
--
-- O defeito (26/09, 22:58): o 1º TA do 772/2024 foi registrado com 12 linhas,
-- mas `aplicar_itens_do_aditivo` falhou e nada chegou aos itens. Causa: a
-- função gravava em `contrato_item_precos_historico.motivo` o texto "Termo 1º
-- Termo Aditivo (reequilibrio)", e a coluna tem CHECK desde 24/08 — só aceita
-- reequilibrio, reajuste, repactuacao, revisao, correcao ou outro. A trilha
-- recusou, a transação inteira voltou atrás, e o termo ficou com as linhas
-- gravadas e não aplicadas (`itens_aplicados_em` nulo).
--
-- Correção: o motivo vira a CLASSE do termo (o tipo do aditivo, quando está
-- na lista; senão "outro"; reversão é "correcao") e o número do termo vai
-- para `observacao`, que é texto livre. Só as duas funções internas mudam.
-- Reproduzido em ensaio com ROLLBACK antes de escrever isto.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk, depois da 20260926000001.

-- ── 1) A classe do motivo a partir do tipo do termo ──────────────────────────
CREATE OR REPLACE FUNCTION public.motivo_do_historico_pelo_termo(p_tipo text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN lower(coalesce(p_tipo, '')) IN ('reequilibrio', 'reajuste', 'repactuacao', 'revisao') THEN lower(p_tipo)
    ELSE 'outro'
  END;
$$;

-- ── 2) Aplicar ──────────────────────────────────────────────────────────────
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
  v_aplicadas int := 0;
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
    SELECT valor_unitario INTO v_atual
      FROM public.contrato_itens
     WHERE id = v_linha.contrato_item_id AND contrato_id = v_contrato
       FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % não pertence ao contrato do termo', v_linha.contrato_item_id;
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
      -- O gatilho trg_historico_preco_item acabou de gravar a trilha sem
      -- motivo; o termo assina — com a classe que a coluna aceita.
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
  RETURN jsonb_build_object('aplicadas', v_aplicadas);
END $$;
REVOKE ALL ON FUNCTION public.aplicar_itens_do_aditivo_interno(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3) Reverter ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reverter_itens_do_aditivo_interno(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contrato uuid;
  v_numero text;
  v_aplicado timestamptz;
  v_posterior text;
  v_linha record;
  v_revertidas int := 0;
BEGIN
  SELECT contrato_id, numero_aditivo, itens_aplicados_em INTO v_contrato, v_numero, v_aplicado
    FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL THEN
    RAISE EXCEPTION 'Termo aditivo % não existe', p_aditivo_id;
  END IF;
  IF v_aplicado IS NULL THEN
    RETURN jsonb_build_object('revertidas', 0);
  END IF;

  SELECT a2.numero_aditivo INTO v_posterior
    FROM public.contrato_aditivo_itens l2
    JOIN public.contrato_aditivos a2 ON a2.id = l2.aditivo_id
   WHERE l2.aditivo_id <> p_aditivo_id
     AND l2.aplicado_em > v_aplicado
     AND l2.valor_unitario_novo IS NOT NULL
     AND l2.contrato_item_id IN (
       SELECT contrato_item_id FROM public.contrato_aditivo_itens
        WHERE aditivo_id = p_aditivo_id AND valor_unitario_novo IS NOT NULL)
   ORDER BY l2.aplicado_em DESC LIMIT 1;
  IF v_posterior IS NOT NULL THEN
    RAISE EXCEPTION 'O termo % foi aplicado depois sobre os mesmos itens; reverta-o primeiro', v_posterior;
  END IF;

  FOR v_linha IN
    SELECT * FROM public.contrato_aditivo_itens
     WHERE aditivo_id = p_aditivo_id AND aplicado_em IS NOT NULL
     ORDER BY created_at DESC
  LOOP
    IF v_linha.valor_unitario_novo IS NOT NULL AND v_linha.valor_unitario_anterior IS NOT NULL THEN
      UPDATE public.contrato_itens
         SET valor_unitario = v_linha.valor_unitario_anterior, updated_at = now()
       WHERE id = v_linha.contrato_item_id;
      UPDATE public.contrato_item_precos_historico h
         SET motivo = 'correcao',
             observacao = COALESCE(h.observacao, 'Reversão do termo ' || COALESCE(v_numero, ''))
       WHERE h.id = (
         SELECT id FROM public.contrato_item_precos_historico
          WHERE contrato_item_id = v_linha.contrato_item_id AND motivo IS NULL
          ORDER BY created_at DESC LIMIT 1);
    END IF;
    UPDATE public.contrato_aditivo_itens
       SET aplicado_em = NULL, updated_at = now()
     WHERE id = v_linha.id;
    v_revertidas := v_revertidas + 1;
  END LOOP;

  UPDATE public.contrato_aditivos
     SET itens_aplicados_em = NULL, updated_at = now()
   WHERE id = p_aditivo_id;

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato);
  RETURN jsonb_build_object('revertidas', v_revertidas);
END $$;
REVOKE ALL ON FUNCTION public.reverter_itens_do_aditivo_interno(uuid) FROM PUBLIC, anon, authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT public.motivo_do_historico_pelo_termo('reequilibrio'), public.motivo_do_historico_pelo_termo('prorrogacao');
--   -- Esperado: reequilibrio | outro
--
-- ── Termo que ficou pendente (linhas gravadas, não aplicadas) ───────────────
-- A tela ganha o botão "Aplicar aos itens" no painel do termo. Pelo SQL Editor,
-- que roda como postgres e não passa pela checagem de sessão:
--   SELECT id, numero_aditivo FROM public.contrato_aditivos
--    WHERE itens_aplicados_em IS NULL
--      AND EXISTS (SELECT 1 FROM public.contrato_aditivo_itens l WHERE l.aditivo_id = contrato_aditivos.id);
--   SELECT public.aplicar_itens_do_aditivo_interno('<id do termo>');
--   -- Esperado: {"aplicadas": N}
