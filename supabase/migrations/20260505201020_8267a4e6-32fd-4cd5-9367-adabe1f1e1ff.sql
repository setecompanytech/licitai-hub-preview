ALTER TABLE public.financeiro_extrato_movimentos
  ADD COLUMN IF NOT EXISTS ignorado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignorado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ignorado_motivo text;

CREATE INDEX IF NOT EXISTS idx_fem_empresa_ignorado
  ON public.financeiro_extrato_movimentos (empresa_id, ignorado)
  WHERE ignorado = true;