-- Adiciona colunas de coordenadas PNCP à tabela licitacoes
-- Necessário para que edital-auto-ingest encontre os arquivos do edital na API do PNCP
ALTER TABLE public.licitacoes
  ADD COLUMN IF NOT EXISTS cnpj_orgao TEXT,
  ADD COLUMN IF NOT EXISTS ano_compra TEXT,
  ADD COLUMN IF NOT EXISTS sequencial_compra TEXT,
  ADD COLUMN IF NOT EXISTS numero_controle_pncp TEXT;

CREATE INDEX IF NOT EXISTS idx_licitacoes_numero_controle_pncp
  ON public.licitacoes (numero_controle_pncp)
  WHERE numero_controle_pncp IS NOT NULL;
