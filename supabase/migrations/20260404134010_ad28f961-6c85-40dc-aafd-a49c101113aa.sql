-- Criar pncp_sync_log se não existir
CREATE TABLE IF NOT EXISTS public.pncp_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento INT,
  ufs_processadas TEXT[],
  data_consultada TEXT,
  modalidade_id INT,
  total_registros INT DEFAULT 0,
  novos INT DEFAULT 0,
  erros INT DEFAULT 0,
  status TEXT DEFAULT 'em_andamento',
  iniciado_em TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  duracao_ms INT,
  fonte TEXT DEFAULT 'pncp',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pncp_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pncp_sync_log"
ON public.pncp_sync_log FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read sync log"
ON public.pncp_sync_log FOR SELECT
TO authenticated
USING (true);

-- Adaptar pncp_editais_cache para multi-fonte
ALTER TABLE pncp_editais_cache
ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'pncp',
ADD COLUMN IF NOT EXISTS fonte_id TEXT,
ADD COLUMN IF NOT EXISTS uasg_codigo TEXT,
ADD COLUMN IF NOT EXISTS uasg_nome TEXT,
ADD COLUMN IF NOT EXISTS lei_base TEXT DEFAULT '14133',
ADD COLUMN IF NOT EXISTS link_comprasnet TEXT;

-- Chave de deduplicação multi-fonte
CREATE UNIQUE INDEX IF NOT EXISTS idx_editais_cache_fonte_id
ON pncp_editais_cache(fonte, fonte_id)
WHERE fonte_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_editais_cache_uasg
ON pncp_editais_cache(uasg_codigo)
WHERE uasg_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_editais_cache_lei_base
ON pncp_editais_cache(lei_base, data_publicacao_pncp DESC);

-- View de cobertura por fonte
CREATE OR REPLACE VIEW vw_editais_por_fonte AS
SELECT
  fonte,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE data_publicacao_pncp::date = CURRENT_DATE) AS novos_hoje,
  MAX(data_publicacao_pncp) AS ultima_publicacao
FROM pncp_editais_cache
GROUP BY fonte;