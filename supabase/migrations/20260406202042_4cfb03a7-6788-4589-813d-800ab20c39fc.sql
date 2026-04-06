
-- Add segment and UF filtering preferences to boletim_preferencias
ALTER TABLE public.boletim_preferencias 
  ADD COLUMN IF NOT EXISTS segmentos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ufs_interesse text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS filtrar_alteracoes_por_cnpj boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS filtrar_resultados_por_participacao boolean DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.boletim_preferencias.segmentos IS 'Segmentos de interesse do usuário para filtragem de boletins (ex: generos_alimenticios, informatica, etc)';
COMMENT ON COLUMN public.boletim_preferencias.ufs_interesse IS 'UFs de interesse para filtragem geográfica dos boletins';
COMMENT ON COLUMN public.boletim_preferencias.filtrar_alteracoes_por_cnpj IS 'Filtrar boletim meio-dia por CNPJ/razão social da empresa';
COMMENT ON COLUMN public.boletim_preferencias.filtrar_resultados_por_participacao IS 'Filtrar boletim tarde apenas por processos em que o cliente participou';
