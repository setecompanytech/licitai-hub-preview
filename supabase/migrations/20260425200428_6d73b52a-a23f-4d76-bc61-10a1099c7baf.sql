
CREATE TABLE public.sefaz_homologacoes_municipais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf text NOT NULL,
  codigo_ibge text NOT NULL UNIQUE,
  municipio text NOT NULL,
  padrao_nfse text NOT NULL,
  endpoint_producao text,
  endpoint_homologacao text,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('homologado','em_homologacao','pendente','indisponivel')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sefaz_homol_uf ON public.sefaz_homologacoes_municipais(uf);
CREATE INDEX idx_sefaz_homol_status ON public.sefaz_homologacoes_municipais(status);
ALTER TABLE public.sefaz_homologacoes_municipais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read homologacoes"
ON public.sefaz_homologacoes_municipais FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sefaz_consultas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cnpj text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('nfe','nfse')),
  municipio_codigo text,
  competencia_inicio date,
  competencia_fim date,
  status text NOT NULL CHECK (status IN ('sucesso','parcial','erro','nao_configurado')),
  notas_encontradas integer DEFAULT 0,
  notas_importadas integer DEFAULT 0,
  notas_duplicadas integer DEFAULT 0,
  duracao_ms integer,
  erro_mensagem text,
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sefaz_log_empresa ON public.sefaz_consultas_log(empresa_id, created_at DESC);
ALTER TABLE public.sefaz_consultas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see empresa logs"
ON public.sefaz_consultas_log FOR SELECT TO authenticated
USING (empresa_id IN (SELECT empresa_id FROM public.empresa_membros WHERE user_id = auth.uid()));

CREATE POLICY "Members insert empresa logs"
ON public.sefaz_consultas_log FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND empresa_id IN (SELECT empresa_id FROM public.empresa_membros WHERE user_id = auth.uid())
);

INSERT INTO public.sefaz_homologacoes_municipais (uf, codigo_ibge, municipio, padrao_nfse, status, observacoes) VALUES
('SP','3550308','São Paulo','sao_paulo_proprio','homologado','Padrão próprio PMSP — requer certificado A1'),
('RJ','3304557','Rio de Janeiro','carioca_digital','homologado','Carioca Digital / NotaCarioca'),
('MG','3106200','Belo Horizonte','bhiss','homologado','BHISS Digital'),
('DF','5300108','Brasília','iss_df','em_homologacao','SIGISS-DF'),
('PR','4106902','Curitiba','iss_curitiba','em_homologacao','ISS Curitiba'),
('RS','4314902','Porto Alegre','dec_poa','em_homologacao','DEC Porto Alegre'),
('SC','4205407','Florianópolis','abrasf','em_homologacao','Padrão ABRASF 2.04'),
('BA','2927408','Salvador','abrasf','pendente','Padrão ABRASF'),
('PE','2611606','Recife','iss_recife','pendente','ISS.Recife'),
('CE','2304400','Fortaleza','iss_fortaleza','pendente','ISSFortaleza'),
('GO','5208707','Goiânia','abrasf','pendente','Padrão ABRASF'),
('AM','1302603','Manaus','abrasf','pendente','Padrão ABRASF');
