-- =============================================================================
-- PRAEFECTUS — Módulo Financeiro V2 (adaptado ao schema user_id/empresa_id)
-- =============================================================================

-- 1. CERTIFICADOS DIGITAIS A1/A3 -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_certificados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  cnpj            text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('A1','A3')),
  arquivo_path    text,
  senha_cifrada   text,
  emissor         text,
  numero_serie    text,
  validade_de     date NOT NULL,
  validade_ate    date NOT NULL,
  ativo           boolean NOT NULL DEFAULT true,
  uso_padrao      boolean NOT NULL DEFAULT false,
  provedor        text,
  provedor_ref    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_cert_user_validade
  ON public.financeiro_certificados(user_id, validade_ate) WHERE ativo = true;

ALTER TABLE public.financeiro_certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns financeiro_certificados (select)"
  ON public.financeiro_certificados FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_certificados (insert)"
  ON public.financeiro_certificados FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_certificados (update)"
  ON public.financeiro_certificados FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_certificados (delete)"
  ON public.financeiro_certificados FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_fin_cert_updated_at
  BEFORE UPDATE ON public.financeiro_certificados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. NFES EMITIDAS -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.financeiro_status_nfe AS ENUM (
    'rascunho','em_processamento','autorizada','rejeitada',
    'cancelada','denegada','inutilizada','contingencia'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_nfes_emitidas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  modelo          text NOT NULL CHECK (modelo IN ('nfe','nfce','nfse','cte')),
  numero          int,
  serie           int NOT NULL DEFAULT 1,
  chave_acesso    text,
  protocolo       text,
  uuid_provedor   text NOT NULL,
  status          public.financeiro_status_nfe NOT NULL DEFAULT 'rascunho',
  motivo          text,
  ambiente        text NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  cfop            text,
  natureza_operacao text NOT NULL,
  finalidade      text NOT NULL DEFAULT '1',
  consumidor_final boolean DEFAULT true,
  presenca        text DEFAULT '9',
  data_emissao    timestamptz NOT NULL DEFAULT now(),
  data_saida      timestamptz,
  data_autorizacao timestamptz,
  destinatario_dados jsonb NOT NULL,
  itens           jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_produtos  numeric(15,2) NOT NULL DEFAULT 0,
  valor_servicos  numeric(15,2) NOT NULL DEFAULT 0,
  valor_frete     numeric(15,2) DEFAULT 0,
  valor_seguro    numeric(15,2) DEFAULT 0,
  valor_desconto  numeric(15,2) DEFAULT 0,
  valor_outros    numeric(15,2) DEFAULT 0,
  valor_icms      numeric(15,2) DEFAULT 0,
  valor_icms_st   numeric(15,2) DEFAULT 0,
  valor_pis       numeric(15,2) DEFAULT 0,
  valor_cofins    numeric(15,2) DEFAULT 0,
  valor_ipi       numeric(15,2) DEFAULT 0,
  valor_iss       numeric(15,2) DEFAULT 0,
  valor_total     numeric(15,2) NOT NULL,
  observacoes     text,
  informacoes_adicionais text,
  nfse_codigo_servico text,
  nfse_aliquota_iss numeric(5,2),
  nfse_municipio  text,
  nfse_iss_retido boolean DEFAULT false,
  xml_url         text,
  danfe_url       text,
  xml_cancelamento_url text,
  certificado_id  uuid REFERENCES public.financeiro_certificados(id),
  provedor        text NOT NULL DEFAULT 'focus_nfe',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, uuid_provedor)
);
CREATE INDEX IF NOT EXISTS idx_fin_nfes_user_status
  ON public.financeiro_nfes_emitidas(user_id, status, data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_fin_nfes_chave
  ON public.financeiro_nfes_emitidas(chave_acesso) WHERE chave_acesso IS NOT NULL;

ALTER TABLE public.financeiro_nfes_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns financeiro_nfes_emitidas (select)"
  ON public.financeiro_nfes_emitidas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_nfes_emitidas (insert)"
  ON public.financeiro_nfes_emitidas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_nfes_emitidas (update)"
  ON public.financeiro_nfes_emitidas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_nfes_emitidas (delete)"
  ON public.financeiro_nfes_emitidas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_fin_nfes_updated_at
  BEFORE UPDATE ON public.financeiro_nfes_emitidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. EVENTOS DE NFe (cancelamento, CCe, EPEC, manifestação) --------------------
CREATE TABLE IF NOT EXISTS public.financeiro_nfe_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfe_id          uuid NOT NULL REFERENCES public.financeiro_nfes_emitidas(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_evento     text NOT NULL CHECK (tipo_evento IN ('cancelamento','cce','epec','manifestacao')),
  motivo          text,
  protocolo       text,
  xml_url         text,
  data_evento     timestamptz NOT NULL DEFAULT now(),
  realizado_por   uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_fin_nfe_eventos_nfe
  ON public.financeiro_nfe_eventos(nfe_id, data_evento DESC);

ALTER TABLE public.financeiro_nfe_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns financeiro_nfe_eventos (select)"
  ON public.financeiro_nfe_eventos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_nfe_eventos (insert)"
  ON public.financeiro_nfe_eventos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. MANIFESTAÇÕES DO DESTINATÁRIO --------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.financeiro_manifestacao_tipo AS ENUM (
    'ciencia','confirmacao','desconhecimento','nao_realizada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financeiro_manifestacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id      uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  chave_nfe       text NOT NULL,
  tipo            public.financeiro_manifestacao_tipo NOT NULL,
  motivo          text,
  protocolo       text,
  data_manifestacao timestamptz NOT NULL DEFAULT now(),
  realizado_por   uuid REFERENCES auth.users(id),
  automatica      boolean DEFAULT false,
  UNIQUE (user_id, chave_nfe, tipo)
);
ALTER TABLE public.financeiro_manifestacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns financeiro_manifestacoes (select)"
  ON public.financeiro_manifestacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_manifestacoes (insert)"
  ON public.financeiro_manifestacoes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. LOG DE CONSULTAS SEFAZ ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_consulta_nfe_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj            text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('automatica','manual')),
  nsu_inicial     bigint NOT NULL,
  nsu_final       bigint NOT NULL,
  nfes_encontradas int DEFAULT 0,
  nfes_novas      int DEFAULT 0,
  duracao_ms      int,
  status          text NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso','erro','timeout')),
  erro_mensagem   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_log_consulta_user
  ON public.financeiro_consulta_nfe_log(user_id, created_at DESC);

ALTER TABLE public.financeiro_consulta_nfe_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns financeiro_consulta_nfe_log (select)"
  ON public.financeiro_consulta_nfe_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user owns financeiro_consulta_nfe_log (insert)"
  ON public.financeiro_consulta_nfe_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. STORAGE BUCKETS -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('certificados-digitais', 'certificados-digitais', false),
  ('nfes-xml', 'nfes-xml', false),
  ('danfes', 'danfes', false),
  ('capturas-ocr', 'capturas-ocr', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: usuário só acessa pasta com seu próprio user_id
CREATE POLICY "users access own certificados"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'certificados-digitais'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'certificados-digitais'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users access own nfes-xml"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'nfes-xml'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'nfes-xml'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users access own danfes"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'danfes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'danfes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users access own capturas-ocr"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'capturas-ocr'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'capturas-ocr'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );