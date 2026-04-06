
-- Portais monitorados pelo sistema
CREATE TABLE IF NOT EXISTS public.portais_monitorados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  url_base      TEXT NOT NULL,
  tipo          TEXT NOT NULL DEFAULT 'api',
  uf            TEXT,
  endpoint_api  TEXT,
  xpath_lista   TEXT,
  ativo         BOOLEAN DEFAULT true,
  intervalo_min INTEGER DEFAULT 360,
  ultima_coleta TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.portais_monitorados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage portais" ON public.portais_monitorados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view portais" ON public.portais_monitorados
  FOR SELECT TO authenticated
  USING (true);

-- Editais coletados pelos scrapers
CREATE TABLE IF NOT EXISTS public.editais_coletados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id         UUID REFERENCES public.portais_monitorados(id),
  identificador_ext TEXT NOT NULL UNIQUE,
  modalidade        TEXT,
  numero            TEXT,
  orgao             TEXT NOT NULL,
  uf                TEXT,
  municipio         TEXT,
  objeto            TEXT NOT NULL,
  valor_estimado    DECIMAL(15,2),
  data_abertura     TIMESTAMPTZ,
  data_publicacao   TIMESTAMPTZ,
  url_edital        TEXT,
  url_pdf           TEXT,
  pdf_storage_path  TEXT,
  segmento_codigo   TEXT,
  segmento_nome     TEXT,
  palavras_chave    TEXT[],
  distribuido       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.editais_coletados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage editais_coletados" ON public.editais_coletados
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view editais_coletados" ON public.editais_coletados
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_editais_distribuido
  ON public.editais_coletados (distribuido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editais_segmento_uf
  ON public.editais_coletados (segmento_codigo, uf, data_abertura DESC);

-- Distribuições realizadas
CREATE TABLE IF NOT EXISTS public.distribuicoes_realizadas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id     UUID REFERENCES public.editais_coletados(id),
  user_id       UUID NOT NULL,
  canal         TEXT NOT NULL DEFAULT 'email',
  status        TEXT NOT NULL DEFAULT 'pendente',
  wamid         TEXT,
  tentativas    INTEGER DEFAULT 1,
  erro          TEXT,
  enviado_em    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.distribuicoes_realizadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own distribuicoes" ON public.distribuicoes_realizadas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all distribuicoes" ON public.distribuicoes_realizadas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for public PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-publicos', 'documentos-publicos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read documentos-publicos" ON storage.objects
  FOR SELECT USING (bucket_id = 'documentos-publicos');

CREATE POLICY "Service role can upload documentos-publicos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documentos-publicos');

-- Seed initial portais
INSERT INTO public.portais_monitorados (nome, url_base, tipo, uf, endpoint_api, intervalo_min)
VALUES
  ('PNCP Federal',        'https://pncp.gov.br',            'api',      NULL, 'https://pncp.gov.br/api/pncp/v1/orgaos/compras', 360),
  ('TCM-PA Mural',        'https://www.tcm.pa.gov.br',      'scraping', 'PA', 'https://www.tcm.pa.gov.br/mural-de-licitacoes/', 120),
  ('Licitanet',           'https://www.licitanet.com.br',   'rss',      NULL, 'https://www.licitanet.com.br/feed/rss', 180),
  ('BLL',                 'https://bll.org.br',             'api',      NULL, 'https://bll.org.br/api/v1/licitacoes', 240),
  ('BanParaNet',          'https://www.banparanet.com.br',  'scraping', 'PA', 'https://www.banparanet.com.br/licitacoes', 180),
  ('ComprasNet Federal',  'https://compras.dados.gov.br',   'api',      NULL, 'https://compras.dados.gov.br/licitacoes/v1/licitacoes.json', 360),
  ('Querido Diário',      'https://queridodiario.ok.org.br','api',      NULL, 'https://queridodiario.ok.org.br/api/gazettes', 360),
  ('Compras PA',          'https://compras.pa.gov.br',      'scraping', 'PA', 'https://compras.pa.gov.br/licitacoes', 180)
ON CONFLICT DO NOTHING;
