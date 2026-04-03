
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Agent configurations per company
CREATE TABLE public.agent_configuracoes (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  agente_ativo BOOLEAN DEFAULT FALSE,
  score_minimo_auto INTEGER DEFAULT 70,
  score_minimo_notif INTEGER DEFAULT 40,
  valor_minimo NUMERIC DEFAULT 0,
  valor_maximo NUMERIC DEFAULT 999999999,
  preco_minimo_perc NUMERIC DEFAULT 0.70,
  estrategia_lance TEXT DEFAULT 'adaptativo',
  auto_submeter_prop BOOLEAN DEFAULT FALSE,
  auto_responder_chat BOOLEAN DEFAULT TRUE,
  alertar_whatsapp BOOLEAN DEFAULT TRUE,
  whatsapp_numero TEXT,
  horario_inicio TIME DEFAULT '07:00',
  horario_fim TIME DEFAULT '22:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa podem gerenciar config do agente"
ON public.agent_configuracoes FOR ALL TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TRIGGER trg_agent_config_updated
BEFORE UPDATE ON public.agent_configuracoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Agent-tracked bidding processes
CREATE TABLE public.agent_licitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  pncp_cache_id UUID REFERENCES public.pncp_editais_cache(id),
  score_relevancia INTEGER,
  decisao TEXT DEFAULT 'aguardar_aprovacao',
  motivo_decisao TEXT,
  aprovacao_humana BOOLEAN DEFAULT FALSE,
  prazo_proposta TIMESTAMPTZ,
  prazo_habilitacao TIMESTAMPTZ,
  prazo_recurso TIMESTAMPTZ,
  data_abertura TIMESTAMPTZ,
  preco_proposta NUMERIC(15,2),
  preco_minimo NUMERIC(15,2),
  preco_vencedor NUMERIC(15,2),
  nossa_posicao INTEGER,
  agente_atual TEXT,
  ultima_acao TEXT,
  proxima_acao TEXT,
  proxima_execucao TIMESTAMPTZ,
  tentativas INTEGER DEFAULT 0,
  erro_log TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_licitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa podem gerenciar agent_licitacoes"
ON public.agent_licitacoes FOR ALL TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TRIGGER trg_agent_licit_updated
BEFORE UPDATE ON public.agent_licitacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_licit_empresa ON public.agent_licitacoes(empresa_id, decisao);
CREATE INDEX idx_agent_licit_proxima ON public.agent_licitacoes(proxima_execucao)
  WHERE decisao NOT IN ('concluido','cancelado','descartado');

-- Enable Realtime for agent_licitacoes
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_licitacoes;

-- 3. Agent action logs
CREATE TABLE public.agent_acoes_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacao_id UUID REFERENCES public.agent_licitacoes(id) ON DELETE CASCADE,
  agente TEXT NOT NULL,
  acao TEXT NOT NULL,
  status TEXT DEFAULT 'iniciado',
  payload_in JSONB,
  payload_out JSONB,
  duracao_ms INTEGER,
  erro_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_acoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver logs do agente da sua empresa"
ON public.agent_acoes_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agent_licitacoes al
    WHERE al.id = agent_acoes_log.licitacao_id
    AND public.is_empresa_member(auth.uid(), al.empresa_id)
  )
);

-- Service role inserts logs
CREATE POLICY "Service role insere logs"
ON public.agent_acoes_log FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agent_licitacoes al
    WHERE al.id = agent_acoes_log.licitacao_id
    AND public.is_empresa_member(auth.uid(), al.empresa_id)
  )
);

-- 4. Habilitação documents with status
CREATE TABLE public.agent_documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  arquivo_url TEXT,
  validade DATE,
  status TEXT DEFAULT 'faltante',
  auto_renovar BOOLEAN DEFAULT TRUE,
  ultima_coleta TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa podem gerenciar agent_documentos"
ON public.agent_documentos FOR ALL TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE INDEX idx_agent_docs_vencendo ON public.agent_documentos(empresa_id, validade)
  WHERE status IN ('valido','vencendo');

CREATE TRIGGER trg_agent_docs_updated
BEFORE UPDATE ON public.agent_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Real-time chat monitoring
CREATE TABLE public.agent_chat_monitor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacao_id UUID REFERENCES public.agent_licitacoes(id) ON DELETE CASCADE,
  portal TEXT,
  mensagem_id TEXT UNIQUE,
  remetente TEXT,
  conteudo TEXT NOT NULL,
  categoria TEXT DEFAULT 'outro',
  requer_acao BOOLEAN DEFAULT FALSE,
  resposta_enviada TEXT,
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_chat_monitor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver chat monitor da sua empresa"
ON public.agent_chat_monitor FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agent_licitacoes al
    WHERE al.id = agent_chat_monitor.licitacao_id
    AND public.is_empresa_member(auth.uid(), al.empresa_id)
  )
);

CREATE INDEX idx_agent_chat_nao_respondido ON public.agent_chat_monitor(licitacao_id)
  WHERE requer_acao = TRUE AND respondido_em IS NULL;

-- 6. Agent-managed contracts
CREATE TABLE public.agent_contratos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacao_id UUID REFERENCES public.agent_licitacoes(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_contrato TEXT,
  orgao TEXT,
  objeto TEXT,
  valor_total NUMERIC(15,2),
  data_inicio DATE,
  data_fim DATE,
  status TEXT DEFAULT 'aguardando_assinatura',
  indice_reajuste TEXT,
  ultimo_reajuste DATE,
  proximo_reajuste DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa podem gerenciar agent_contratos"
ON public.agent_contratos FOR ALL TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE TRIGGER trg_agent_contratos_updated
BEFORE UPDATE ON public.agent_contratos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Jurisprudence knowledge base with semantic search
CREATE TABLE public.agent_jurisprudencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte TEXT,
  numero TEXT,
  ementa TEXT,
  conteudo TEXT,
  embedding vector(1536),
  data_pub DATE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_jurisprudencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler jurisprudencia"
ON public.agent_jurisprudencia FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins podem inserir jurisprudencia"
ON public.agent_jurisprudencia FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agent_jurisp_embedding ON public.agent_jurisprudencia
  USING ivfflat (embedding vector_cosine_ops);

-- 8. Competitor intelligence
CREATE TABLE public.agent_concorrentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL UNIQUE,
  razao_social TEXT,
  preco_medio_desvio NUMERIC,
  taxa_vitoria NUMERIC,
  estrategia_lance TEXT,
  segmentos TEXT[],
  sancionado BOOLEAN DEFAULT FALSE,
  data_verificacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_concorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler concorrentes do agente"
ON public.agent_concorrentes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Qualquer autenticado pode inserir concorrentes"
ON public.agent_concorrentes FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Qualquer autenticado pode atualizar concorrentes"
ON public.agent_concorrentes FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_agent_concorrentes_updated
BEFORE UPDATE ON public.agent_concorrentes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC function to calculate agent metrics
CREATE OR REPLACE FUNCTION public.calcular_metricas_agente(p_empresa_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_monitoradas', (SELECT count(*) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao NOT IN ('descartado','concluido','cancelado')),
    'em_andamento', (SELECT count(*) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao IN ('participar','participando','proposta_enviada')),
    'em_disputa', (SELECT count(*) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao = 'em_disputa'),
    'aguardando_aprovacao', (SELECT count(*) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao = 'aguardar_aprovacao'),
    'vitorias_30d', (SELECT count(*) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao = 'vencedor' AND updated_at >= NOW() - INTERVAL '30 days'),
    'taxa_vitoria', (
      SELECT CASE
        WHEN count(*) FILTER (WHERE decisao IN ('vencedor','perdedor')) = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE decisao = 'vencedor') / count(*) FILTER (WHERE decisao IN ('vencedor','perdedor')))
      END
      FROM agent_licitacoes WHERE empresa_id = p_empresa_id
    ),
    'valor_total_vitorias', (SELECT COALESCE(sum(preco_vencedor), 0) FROM agent_licitacoes WHERE empresa_id = p_empresa_id AND decisao = 'vencedor' AND updated_at >= NOW() - INTERVAL '30 days')
  );
$$;
