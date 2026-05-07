
-- Índice parcial focado nos DELETEs de financeiro_lancamentos
-- Acelera o lookup por (tabela, operacao) com ordenação por id e created_at
CREATE INDEX IF NOT EXISTS idx_fin_audit_delete_lookup
  ON public.financeiro_audit_log (registro_id, created_at DESC)
  WHERE tabela = 'financeiro_lancamentos' AND operacao = 'DELETE';

-- Índice de apoio: já existir no id da linha (evita rescans)
CREATE INDEX IF NOT EXISTS idx_fin_lanc_id_only
  ON public.financeiro_lancamentos (id);

-- Nova função: restaura por blocos sem DISTINCT ON global
-- Estratégia:
--   1. Pega um lote de registro_id distintos que ainda NÃO existem em financeiro_lancamentos
--   2. Para cada um, pega o snapshot mais recente (LATERAL + ORDER BY created_at DESC LIMIT 1)
--   3. INSERT ... ON CONFLICT (id) DO NOTHING (idempotente)
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
    SELECT DISTINCT a.registro_id
    FROM public.financeiro_audit_log a
    WHERE a.tabela = 'financeiro_lancamentos'
      AND a.operacao = 'DELETE'
      AND a.registro_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id = a.registro_id
      )
    LIMIT p_batch
  ),
  snapshot AS (
    SELECT f.registro_id, s.dados_anteriores
    FROM faltantes f
    CROSS JOIN LATERAL (
      SELECT a.dados_anteriores
      FROM public.financeiro_audit_log a
      WHERE a.tabela = 'financeiro_lancamentos'
        AND a.operacao = 'DELETE'
        AND a.registro_id = f.registro_id
        AND a.dados_anteriores IS NOT NULL
      ORDER BY a.created_at DESC
      LIMIT 1
    ) s
  ),
  inseridos AS (
    INSERT INTO public.financeiro_lancamentos
    SELECT * FROM jsonb_populate_recordset(
      NULL::public.financeiro_lancamentos,
      (SELECT jsonb_agg(s.dados_anteriores) FROM snapshot s)
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inseridos FROM inseridos;

  RETURN COALESCE(v_inseridos, 0);
END;
$$;

COMMENT ON FUNCTION public.restaurar_lancamentos_por_id_v2(int) IS
  'Restauração otimizada de lançamentos a partir do audit log. Sem DISTINCT ON global; usa NOT EXISTS + LATERAL por lote. Idempotente via ON CONFLICT (id) DO NOTHING.';
