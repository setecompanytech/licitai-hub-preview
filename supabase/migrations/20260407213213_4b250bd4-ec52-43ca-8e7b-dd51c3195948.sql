
-- 1. Fix search_path on atualizar_objeto_tsv
ALTER FUNCTION public.atualizar_objeto_tsv() SET search_path = public;

-- 2. Fix search_path on busca_editais_instantanea
ALTER FUNCTION public.busca_editais_instantanea(text, text, text, text, integer, text, date, date, text, text, integer, integer) SET search_path = public;

-- 3. Move vector extension out of public schema
ALTER EXTENSION vector SET SCHEMA extensions;
