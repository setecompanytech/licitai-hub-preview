
-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT,
  empresa TEXT,
  cnpj TEXT,
  telefone TEXT,
  cargo TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 2. USER ROLES
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 3. AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome_completo) 
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. LICITACOES TABLE
-- ============================================
CREATE TABLE public.licitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  orgao TEXT NOT NULL,
  objeto TEXT NOT NULL,
  modalidade TEXT NOT NULL DEFAULT 'Pregão Eletrônico',
  status TEXT NOT NULL DEFAULT 'Publicado',
  valor_estimado NUMERIC(15,2),
  data_abertura TIMESTAMPTZ,
  data_encerramento TIMESTAMPTZ,
  portal TEXT DEFAULT 'ComprasNet',
  uf TEXT,
  municipio TEXT,
  url_edital TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.licitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own licitacoes" ON public.licitacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own licitacoes" ON public.licitacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own licitacoes" ON public.licitacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own licitacoes" ON public.licitacoes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_licitacoes_updated_at BEFORE UPDATE ON public.licitacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_licitacoes_user ON public.licitacoes(user_id);
CREATE INDEX idx_licitacoes_status ON public.licitacoes(status);

-- ============================================
-- 6. CONCORRENTES TABLE
-- ============================================
CREATE TABLE public.concorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  situacao TEXT DEFAULT 'ATIVA',
  porte TEXT,
  capital_social NUMERIC(15,2),
  cnae_principal TEXT,
  cnaes_secundarios TEXT[],
  endereco TEXT,
  municipio TEXT,
  uf TEXT,
  email TEXT,
  telefone TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.concorrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own concorrentes" ON public.concorrentes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own concorrentes" ON public.concorrentes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own concorrentes" ON public.concorrentes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own concorrentes" ON public.concorrentes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_concorrentes_updated_at BEFORE UPDATE ON public.concorrentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. KANBAN TASKS TABLE
-- ============================================
CREATE TABLE public.kanban_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  prioridade TEXT DEFAULT 'media',
  responsavel TEXT,
  data_limite TIMESTAMPTZ,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own tasks" ON public.kanban_tasks FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_kanban_tasks_updated_at BEFORE UPDATE ON public.kanban_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. DOCUMENTOS TABLE
-- ============================================
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT,
  arquivo_url TEXT,
  arquivo_path TEXT,
  tamanho_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own documentos" ON public.documentos FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 9. MONITORAMENTO EDITAIS TABLE
-- ============================================
CREATE TABLE public.monitoramento_editais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  orgao TEXT NOT NULL,
  portal TEXT,
  url TEXT,
  tipo TEXT DEFAULT 'edital',
  status TEXT DEFAULT 'novo',
  valor_estimado NUMERIC(15,2),
  data_publicacao TIMESTAMPTZ,
  data_abertura TIMESTAMPTZ,
  uf TEXT,
  municipio TEXT,
  palavras_chave TEXT[],
  cnae_compativel BOOLEAN DEFAULT false,
  relevancia_score INT DEFAULT 0,
  lido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monitoramento_editais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own monitoramento" ON public.monitoramento_editais FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_monitoramento_updated_at BEFORE UPDATE ON public.monitoramento_editais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 10. PRECIFICACAO TABLE
-- ============================================
CREATE TABLE public.precificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  item TEXT NOT NULL,
  descricao TEXT,
  unidade TEXT DEFAULT 'un',
  quantidade NUMERIC(15,4) DEFAULT 1,
  custo_unitario NUMERIC(15,4),
  bdi_percentual NUMERIC(5,2) DEFAULT 25.0,
  preco_unitario NUMERIC(15,4),
  preco_total NUMERIC(15,4),
  fonte_preco TEXT,
  referencia_sinapi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.precificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own precificacao" ON public.precificacao FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_precificacao_updated_at BEFORE UPDATE ON public.precificacao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 11. LANCES (ROBO) TABLE
-- ============================================
CREATE TABLE public.lances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  valor_lance NUMERIC(15,2) NOT NULL,
  valor_minimo NUMERIC(15,2),
  decremento NUMERIC(15,2),
  automatico BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pendente',
  resultado TEXT,
  data_lance TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own lances" ON public.lances FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 12. APOIO JURIDICO TABLE
-- ============================================
CREATE TABLE public.apoio_juridico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  licitacao_id UUID REFERENCES public.licitacoes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'parecer',
  titulo TEXT NOT NULL,
  conteudo TEXT,
  fundamentacao TEXT,
  status TEXT DEFAULT 'rascunho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.apoio_juridico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own apoio_juridico" ON public.apoio_juridico FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_apoio_juridico_updated_at BEFORE UPDATE ON public.apoio_juridico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 13. NOTIFICACOES TABLE
-- ============================================
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  tipo TEXT DEFAULT 'info',
  lida BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own notificacoes" ON public.notificacoes FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 14. CHAT / ASSISTENTE IA TABLE
-- ============================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own chat" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_chat_user ON public.chat_messages(user_id, created_at);

-- ============================================
-- 15. CONFIGURACOES DO USUARIO TABLE
-- ============================================
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cnaes_monitorados TEXT[],
  palavras_chave TEXT[],
  ufs_interesse TEXT[],
  municipios_interesse TEXT[],
  valor_minimo NUMERIC(15,2),
  valor_maximo NUMERIC(15,2),
  notificacoes_email BOOLEAN DEFAULT true,
  notificacoes_push BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own config" ON public.configuracoes FOR ALL USING (auth.uid() = user_id);
CREATE TRIGGER update_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 16. STORAGE BUCKET FOR DOCUMENTS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', false);

CREATE POLICY "Users can upload own docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own docs" ON storage.objects FOR SELECT USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own docs" ON storage.objects FOR DELETE USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own docs" ON storage.objects FOR UPDATE USING (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);
