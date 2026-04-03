
-- Cache de resultados de pesquisa de preços (6h de validade)
CREATE TABLE public.price_search_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  descricao TEXT NOT NULL,
  codigo_catmat TEXT,
  resultados JSONB NOT NULL,
  estatisticas JSONB NOT NULL,
  coletado_em TIMESTAMPTZ DEFAULT NOW(),
  expira_em TIMESTAMPTZ NOT NULL,
  acessos INTEGER DEFAULT 1
);

CREATE INDEX idx_price_cache_key ON public.price_search_cache(cache_key);
CREATE INDEX idx_price_cache_expira ON public.price_search_cache(expira_em);
CREATE INDEX idx_price_cache_catmat ON public.price_search_cache(codigo_catmat) WHERE codigo_catmat IS NOT NULL;

-- Histórico temporal de preços (série temporal)
CREATE TABLE public.price_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  codigo_catmat TEXT,
  item_edital_id UUID REFERENCES public.agent_itens_edital(id),
  preco_minimo NUMERIC(15,4),
  preco_maximo NUMERIC(15,4),
  preco_medio NUMERIC(15,4),
  preco_mediana NUMERIC(15,4),
  preco_sugerido NUMERIC(15,4),
  total_registros INTEGER,
  fontes TEXT[],
  data_coleta TIMESTAMPTZ DEFAULT NOW(),
  variacao_pct NUMERIC(8,4),
  tendencia TEXT
);

CREATE INDEX idx_price_hist_catmat_data ON public.price_historico(codigo_catmat, data_coleta DESC);
CREATE INDEX idx_price_hist_descricao ON public.price_historico USING gin(to_tsvector('portuguese', descricao));
CREATE INDEX idx_price_hist_data ON public.price_historico(data_coleta DESC);

-- Trigger para calcular variação automática
CREATE OR REPLACE FUNCTION public.calcular_variacao_preco()
RETURNS TRIGGER AS $$
DECLARE
  preco_anterior NUMERIC;
BEGIN
  SELECT preco_mediana INTO preco_anterior
  FROM public.price_historico
  WHERE codigo_catmat = NEW.codigo_catmat
    AND data_coleta < NEW.data_coleta
  ORDER BY data_coleta DESC
  LIMIT 1;

  IF preco_anterior IS NOT NULL AND preco_anterior > 0 THEN
    NEW.variacao_pct := ((NEW.preco_mediana - preco_anterior) / preco_anterior) * 100;
    NEW.tendencia := CASE
      WHEN NEW.variacao_pct > 2 THEN 'alta'
      WHEN NEW.variacao_pct < -2 THEN 'queda'
      ELSE 'estavel'
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_variacao_preco
  BEFORE INSERT ON public.price_historico
  FOR EACH ROW EXECUTE FUNCTION public.calcular_variacao_preco();

-- Alertas de variação de preço
CREATE TABLE public.price_alertas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  user_id UUID NOT NULL,
  codigo_catmat TEXT,
  descricao TEXT,
  preco_referencia NUMERIC(15,4),
  threshold_alta NUMERIC(5,2) DEFAULT 10.0,
  threshold_queda NUMERIC(5,2) DEFAULT 5.0,
  ativo BOOLEAN DEFAULT TRUE,
  ultima_notif TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.price_search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alertas ENABLE ROW LEVEL SECURITY;

-- Cache é acessível a todos autenticados (dados públicos de preço)
CREATE POLICY "Authenticated can read price cache" ON public.price_search_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert price cache" ON public.price_search_cache
  FOR INSERT TO authenticated WITH CHECK (true);

-- Histórico é leitura pública, inserção via service role
CREATE POLICY "Authenticated can read price history" ON public.price_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert price history" ON public.price_historico
  FOR INSERT TO service_role WITH CHECK (true);

-- Alertas pertencem ao usuário
CREATE POLICY "Users manage own price alerts" ON public.price_alertas
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Adicionar campo de preço e-commerce no agent_itens_edital
ALTER TABLE public.agent_itens_edital
  ADD COLUMN IF NOT EXISTS preco_referencia_ecommerce NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS fontes_ecommerce_count INTEGER DEFAULT 0;

-- Realtime para histórico
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_historico;
