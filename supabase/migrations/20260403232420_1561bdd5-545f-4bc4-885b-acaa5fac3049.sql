
-- Itens extraídos de cada edital para precificação autônoma
CREATE TABLE public.agent_itens_edital (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  edital_id UUID,
  empresa_id UUID REFERENCES public.empresas(id),
  licitacao_id UUID REFERENCES public.agent_licitacoes(id),

  -- Dados do item (extraídos do edital)
  numero INTEGER NOT NULL,
  lote INTEGER DEFAULT 1,
  descricao TEXT NOT NULL,
  unidade TEXT,
  quantidade NUMERIC(15,3),
  codigo_catmat TEXT,
  codigo_catser TEXT,
  especificacoes_tecnicas TEXT,
  marca_referencia TEXT,
  permite_equivalente BOOLEAN DEFAULT TRUE,
  criterio_julgamento TEXT,
  exclusivo_me_epp BOOLEAN DEFAULT FALSE,
  valor_estimado_unitario NUMERIC(15,4),
  valor_estimado_total NUMERIC(15,2),

  -- Resultados da precificação
  preco_referencia NUMERIC(15,4),
  preco_proposta NUMERIC(15,4),
  preco_lance_inicial NUMERIC(15,4),
  preco_lance_minimo NUMERIC(15,4),
  margem_bruta_perc NUMERIC(5,2),

  -- Marca/modelo selecionados
  marca_selecionada TEXT,
  modelo_selecionado TEXT,
  justificativa_marca TEXT,

  -- Fontes consultadas (JSON)
  fontes_consultadas JSONB,
  confianca_calculo NUMERIC(3,2),

  -- Status
  status TEXT DEFAULT 'pendente_precificacao',
  motivo_status TEXT,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de preços e vitórias (base de aprendizado)
CREATE TABLE public.agent_historico_precos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  edital_id UUID,
  item_id UUID REFERENCES public.agent_itens_edital(id),

  descricao TEXT NOT NULL,
  codigo_catmat TEXT,
  unidade TEXT,
  quantidade NUMERIC(15,3),

  preco_proposta NUMERIC(15,4),
  preco_lance_min NUMERIC(15,4),
  preco_vencedor NUMERIC(15,4),

  marca TEXT,
  modelo TEXT,

  resultado TEXT,
  posicao_final INTEGER,
  cnpj_vencedor TEXT,

  orgao TEXT,
  uf_orgao TEXT,
  modalidade TEXT,
  data_registro TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX idx_itens_edital_licitacao ON public.agent_itens_edital(licitacao_id);
CREATE INDEX idx_itens_edital_empresa ON public.agent_itens_edital(empresa_id);
CREATE INDEX idx_itens_edital_status ON public.agent_itens_edital(status);
CREATE INDEX idx_historico_descricao ON public.agent_historico_precos USING gin(to_tsvector('portuguese', descricao));
CREATE INDEX idx_historico_catmat ON public.agent_historico_precos(codigo_catmat) WHERE codigo_catmat IS NOT NULL;
CREATE INDEX idx_historico_empresa_resultado ON public.agent_historico_precos(empresa_id, resultado);

-- Adicionar colunas de precificação ao agent_configuracoes
ALTER TABLE public.agent_configuracoes
  ADD COLUMN IF NOT EXISTS fator_preco_proposta NUMERIC(4,3) DEFAULT 0.920,
  ADD COLUMN IF NOT EXISTS fator_lance_inicial NUMERIC(4,3) DEFAULT 0.900,
  ADD COLUMN IF NOT EXISTS margem_minima_perc NUMERIC(4,3) DEFAULT 0.080,
  ADD COLUMN IF NOT EXISTS margem_alvo_perc NUMERIC(4,3) DEFAULT 0.150,
  ADD COLUMN IF NOT EXISTS valor_maximo_por_item NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS preco_minimo_absoluto NUMERIC(15,4) DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS confianca_minima_auto NUMERIC(3,2) DEFAULT 0.60;

-- RLS
ALTER TABLE public.agent_itens_edital ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_historico_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own company items" ON public.agent_itens_edital
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Members can insert own company items" ON public.agent_itens_edital
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Members can update own company items" ON public.agent_itens_edital
  FOR UPDATE TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Members can view own company history" ON public.agent_historico_precos
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Members can insert own company history" ON public.agent_historico_precos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_itens_edital;

-- Trigger updated_at
CREATE TRIGGER update_agent_itens_edital_updated_at
  BEFORE UPDATE ON public.agent_itens_edital
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
