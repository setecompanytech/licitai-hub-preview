-- ============================================================================
-- Correção: excluir/editar lote usavam min(contrato_id) — não existe min(uuid)
-- ============================================================================
--
-- 30/09/2026, 22h. "function min(uuid) does not exist" ao salvar o lote.
-- Recria as duas funções pegando o contrato pelo primeiro elemento do array.
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


CREATE OR REPLACE FUNCTION public.editar_lote_de_pedidos(p_lote_id uuid, p_campos jsonb, p_descricao text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato_id uuid;
  v_empresa_id uuid;
  v_ids uuid[];
  v_n integer := 0;
  r record;
  v_resto text;
BEGIN
  IF p_lote_id IS NULL THEN RAISE EXCEPTION 'lote obrigatório'; END IF;

  -- Trava as partes em ordem fixa: quem chegar depois espera, não trava cruzado.
  -- FOR UPDATE não aceita agregação: trava nas linhas da subconsulta.
  SELECT array_agg(t.id ORDER BY t.id), (array_agg(t.contrato_id))[1] INTO v_ids, v_contrato_id
    FROM (SELECT id, contrato_id FROM public.contrato_pedidos WHERE lote_id = p_lote_id ORDER BY id FOR UPDATE) t;
  IF v_ids IS NULL THEN RAISE EXCEPTION 'lote não encontrado'; END IF;

  SELECT empresa_id INTO v_empresa_id FROM public.contratos WHERE id = v_contrato_id;
  IF v_empresa_id IS NULL OR NOT public.is_empresa_member(auth.uid(), v_empresa_id) THEN
    RAISE EXCEPTION 'sem acesso a este contrato';
  END IF;

  FOR r IN SELECT id, descricao FROM public.contrato_pedidos WHERE id = ANY(v_ids) ORDER BY id LOOP
    v_resto := CASE WHEN position(' · ' IN coalesce(r.descricao, '')) > 0
                    THEN substring(r.descricao FROM position(' · ' IN r.descricao) + 3) ELSE '' END;
    UPDATE public.contrato_pedidos SET
      nota_fiscal        = CASE WHEN p_campos ? 'nota_fiscal'        THEN nullif(p_campos->>'nota_fiscal', '')        ELSE nota_fiscal END,
      data_pedido        = CASE WHEN p_campos ? 'data_pedido'        THEN nullif(p_campos->>'data_pedido', '')::date  ELSE data_pedido END,
      data_entrega       = CASE WHEN p_campos ? 'data_entrega'       THEN nullif(p_campos->>'data_entrega', '')::date ELSE data_entrega END,
      status             = CASE WHEN p_campos ? 'status'             THEN p_campos->>'status'                          ELSE status END,
      empenho_id         = CASE WHEN p_campos ? 'empenho_id'         THEN nullif(p_campos->>'empenho_id', '')::uuid   ELSE empenho_id END,
      numero_empenho     = CASE WHEN p_campos ? 'numero_empenho'     THEN nullif(p_campos->>'numero_empenho', '')     ELSE numero_empenho END,
      tipo_empenho       = CASE WHEN p_campos ? 'tipo_empenho'       THEN nullif(p_campos->>'tipo_empenho', '')       ELSE tipo_empenho END,
      unidade_composta   = CASE WHEN p_campos ? 'unidade_composta'   THEN nullif(p_campos->>'unidade_composta', '')   ELSE unidade_composta END,
      unidades_compostas = CASE WHEN p_campos ? 'unidades_compostas' THEN nullif(p_campos->>'unidades_compostas', '')::numeric ELSE unidades_compostas END,
      observacoes        = CASE WHEN p_campos ? 'observacoes'        THEN nullif(p_campos->>'observacoes', '')        ELSE observacoes END,
      descricao          = CASE WHEN p_descricao IS NOT NULL AND length(trim(p_descricao)) > 0
                                THEN CASE WHEN v_resto <> '' THEN trim(p_descricao) || ' · ' || v_resto ELSE trim(p_descricao) END
                                ELSE descricao END,
      updated_at         = now()
    WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('partes_atualizadas', v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.editar_lote_de_pedidos(uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.editar_lote_de_pedidos(uuid, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.editar_lote_de_pedidos(uuid, jsonb, text) IS
  'Edita todas as partes de um lote numa transação, em ordem fixa (sem deadlock); p_descricao renomeia o prefixo preservando o item de cada parte.';
