
CREATE TABLE IF NOT EXISTS public.financeiro_exclusao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  user_id uuid,
  pessoa_id uuid NOT NULL,
  pessoa_nome text,
  pessoa_documento text,
  pessoa_tipo text,
  motivo text,
  resultado text NOT NULL CHECK (resultado IN ('sucesso','bloqueado','erro')),
  dependencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_excl_log_empresa ON public.financeiro_exclusao_log(empresa_id, created_at DESC);
ALTER TABLE public.financeiro_exclusao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read empresa exclusao log" ON public.financeiro_exclusao_log;
CREATE POLICY "Members read empresa exclusao log"
ON public.financeiro_exclusao_log FOR SELECT TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.empresa_membros WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.try_delete_financeiro_pessoa(
  p_pessoa_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa public.financeiro_pessoas%ROWTYPE;
  v_uid uuid := auth.uid();
  v_lanc int := 0; v_doc int := 0; v_reg int := 0;
  v_folha int := 0; v_comr int := 0; v_comc int := 0;
  v_total int := 0; v_deps jsonb;
BEGIN
  SELECT * INTO v_pessoa FROM public.financeiro_pessoas WHERE id = p_pessoa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa não encontrada' USING ERRCODE = 'P0002'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresa_membros WHERE user_id = v_uid AND empresa_id = v_pessoa.empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_lanc FROM public.financeiro_lancamentos WHERE pessoa_id = p_pessoa_id;
  SELECT count(*) INTO v_doc FROM public.financeiro_documentos_fiscais WHERE emissor_id = p_pessoa_id OR destinatario_id = p_pessoa_id;
  SELECT count(*) INTO v_reg FROM public.financeiro_regras_categorizacao WHERE pessoa_id = p_pessoa_id;
  SELECT count(*) INTO v_folha FROM public.financeiro_folha_itens WHERE funcionario_id = p_pessoa_id;
  SELECT count(*) INTO v_comr FROM public.financeiro_comissoes_regras WHERE pessoa_id = p_pessoa_id;
  SELECT count(*) INTO v_comc FROM public.financeiro_comissoes_calculadas WHERE pessoa_id = p_pessoa_id;
  v_total := v_lanc + v_doc + v_reg + v_folha + v_comr + v_comc;

  v_deps := jsonb_build_object(
    'lancamentos', v_lanc, 'documentos_fiscais', v_doc,
    'regras_categorizacao', v_reg, 'folha_itens', v_folha,
    'comissoes_regras', v_comr, 'comissoes_calculadas', v_comc, 'total', v_total
  );

  IF v_total > 0 THEN
    INSERT INTO public.financeiro_exclusao_log
      (empresa_id, user_id, pessoa_id, pessoa_nome, pessoa_documento, pessoa_tipo, motivo, resultado, dependencias, erro_mensagem)
    VALUES
      (v_pessoa.empresa_id, v_uid, p_pessoa_id, v_pessoa.nome, v_pessoa.documento, v_pessoa.tipo, p_motivo, 'bloqueado', v_deps,
       format('Exclusão bloqueada: %s registros vinculados.', v_total));
    RETURN jsonb_build_object('ok', false, 'bloqueado', true, 'dependencias', v_deps);
  END IF;

  BEGIN
    DELETE FROM public.financeiro_pessoas WHERE id = p_pessoa_id;
    INSERT INTO public.financeiro_exclusao_log
      (empresa_id, user_id, pessoa_id, pessoa_nome, pessoa_documento, pessoa_tipo, motivo, resultado, dependencias)
    VALUES
      (v_pessoa.empresa_id, v_uid, p_pessoa_id, v_pessoa.nome, v_pessoa.documento, v_pessoa.tipo, p_motivo, 'sucesso', v_deps);
    RETURN jsonb_build_object('ok', true, 'dependencias', v_deps);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.financeiro_exclusao_log
      (empresa_id, user_id, pessoa_id, pessoa_nome, pessoa_documento, pessoa_tipo, motivo, resultado, dependencias, erro_mensagem)
    VALUES
      (v_pessoa.empresa_id, v_uid, p_pessoa_id, v_pessoa.nome, v_pessoa.documento, v_pessoa.tipo, p_motivo, 'erro', v_deps, SQLERRM);
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_delete_financeiro_pessoa(uuid, text) TO authenticated;
