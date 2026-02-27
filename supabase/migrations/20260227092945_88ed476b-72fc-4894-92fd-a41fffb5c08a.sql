-- Add Inscrição Municipal and Inscrição Estadual to empresas table
ALTER TABLE public.empresas
ADD COLUMN inscricao_municipal text,
ADD COLUMN inscricao_estadual text;