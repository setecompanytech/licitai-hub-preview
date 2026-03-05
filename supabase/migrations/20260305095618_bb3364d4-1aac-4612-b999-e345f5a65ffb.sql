
-- Add empresa_id to licitacoes for multi-empresa filtering
ALTER TABLE public.licitacoes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

-- Create index for fast filtering
CREATE INDEX idx_licitacoes_empresa_id ON public.licitacoes(empresa_id);
