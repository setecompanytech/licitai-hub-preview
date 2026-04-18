-- 1. Tabela de log de sincronização do PNCP (já consumida pelo frontend)
CREATE TABLE IF NOT EXISTS public.pncp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  status text NOT NULL DEFAULT 'em_andamento', -- 'em_andamento' | 'sucesso' | 'erro' | 'parcial'
  modo text NOT NULL DEFAULT 'diario_madrugada', -- 'diario_madrugada' | 'reforco_meio_dia' | 'manual'
  data_referencia date,
  novos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  total_registros integer NOT NULL DEFAULT 0,
  ufs_processadas integer NOT NULL DEFAULT 0,
  modalidades_processadas integer NOT NULL DEFAULT 0,
  paginas_consumidas integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  erro text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pncp_sync_log_status_data
  ON public.pncp_sync_log (status, concluido_em DESC NULLS LAST);

ALTER TABLE public.pncp_sync_log ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler o status (informação operacional, não sensível)
DROP POLICY IF EXISTS "auth_read_sync_log" ON public.pncp_sync_log;
CREATE POLICY "auth_read_sync_log" ON public.pncp_sync_log
  FOR SELECT TO authenticated USING (true);

-- Apenas service_role escreve (edge function)
DROP POLICY IF EXISTS "service_write_sync_log" ON public.pncp_sync_log;
CREATE POLICY "service_write_sync_log" ON public.pncp_sync_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Índices compostos para acelerar busca instantânea no cache
CREATE INDEX IF NOT EXISTS idx_pncp_cache_uf_data_pub
  ON public.pncp_editais_cache (uf, data_publicacao_pncp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_modalidade_data_pub
  ON public.pncp_editais_cache (modalidade_id, data_publicacao_pncp DESC NULLS LAST);

-- Índice parcial para "editais abertos" (consulta mais comum)
CREATE INDEX IF NOT EXISTS idx_pncp_cache_abertos
  ON public.pncp_editais_cache (data_encerramento_proposta)
  WHERE data_encerramento_proposta >= '2025-01-01'::timestamptz;

CREATE INDEX IF NOT EXISTS idx_pncp_cache_municipio_ibge
  ON public.pncp_editais_cache (municipio_ibge)
  WHERE municipio_ibge IS NOT NULL;

-- 3. Função utilitária: status resumido para o badge do frontend
CREATE OR REPLACE FUNCTION public.pncp_status_sincronizacao()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ultima_sync_sucesso', (
      SELECT concluido_em FROM public.pncp_sync_log
      WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1
    ),
    'ultima_sync_status', (
      SELECT status FROM public.pncp_sync_log
      ORDER BY iniciado_em DESC LIMIT 1
    ),
    'novos_ultima_sync', (
      SELECT novos FROM public.pncp_sync_log
      WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1
    ),
    'total_editais', (SELECT count(*) FROM public.pncp_editais_cache),
    'editais_abertos', (
      SELECT count(*) FROM public.pncp_editais_cache
      WHERE data_encerramento_proposta >= now()
    ),
    'minutos_desde_ultima_sync', (
      SELECT EXTRACT(EPOCH FROM (now() - concluido_em))/60
      FROM public.pncp_sync_log
      WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.pncp_status_sincronizacao() TO authenticated, anon;