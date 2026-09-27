-- ============================================================================
-- Apagar um termo já aplicado: a reversão não pode tocar a linha que morre
-- ============================================================================
--
-- O defeito (26/09, 23:16): "Excluir termo" num termo com linhas aplicadas
-- devolvia "tuple to be deleted was already modified by an operation
-- triggered by the current command". O gatilho BEFORE DELETE chamava a
-- reversão, e a reversão fazia UPDATE em contrato_aditivos na PRÓPRIA linha
-- que o DELETE ia apagar — o Postgres recusa apagar uma linha que o mesmo
-- comando acabou de alterar. Reproduzido em ensaio com ROLLBACK.
--
-- Correção: a reversão ganha um segundo parâmetro, "marcar o termo". Chamada
-- pela RPC (reverter sem apagar) ela marca `itens_aplicados_em = NULL`;
-- chamada pelo gatilho de exclusão, não toca o termo — ele está indo embora.
-- O preço dos itens volta ao anterior nos dois casos, e a trilha fica.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk, depois da 20260926000002.

DROP FUNCTION IF EXISTS public.reverter_itens_do_aditivo_interno(uuid);

CREATE OR REPLACE FUNCTION public.reverter_itens_do_aditivo_interno(p_aditivo_id uuid, p_marcar_termo boolean DEFAULT true)
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

  -- Um termo mais novo que mexeu nos mesmos itens tem de ser revertido antes:
  -- o "preço anterior" deste já não é o preço que o item carrega.
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

  -- Quem apaga o termo não marca o termo: a linha está sendo apagada pelo
  -- mesmo comando, e alterá-la aqui faria o DELETE falhar.
  IF p_marcar_termo THEN
    UPDATE public.contrato_aditivos
       SET itens_aplicados_em = NULL, updated_at = now()
     WHERE id = p_aditivo_id;
  END IF;

  PERFORM public.recalcular_saldos_itens_do_contrato(v_contrato);
  RETURN jsonb_build_object('revertidas', v_revertidas);
END $$;
REVOKE ALL ON FUNCTION public.reverter_itens_do_aditivo_interno(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reverter_itens_antes_de_apagar_aditivo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.itens_aplicados_em IS NOT NULL THEN
    PERFORM public.reverter_itens_do_aditivo_interno(OLD.id, false);
  END IF;
  RETURN OLD;
END $$;

-- A RPC pública continua chamando com um argumento: o padrão marca o termo.
CREATE OR REPLACE FUNCTION public.reverter_itens_do_aditivo(p_aditivo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contrato uuid;
BEGIN
  SELECT contrato_id INTO v_contrato FROM public.contrato_aditivos WHERE id = p_aditivo_id;
  IF v_contrato IS NULL OR NOT public.contrato_e_de_quem_chama(v_contrato) THEN
    RAISE EXCEPTION 'Sem permissão neste contrato';
  END IF;
  RETURN public.reverter_itens_do_aditivo_interno(p_aditivo_id, true);
END $$;
REVOKE ALL ON FUNCTION public.reverter_itens_do_aditivo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverter_itens_do_aditivo(uuid) TO authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc
--    WHERE proname = 'reverter_itens_do_aditivo_interno';
--   -- Esperado: uma linha, "p_aditivo_id uuid, p_marcar_termo boolean".
