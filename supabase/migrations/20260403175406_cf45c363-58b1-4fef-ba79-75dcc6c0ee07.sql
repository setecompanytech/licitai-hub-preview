
-- TABELA: aurelia_cache
CREATE TABLE IF NOT EXISTS public.aurelia_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  tipo_analise TEXT NOT NULL DEFAULT 'geral',
  edital_id TEXT,
  resultado TEXT NOT NULL,
  tokens_gastos INTEGER,
  modelo_usado TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  acessos INTEGER DEFAULT 1,
  ultimo_acesso TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aurelia_cache_key ON public.aurelia_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_aurelia_cache_expira ON public.aurelia_cache(expira_em);
CREATE INDEX IF NOT EXISTS idx_aurelia_cache_tipo ON public.aurelia_cache(tipo_analise, criado_em DESC);

ALTER TABLE public.aurelia_cache ENABLE ROW LEVEL SECURITY;

-- ÍNDICES DE PERFORMANCE em tabelas existentes

-- pncp_editais_cache: busca por situacao + data
CREATE INDEX IF NOT EXISTS idx_pncp_editais_situacao_data
  ON public.pncp_editais_cache(situacao, data_publicacao_pncp DESC);

-- pncp_editais_cache: busca por orgao
CREATE INDEX IF NOT EXISTS idx_pncp_editais_orgao
  ON public.pncp_editais_cache(orgao);

-- licitacoes: busca por status + data de abertura
CREATE INDEX IF NOT EXISTS idx_licitacoes_status_abertura
  ON public.licitacoes(status, data_abertura DESC);

-- licitacoes: busca por user_id + status (kanban)
CREATE INDEX IF NOT EXISTS idx_licitacoes_user_status
  ON public.licitacoes(user_id, status);

-- documentos: busca por user_id + validade (alertas)
CREATE INDEX IF NOT EXISTS idx_documentos_user_validade
  ON public.documentos(user_id, validade);

-- chat_messages: busca por user_id + data
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_data
  ON public.chat_messages(user_id, created_at DESC);

-- contratos: busca por user_id + data_fim (vigência)
CREATE INDEX IF NOT EXISTS idx_contratos_user_vigencia
  ON public.contratos(user_id, data_fim);

-- conhecimento_ia: busca por tags (para RAG)
CREATE INDEX IF NOT EXISTS idx_conhecimento_ia_tags
  ON public.conhecimento_ia USING gin(tags);

-- perfis_alerta: busca por user_id + ativo
CREATE INDEX IF NOT EXISTS idx_perfis_alerta_user_ativo
  ON public.perfis_alerta(user_id, ativo);
