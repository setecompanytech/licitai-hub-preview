
ALTER TABLE public.empresa_membros
  ADD COLUMN IF NOT EXISTS login_individual TEXT,
  ADD COLUMN IF NOT EXISTS nome_individual TEXT,
  ADD COLUMN IF NOT EXISTS identificacao_completa BOOLEAN NOT NULL DEFAULT false;
