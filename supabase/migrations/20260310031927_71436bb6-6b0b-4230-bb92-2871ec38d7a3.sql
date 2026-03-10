
ALTER TABLE public.whatsapp_preferencias 
  ADD COLUMN IF NOT EXISTS telefone_licitacoes text,
  ADD COLUMN IF NOT EXISTS telefone_juridico text,
  ADD COLUMN IF NOT EXISTS telefone_financeiro text,
  ADD COLUMN IF NOT EXISTS telefone_documentos text;
