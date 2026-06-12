-- Adiciona chave estrangeira de fornecedor na tabela de NF-e
-- Permite rastrear qual fornecedor emitiu cada nota, inclusive quando
-- o fornecedor é criado automaticamente durante a importação do XML.

ALTER TABLE public.nfe_recebidas
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nfe_fornecedor ON public.nfe_recebidas(fornecedor_id);
