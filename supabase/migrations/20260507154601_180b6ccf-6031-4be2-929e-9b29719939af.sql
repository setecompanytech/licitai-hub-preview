
CREATE OR REPLACE FUNCTION public.cleanup_seed_impostos_27042026(p_limite int DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_marcados int := 0;
  v_excluidos int := 0;
  v_restantes int := 0;
BEGIN
  -- Marca para auditoria (idempotente)
  UPDATE public.financeiro_lancamentos
  SET origem_tipo = 'seed',
      origem_job = 'seed_27_04_2026_impostos_nfe',
      origem_timestamp = COALESCE(origem_timestamp, created_at)
  WHERE id IN (
    SELECT id FROM public.financeiro_lancamentos
    WHERE empresa_id = '726ae95d-bbce-47b0-b949-4b822459a085'
      AND created_at = '2026-04-27 02:20:53.340625+00'
      AND (descricao LIKE 'ISS s/ NFE-%' OR descricao LIKE 'PIS/COFINS s/ NFE-%')
      AND origem_tipo IS NULL
    LIMIT p_limite
  );
  GET DIAGNOSTICS v_marcados = ROW_COUNT;

  -- Exclui em lote
  WITH alvo AS (
    SELECT id FROM public.financeiro_lancamentos
    WHERE empresa_id = '726ae95d-bbce-47b0-b949-4b822459a085'
      AND created_at = '2026-04-27 02:20:53.340625+00'
      AND (descricao LIKE 'ISS s/ NFE-%' OR descricao LIKE 'PIS/COFINS s/ NFE-%')
    LIMIT p_limite
  )
  DELETE FROM public.financeiro_lancamentos l USING alvo
  WHERE l.id = alvo.id;
  GET DIAGNOSTICS v_excluidos = ROW_COUNT;

  SELECT count(*) INTO v_restantes FROM public.financeiro_lancamentos
  WHERE empresa_id = '726ae95d-bbce-47b0-b949-4b822459a085'
    AND created_at = '2026-04-27 02:20:53.340625+00'
    AND (descricao LIKE 'ISS s/ NFE-%' OR descricao LIKE 'PIS/COFINS s/ NFE-%');

  RETURN jsonb_build_object('marcados', v_marcados, 'excluidos', v_excluidos, 'restantes', v_restantes);
END;
$$;
