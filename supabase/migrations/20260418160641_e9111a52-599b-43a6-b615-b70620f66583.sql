-- Fase 4: suporte a embeddings multi-provedor (Lovable Gemini 768 + OpenAI 1536)

-- 1) Coluna nova para embeddings 768d (Lovable AI / Gemini text-embedding-004)
ALTER TABLE public.pncp_editais_cache
  ADD COLUMN IF NOT EXISTS embedding_lovable extensions.vector(768),
  ADD COLUMN IF NOT EXISTS embedding_lovable_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_lovable_modelo TEXT;

-- 2) Índice ANN (IVFFLAT) para busca rápida em 768d
CREATE INDEX IF NOT EXISTS idx_pncp_embedding_lovable
  ON public.pncp_editais_cache
  USING ivfflat (embedding_lovable extensions.vector_cosine_ops)
  WITH (lists = 100);

-- 3) RPC: editais pendentes de embedding Lovable
CREATE OR REPLACE FUNCTION public.pncp_pendentes_embedding_lovable(p_limite int DEFAULT 100)
RETURNS TABLE(id uuid, texto_para_embedding text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
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
  WHERE embedding_lovable IS NULL
    AND objeto IS NOT NULL
    AND length(objeto) > 10
  ORDER BY data_publicacao_pncp DESC NULLS LAST
  LIMIT p_limite;
$$;

-- 4) RPC: busca semântica usando embedding_lovable
CREATE OR REPLACE FUNCTION public.busca_editais_semantica_lovable(
  p_embedding extensions.vector,
  p_limite int DEFAULT 20,
  p_similaridade_min real DEFAULT 0.3,
  p_uf text DEFAULT NULL,
  p_apenas_abertos boolean DEFAULT true,
  p_modalidade_id int DEFAULT NULL
)
RETURNS TABLE(
  id uuid, pncp_id text, numero_controle_pncp text, orgao text, objeto text,
  modalidade_nome text, uf text, municipio text, valor_total_estimado numeric,
  data_publicacao_pncp timestamptz, data_encerramento_proposta timestamptz,
  url_pncp text, link_sistema_origem text, similaridade real
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT
    e.id, e.pncp_id, e.numero_controle_pncp, e.orgao, e.objeto,
    e.modalidade_nome, e.uf, e.municipio, e.valor_total_estimado,
    e.data_publicacao_pncp, e.data_encerramento_proposta,
    e.url_pncp, e.link_sistema_origem,
    (1 - (e.embedding_lovable <=> p_embedding))::REAL AS similaridade
  FROM public.pncp_editais_cache e
  WHERE e.embedding_lovable IS NOT NULL
    AND (1 - (e.embedding_lovable <=> p_embedding)) >= p_similaridade_min
    AND (p_uf IS NULL OR e.uf = p_uf)
    AND (p_modalidade_id IS NULL OR e.modalidade_id = p_modalidade_id)
    AND (NOT p_apenas_abertos OR e.data_encerramento_proposta >= now())
  ORDER BY e.embedding_lovable <=> p_embedding
  LIMIT p_limite;
$$;

-- 5) Status combinado dos dois provedores
CREATE OR REPLACE FUNCTION public.pncp_status_embeddings_v2()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'total_editais', (SELECT count(*) FROM public.pncp_editais_cache),
    'openai', jsonb_build_object(
      'com_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NOT NULL),
      'sem_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NULL AND objeto IS NOT NULL),
      'modelo', 'text-embedding-3-small (1536d)'
    ),
    'lovable', jsonb_build_object(
      'com_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding_lovable IS NOT NULL),
      'sem_embedding', (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding_lovable IS NULL AND objeto IS NOT NULL),
      'modelo', 'google/text-embedding-004 (768d)'
    ),
    'cobertura_qualquer_pct', ROUND(
      100.0 * (SELECT count(*) FROM public.pncp_editais_cache WHERE embedding IS NOT NULL OR embedding_lovable IS NOT NULL)
      / NULLIF((SELECT count(*) FROM public.pncp_editais_cache WHERE objeto IS NOT NULL), 0), 1
    )
  );
$$;