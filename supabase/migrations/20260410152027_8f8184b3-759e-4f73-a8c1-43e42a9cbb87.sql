
-- Add origem_aditivo_id to contrato_itens
ALTER TABLE public.contrato_itens
ADD COLUMN origem_aditivo_id UUID REFERENCES public.contrato_aditivos(id) ON DELETE SET NULL DEFAULT NULL;

-- Add origem_aditivo_id to contrato_pedidos
ALTER TABLE public.contrato_pedidos
ADD COLUMN origem_aditivo_id UUID REFERENCES public.contrato_aditivos(id) ON DELETE SET NULL DEFAULT NULL;

-- Index for performance
CREATE INDEX idx_contrato_itens_origem_aditivo ON public.contrato_itens(origem_aditivo_id);
CREATE INDEX idx_contrato_pedidos_origem_aditivo ON public.contrato_pedidos(origem_aditivo_id);
