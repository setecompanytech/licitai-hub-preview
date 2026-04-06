
ALTER TABLE public.documentos 
  ADD COLUMN IF NOT EXISTS segmento text,
  ADD COLUMN IF NOT EXISTS dados_extraidos jsonb;

COMMENT ON COLUMN public.documentos.segmento IS 'Segmento do atestado de capacidade técnica (ex: alimentos, informatica, limpeza)';
COMMENT ON COLUMN public.documentos.dados_extraidos IS 'Dados extraídos pela IA: objeto, orgao_emissor, valor, cnpj_contratante, etc.';
