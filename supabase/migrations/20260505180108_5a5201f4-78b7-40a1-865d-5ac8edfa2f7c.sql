CREATE OR REPLACE FUNCTION public.fin_sync_plano_contas_to_categorias(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridas int := 0;
  v_atualizadas int := 0;
  v_total_antes int;
  v_total_depois int;
BEGIN
  -- Autorização: membro da empresa ou admin
  IF NOT (
    public.is_empresa_member(auth.uid(), p_empresa_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar categorias desta empresa';
  END IF;

  SELECT COUNT(*) INTO v_total_antes FROM public.financeiro_categorias WHERE empresa_id = p_empresa_id;

  -- UPSERT por (empresa_id, codigo). Importa contas analíticas (nivel >= 2 e aceita_lancamentos)
  -- e também sintéticas de nivel 2 para servir de agrupamento visual.
  WITH src AS (
    SELECT
      pc.codigo,
      pc.nome,
      CASE
        WHEN pc.tipo LIKE 'receita%' THEN 'receita'::financeiro_natureza
        WHEN pc.tipo IN ('custo','custo_produto','despesa','despesa_operacional','despesa_financeira','imposto','deducoes_receita') THEN 'despesa'::financeiro_natureza
        ELSE 'movimentacao'::financeiro_natureza
      END AS natureza,
      pc.aceita_lancamentos AS permite_lancamento,
      pc.ativo AS ativa
    FROM public.fin_plano_contas pc
    WHERE (pc.empresa_id = p_empresa_id OR pc.empresa_id IS NULL)
      AND pc.ativo = true
      AND pc.nivel >= 2
  ),
  ins AS (
    INSERT INTO public.financeiro_categorias
      (empresa_id, codigo, nome, natureza, permite_lancamento, ativa)
    SELECT p_empresa_id, s.codigo, s.nome, s.natureza, s.permite_lancamento, s.ativa
    FROM src s
    ON CONFLICT (empresa_id, codigo) DO UPDATE
      SET nome = EXCLUDED.nome,
          natureza = EXCLUDED.natureza,
          permite_lancamento = EXCLUDED.permite_lancamento,
          ativa = EXCLUDED.ativa,
          updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inseridas, v_atualizadas
  FROM ins;

  SELECT COUNT(*) INTO v_total_depois FROM public.financeiro_categorias WHERE empresa_id = p_empresa_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'inseridas', v_inseridas,
    'atualizadas', v_atualizadas,
    'total_antes', v_total_antes,
    'total_depois', v_total_depois
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_sync_plano_contas_to_categorias(uuid) TO authenticated;