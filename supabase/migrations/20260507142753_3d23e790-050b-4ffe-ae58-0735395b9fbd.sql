
ALTER TABLE public.financeiro_pessoas
  ADD COLUMN IF NOT EXISTS origem_tipo public.financeiro_origem_tipo,
  ADD COLUMN IF NOT EXISTS origem_lote_id uuid,
  ADD COLUMN IF NOT EXISTS origem_job text,
  ADD COLUMN IF NOT EXISTS origem_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS origem_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS origem_metadata jsonb;
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS origem_tipo public.financeiro_origem_tipo,
  ADD COLUMN IF NOT EXISTS origem_lote_id uuid,
  ADD COLUMN IF NOT EXISTS origem_job text,
  ADD COLUMN IF NOT EXISTS origem_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS origem_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS origem_metadata jsonb;
ALTER TABLE public.financeiro_documentos_fiscais
  ADD COLUMN IF NOT EXISTS origem_tipo public.financeiro_origem_tipo,
  ADD COLUMN IF NOT EXISTS origem_lote_id uuid,
  ADD COLUMN IF NOT EXISTS origem_job text,
  ADD COLUMN IF NOT EXISTS origem_usuario_id uuid,
  ADD COLUMN IF NOT EXISTS origem_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS origem_metadata jsonb;
CREATE INDEX IF NOT EXISTS idx_fin_pessoas_origem_lote ON public.financeiro_pessoas(origem_lote_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem_lote ON public.financeiro_lancamentos(origem_lote_id);
CREATE INDEX IF NOT EXISTS idx_fin_docfis_origem_lote ON public.financeiro_documentos_fiscais(origem_lote_id);
