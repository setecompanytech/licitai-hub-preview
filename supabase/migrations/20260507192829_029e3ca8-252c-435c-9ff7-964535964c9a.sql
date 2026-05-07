
-- Corrige nome da coluna (dados_antes, não dados_anteriores)
CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_por_id_v2(p_batch int DEFAULT 5000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos int := 0;
BEGIN
  WITH faltantes AS (
    SELECT a.registro_id
    FROM public.financeiro_audit_log a
    WHERE a.tabela = 'financeiro_lancamentos'
      AND a.operacao = 'DELETE'
      AND a.registro_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id = a.registro_id
      )
    GROUP BY a.registro_id
    LIMIT p_batch
  ),
  snapshot AS (
    SELECT f.registro_id, s.dados_antes
    FROM faltantes f
    CROSS JOIN LATERAL (
      SELECT a.dados_antes
      FROM public.financeiro_audit_log a
      WHERE a.tabela = 'financeiro_lancamentos'
        AND a.operacao = 'DELETE'
        AND a.registro_id = f.registro_id
        AND a.dados_antes IS NOT NULL
      ORDER BY a.created_at DESC
      LIMIT 1
    ) s
  ),
  inseridos AS (
    INSERT INTO public.financeiro_lancamentos
    SELECT * FROM jsonb_populate_recordset(
      NULL::public.financeiro_lancamentos,
      COALESCE((SELECT jsonb_agg(s.dados_antes) FROM snapshot s), '[]'::jsonb)
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inseridos FROM inseridos;

  RETURN COALESCE(v_inseridos, 0);
END;
$$;

-- Orquestrador: roda em loop até esgotar, retorna relatório
CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_completo(
  p_batch int DEFAULT 5000,
  p_max_loops int DEFAULT 200
)
RETURNS TABLE(total_restaurado int, lotes int, duracao_segundos numeric, restantes int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_lote int;
  v_loops int := 0;
  v_inicio timestamptz := clock_timestamp();
  v_restantes int;
BEGIN
  LOOP
    v_lote := public.restaurar_lancamentos_por_id_v2(p_batch);
    v_total := v_total + v_lote;
    v_loops := v_loops + 1;
    EXIT WHEN v_lote = 0 OR v_loops >= p_max_loops;
  END LOOP;

  SELECT count(*) INTO v_restantes
  FROM public.financeiro_audit_log a
  WHERE a.tabela = 'financeiro_lancamentos'
    AND a.operacao = 'DELETE'
    AND a.registro_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id = a.registro_id);

  RETURN QUERY SELECT
    v_total,
    v_loops,
    EXTRACT(EPOCH FROM (clock_timestamp() - v_inicio))::numeric,
    (SELECT count(DISTINCT registro_id)::int FROM public.financeiro_audit_log a
       WHERE a.tabela='financeiro_lancamentos' AND a.operacao='DELETE' AND a.registro_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id=a.registro_id));
END;
$$;
