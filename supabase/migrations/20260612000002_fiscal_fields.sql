-- Dados fiscais do fornecedor (extraídos automaticamente do XML da NF-e)
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS regime_tributario  text,
  ADD COLUMN IF NOT EXISTS uf                 text,
  ADD COLUMN IF NOT EXISTS municipio          text,
  ADD COLUMN IF NOT EXISTS cep                text,
  ADD COLUMN IF NOT EXISTS logradouro         text,
  ADD COLUMN IF NOT EXISTS numero_endereco    text,
  ADD COLUMN IF NOT EXISTS bairro             text;

-- Dados fiscais do produto (extraídos automaticamente do XML da NF-e)
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm        text,
  ADD COLUMN IF NOT EXISTS cfop       text,
  ADD COLUMN IF NOT EXISTS cst_icms   text,
  ADD COLUMN IF NOT EXISTS csosn      text,
  ADD COLUMN IF NOT EXISTS cst_pis    text,
  ADD COLUMN IF NOT EXISTS cst_cofins text,
  ADD COLUMN IF NOT EXISTS p_icms     numeric,
  ADD COLUMN IF NOT EXISTS p_pis      numeric,
  ADD COLUMN IF NOT EXISTS p_cofins   numeric;
