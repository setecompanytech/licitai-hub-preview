
-- Add vendedor_user_id to contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS vendedor_user_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contratos_vendedor ON public.contratos(vendedor_user_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_lancamentos_contrato ON public.comissoes_lancamentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_lancamentos_user ON public.comissoes_lancamentos(user_id);
