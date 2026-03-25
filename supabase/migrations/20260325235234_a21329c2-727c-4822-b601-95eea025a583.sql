CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.pncp_editais_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pncp_id TEXT UNIQUE NOT NULL,
  numero_controle_pncp TEXT,
  cnpj_orgao TEXT,
  ano_compra TEXT,
  sequencial_compra TEXT,
  numero_compra TEXT,
  orgao TEXT,
  unidade_orgao TEXT,
  objeto TEXT,
  modalidade_id INTEGER,
  modalidade_nome TEXT,
  situacao TEXT,
  valor_total_estimado NUMERIC,
  valor_total_homologado NUMERIC,
  uf TEXT,
  municipio TEXT,
  municipio_ibge TEXT,
  esfera_id TEXT,
  data_publicacao_pncp TIMESTAMPTZ,
  data_abertura_proposta TIMESTAMPTZ,
  data_encerramento_proposta TIMESTAMPTZ,
  link_sistema_origem TEXT,
  url_pncp TEXT,
  tipo_instrumento TEXT,
  srp BOOLEAN,
  codigo_unidade TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_uf ON public.pncp_editais_cache (uf);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_modalidade ON public.pncp_editais_cache (modalidade_id);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_municipio ON public.pncp_editais_cache (municipio);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_data_pub ON public.pncp_editais_cache (data_publicacao_pncp);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_data_abertura ON public.pncp_editais_cache (data_abertura_proposta);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_situacao ON public.pncp_editais_cache (situacao);
CREATE INDEX IF NOT EXISTS idx_pncp_cache_cnpj ON public.pncp_editais_cache (cnpj_orgao);

ALTER TABLE public.pncp_editais_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read pncp cache"
  ON public.pncp_editais_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_pncp_cache_updated_at
  BEFORE UPDATE ON public.pncp_editais_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();