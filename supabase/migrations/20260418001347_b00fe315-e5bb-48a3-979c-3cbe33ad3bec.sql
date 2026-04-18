ALTER TABLE public.pncp_sync_log
  ADD COLUMN IF NOT EXISTS modo text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS data_referencia date,
  ADD COLUMN IF NOT EXISTS atualizados integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modalidades_processadas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paginas_consumidas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS erro text,
  ADD COLUMN IF NOT EXISTS detalhes jsonb DEFAULT '{}'::jsonb;

-- Compatibiliza ufs_processadas (ARRAY) → o novo código grava integer.
-- Como nomes conflitam mas tipos diferem, criamos coluna alternativa que o código lerá:
ALTER TABLE public.pncp_sync_log
  ADD COLUMN IF NOT EXISTS ufs_processadas_count integer DEFAULT 0;