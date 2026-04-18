-- 1) Garantir extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2) Adicionar colunas de embedding (qualificando o tipo)
ALTER TABLE public.pncp_editais_cache
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
  ADD COLUMN IF NOT EXISTS embedding_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_modelo TEXT;

-- 3) Índice HNSW para similaridade de cosseno
CREATE INDEX IF NOT EXISTS idx_pncp_editais_embedding_hnsw
  ON public.pncp_editais_cache
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4) Índice parcial para acelerar consulta de pendentes
CREATE INDEX IF NOT EXISTS idx_pncp_editais_sem_embedding
  ON public.pncp_editais_cache (created_at DESC)
  WHERE embedding IS NULL;

-- 5) Busca semântica (search_path inclui extensions)
CREATE OR REPLACE FUNCTION public.busca_editais_semantica(
  p_embedding extensions.vector(768),
  p_limite INTEGER DEFAULT 20,
  p_similaridade_min REAL DEFAULT 0.3,
  p_uf TEXT DEFAULT NULL,
  p_apenas_abertos BOOLEAN DEFAULT TRUE,
  p_modalidade_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  pncp_id TEXT,
  numero_controle_pncp TEXT,
  orgao TEXT,
  objeto TEXT,
  modalidade_nome TEXT,
  uf TEXT,
  municipio TEXT,
  valor_total_estimado NUMERIC,
  data_publicacao_pncp TIMESTAMPTZ,
  data_encerramento_proposta TIMESTAMPTZ,
  url_pncp TEXT,
  link_sistema_origem TEXT,
  similaridade REAL
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    e.id, e.pncp_id, e.numero_controle_pncp, e.orgao, e.objeto,
    e.modalidade_nome, e.uf, e.municipio, e.valor_total_estimado,
    e.data_publicacao_pncp, e.data_encerramento_proposta,
    e.url_pncp, e.link_sistema_origem,
    (1 - (e.embedding <=> p_embedding))::REAL AS similaridade
  FROM public.pncp_editais_cache e
  WHERE e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> p_embedding)) >= p_similaridade_min
    AND (p_uf IS NULL OR e.uf = p_uf)
    AND (p_modalidade_id IS NULL OR e.modalidade_id = p_modalidade_id)
    AND (NOT p_apenas_abertos OR e.data_encerramento_proposta >= now())
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_limite;
$$;

-- 6) Pendentes de embedding (para backfill)
CREATE OR REPLACE FUNCTION public.pncp_editais_pendentes_embedding(
  p_limite INTEGER DEFAULT 100
)
RETURNS TABLE (id UUID, texto_para_embedding TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    id,
    LEFT(
      COALESCE(objeto, '') || ' | ' ||
      COALESCE(orgao, '') || ' | ' ||
      COALESCE(modalidade_nome, '') || ' | ' ||
      COALESCE(municipio, '') || '/' || COALESCE(uf, ''),
      2000
    )
  FROM public.pncp_editais_cache
  WHERE embedding IS NULL
    AND objeto IS NOT NULL
    AND length(objeto) > 10
  ORDER BY data_publicacao_pncp DESC NULLS LAST
  LIMIT p_limite;
$$;

-- 7) Status do backfill
CREATE OR REPLACE FUNCTION public.pncp_status_embeddings()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT jsonb_build_object(
    'total_editais', (SELECT count(*) FROM public.pncp_editais_cache),
    'com_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NOT NULL),
    'sem_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NULL AND objeto IS NOT NULL),
    'cobertura_pct', ROUND(100.0 * (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NOT NULL) / NULLIF((SELECT count(*) FROM public.pncp_editais_cache WHERE objeto IS NOT NULL), 0), 1),
    'ultimo_modelo', (SELECT embedding_modelo FROM public.pncp_editais_cache WHERE embedding_modelo IS NOT NULL ORDER BY embedding_gerado_em DESC LIMIT 1),
    'ultima_geracao', (SELECT max(embedding_gerado_em) FROM public.pncp_editais_cache)
  );
$$;