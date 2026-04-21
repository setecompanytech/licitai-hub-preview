-- Tabela de anexos/arquivos da pasta do processo (uploads livres + PDFs gerados)
CREATE TABLE IF NOT EXISTS public.processo_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id UUID NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outros',
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  origem TEXT NOT NULL DEFAULT 'upload',
  descricao TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_anexos_licitacao ON public.processo_anexos(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_processo_anexos_user ON public.processo_anexos(user_id);
CREATE INDEX IF NOT EXISTS idx_processo_anexos_categoria ON public.processo_anexos(licitacao_id, categoria);

ALTER TABLE public.processo_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own processo anexos" ON public.processo_anexos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own processo anexos" ON public.processo_anexos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own processo anexos" ON public.processo_anexos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own processo anexos" ON public.processo_anexos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_processo_anexos_updated_at BEFORE UPDATE ON public.processo_anexos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de documentos editáveis internos do processo (com versionamento)
CREATE TABLE IF NOT EXISTS public.processo_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id UUID NOT NULL REFERENCES public.licitacoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo_html TEXT,
  conteudo_json JSONB,
  versao INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'rascunho',
  pdf_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_documentos_licitacao ON public.processo_documentos(licitacao_id);
CREATE INDEX IF NOT EXISTS idx_processo_documentos_user ON public.processo_documentos(user_id);
CREATE INDEX IF NOT EXISTS idx_processo_documentos_tipo ON public.processo_documentos(licitacao_id, tipo);

ALTER TABLE public.processo_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own processo documentos" ON public.processo_documentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own processo documentos" ON public.processo_documentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own processo documentos" ON public.processo_documentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own processo documentos" ON public.processo_documentos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_processo_documentos_updated_at BEFORE UPDATE ON public.processo_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de versões (snapshots)
CREATE TABLE IF NOT EXISTS public.processo_documentos_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES public.processo_documentos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  versao INTEGER NOT NULL,
  conteudo_html TEXT,
  conteudo_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processo_doc_versoes_doc ON public.processo_documentos_versoes(documento_id);
ALTER TABLE public.processo_documentos_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own doc versoes" ON public.processo_documentos_versoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own doc versoes" ON public.processo_documentos_versoes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Bucket de storage para anexos do processo (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('processo-arquivos', 'processo-arquivos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own processo files" ON storage.objects FOR SELECT
  USING (bucket_id = 'processo-arquivos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own processo files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'processo-arquivos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own processo files" ON storage.objects FOR UPDATE
  USING (bucket_id = 'processo-arquivos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own processo files" ON storage.objects FOR DELETE
  USING (bucket_id = 'processo-arquivos' AND auth.uid()::text = (storage.foldername(name))[1]);