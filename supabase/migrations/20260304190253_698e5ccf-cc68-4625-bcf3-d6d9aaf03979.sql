
ALTER TABLE public.empresas 
  ADD COLUMN IF NOT EXISTS rep_nome text,
  ADD COLUMN IF NOT EXISTS rep_cpf text,
  ADD COLUMN IF NOT EXISTS rep_rg text,
  ADD COLUMN IF NOT EXISTS rep_orgao_expedidor text,
  ADD COLUMN IF NOT EXISTS rep_cargo text,
  ADD COLUMN IF NOT EXISTS rep_naturalidade text,
  ADD COLUMN IF NOT EXISTS rep_nacionalidade text DEFAULT 'Brasileira';
