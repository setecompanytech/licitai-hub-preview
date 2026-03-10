
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS cabecalho_url text,
  ADD COLUMN IF NOT EXISTS cabecalho_path text,
  ADD COLUMN IF NOT EXISTS rodape_url text,
  ADD COLUMN IF NOT EXISTS rodape_path text;
