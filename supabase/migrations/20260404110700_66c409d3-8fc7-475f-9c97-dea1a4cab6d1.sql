
-- Índice trigram no orgão (campo correto é 'orgao')
CREATE INDEX IF NOT EXISTS idx_pncp_cache_orgao_trgm
  ON public.pncp_editais_cache USING gin(orgao gin_trgm_ops);

-- Habilitar Realtime na tabela de cache para UI instantânea
ALTER PUBLICATION supabase_realtime ADD TABLE public.pncp_editais_cache;
