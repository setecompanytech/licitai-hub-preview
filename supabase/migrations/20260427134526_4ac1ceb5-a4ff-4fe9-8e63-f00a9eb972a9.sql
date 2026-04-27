-- 1) Cria índice único composto (fonte, fonte_id) — necessário para o upsert do pncp-sync-diario
CREATE UNIQUE INDEX IF NOT EXISTS pncp_editais_cache_fonte_fonte_id_uidx
  ON public.pncp_editais_cache (fonte, fonte_id)
  WHERE fonte IS NOT NULL AND fonte_id IS NOT NULL;

-- 2) Substitui o UNIQUE global de pncp_id por um UNIQUE parcial restrito à fonte oficial PNCP
ALTER TABLE public.pncp_editais_cache
  DROP CONSTRAINT IF EXISTS pncp_editais_cache_pncp_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS pncp_editais_cache_pncp_id_pncp_uidx
  ON public.pncp_editais_cache (pncp_id)
  WHERE fonte = 'PNCP';

-- 3) Garante índice de busca por pncp_id (não único) para joins e lookups de outras fontes
CREATE INDEX IF NOT EXISTS pncp_editais_cache_pncp_id_idx
  ON public.pncp_editais_cache (pncp_id);