
-- 1. Publication versioning: hash + version counter on pncp_editais_cache
ALTER TABLE public.pncp_editais_cache
  ADD COLUMN IF NOT EXISTS hash_objeto TEXT,
  ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS versao_anterior_hash TEXT,
  ADD COLUMN IF NOT EXISTS retificacao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_ultima_retificacao TIMESTAMPTZ;

-- 2. Alert dispatch tracking table
CREATE TABLE public.alerta_dispatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_alerta_id UUID NOT NULL REFERENCES public.perfis_alerta(id) ON DELETE CASCADE,
  licitacao_cache_id UUID NOT NULL REFERENCES public.pncp_editais_cache(id) ON DELETE CASCADE,
  canal TEXT NOT NULL DEFAULT 'sistema',
  status TEXT NOT NULL DEFAULT 'pendente',
  hash_enviado TEXT,
  versao_enviada INTEGER DEFAULT 1,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  lido_em TIMESTAMPTZ,
  UNIQUE(perfil_alerta_id, licitacao_cache_id, canal, versao_enviada)
);

ALTER TABLE public.alerta_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dispatches"
  ON public.alerta_dispatches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dispatches"
  ON public.alerta_dispatches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dispatches"
  ON public.alerta_dispatches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_alerta_dispatches_perfil ON public.alerta_dispatches(perfil_alerta_id, licitacao_cache_id);
CREATE INDEX idx_alerta_dispatches_user_status ON public.alerta_dispatches(user_id, status);
CREATE INDEX idx_alerta_dispatches_created ON public.alerta_dispatches(created_at DESC);

-- Index for hash-based change detection
CREATE INDEX idx_pncp_cache_hash ON public.pncp_editais_cache(hash_objeto) WHERE hash_objeto IS NOT NULL;

-- Enable realtime for dispatch tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerta_dispatches;
