-- Trocar embeddings de 768 dims (Google) para 1536 dims (OpenAI text-embedding-3-small)
-- Como ainda não há embeddings populados, é seguro recriar a coluna

DROP INDEX IF EXISTS public.pncp_editais_cache_embedding_idx;

ALTER TABLE public.pncp_editais_cache
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE public.pncp_editais_cache
  ADD COLUMN embedding extensions.vector(1536);

-- Recriar índice HNSW para cosine similarity
CREATE INDEX pncp_editais_cache_embedding_idx
  ON public.pncp_editais_cache
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Atualizar RPC de busca semântica para 1536 dims
CREATE OR REPLACE FUNCTION public.busca_editais_semantica(
  p_embedding extensions.vector(1536),
  p_limite integer DEFAULT 20,
  p_similaridade_min real DEFAULT 0.3,
  p_uf text DEFAULT NULL,
  p_apenas_abertos boolean DEFAULT true,
  p_modalidade_id integer DEFAULT NULL
)
RETURNS TABLE(
  id uuid, pncp_id text, numero_controle_pncp text, orgao text, objeto text,
  modalidade_nome text, uf text, municipio text, valor_total_estimado numeric,
  data_publicacao_pncp timestamp with time zone,
  data_encerramento_proposta timestamp with time zone,
  url_pncp text, link_sistema_origem text, similaridade real
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;