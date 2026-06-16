ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.fin_projetos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_departamento ON public.financeiro_lancamentos(departamento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_projeto_id ON public.financeiro_lancamentos(projeto_id);
