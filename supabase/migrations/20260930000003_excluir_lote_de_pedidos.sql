-- ============================================================================
-- Excluir um lote de pedidos de uma vez, numa transação
-- ============================================================================
--
-- 30/09/2026. "Excluir lote" apagava parte a parte pelo navegador: a exclusão
-- da NF-e 595 parou no meio (12 de 18) e precisou de um segundo clique. Aqui
-- é uma chamada só: registra cada parte em pedidos_exclusoes com o motivo,
-- desliga o que aponta para elas, solta o título único do lote (o título
-- fica no Financeiro — apagar título é lá) e apaga as partes. Tudo ou nada.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

CREATE OR REPLACE FUNCTION public.excluir_lote_de_pedidos(p_lote_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_id uuid;
  v_empresa_id uuid;
  v_ids uuid[];
  v_partes integer;
  v_titulos integer;
  v_email text := coalesce(auth.jwt() ->> 'email', '');
BEGIN
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote obrigatório'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN RAISE EXCEPTION 'motivo obrigatório'; END IF;

  SELECT array_agg(id), (array_agg(contrato_id))[1] INTO v_ids, v_contrato_id
    FROM public.contrato_pedidos WHERE lote_id = p_lote_id;
  IF v_ids IS NULL THEN RAISE EXCEPTION 'lote não encontrado'; END IF;

  SELECT empresa_id INTO v_empresa_id FROM public.contratos WHERE id = v_contrato_id;
  IF v_empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_empresa_id) THEN
    RAISE EXCEPTION 'sem acesso a este contrato';
  END IF;

  -- O rastro: uma linha por parte, com o pedido inteiro guardado.
  INSERT INTO public.pedidos_exclusoes
    (contrato_id, pedido_id, numero_pedido, descricao, valor_total, data_pedido, status,
     deletado_por_user_id, deletado_por_email, motivo, pedido_snapshot)
  SELECT p.contrato_id, p.id, p.numero_pedido, p.descricao, p.valor_total, p.data_pedido, p.status,
         auth.uid(), v_email, trim(p_motivo), to_jsonb(p)
    FROM public.contrato_pedidos p WHERE p.id = ANY(v_ids);

  -- O que aponta para as partes e não cai sozinho (as demais FKs são CASCADE/SET NULL).
  DELETE FROM public.comissoes_lancamentos WHERE contrato_pedido_id = ANY(v_ids);
  IF to_regclass('public.contas_receber') IS NOT NULL THEN
    EXECUTE 'UPDATE public.contas_receber SET contrato_pedido_id = NULL WHERE contrato_pedido_id = ANY($1)' USING v_ids;
  END IF;

  -- O título único do lote fica no Financeiro, sem lote.
  UPDATE public.financeiro_lancamentos SET lote_id = NULL WHERE lote_id = p_lote_id;
  GET DIAGNOSTICS v_titulos = ROW_COUNT;

  DELETE FROM public.contrato_pedidos WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_partes = ROW_COUNT;

  RETURN jsonb_build_object('partes_apagadas', v_partes, 'titulos_desligados', v_titulos);
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_lote_de_pedidos(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.excluir_lote_de_pedidos(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.excluir_lote_de_pedidos(uuid, text) IS
  'Apaga todas as partes de um lote de pedidos numa transação, com motivo em pedidos_exclusoes; o título único do lote fica no Financeiro sem lote_id.';
