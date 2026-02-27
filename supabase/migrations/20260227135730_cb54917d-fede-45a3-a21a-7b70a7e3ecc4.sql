
-- Table to store external agent configurations
CREATE TABLE public.agente_externo_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Agente Principal',
  url_base TEXT NOT NULL,
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'inativo',
  ultimo_heartbeat TIMESTAMP WITH TIME ZONE,
  versao_agente TEXT,
  capacidades JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

-- Table to track real bid sessions sent to the external agent
CREATE TABLE public.sessoes_lance_real (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lance_config_id TEXT NOT NULL,
  portal_id TEXT NOT NULL,
  portal_nome TEXT NOT NULL,
  edital TEXT NOT NULL,
  valor_referencia NUMERIC NOT NULL,
  valor_inicial NUMERIC NOT NULL,
  valor_minimo NUMERIC NOT NULL,
  decremento_min NUMERIC,
  decremento_percentual NUMERIC,
  intervalo_segundos INTEGER DEFAULT 30,
  max_lances INTEGER DEFAULT 20,
  modo TEXT NOT NULL DEFAULT 'simulacao',
  status TEXT NOT NULL DEFAULT 'pendente',
  valor_atual NUMERIC,
  rodada_atual INTEGER DEFAULT 0,
  resultado TEXT,
  erro TEXT,
  agente_id UUID REFERENCES public.agente_externo_config(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to log all bids (real and simulated)
CREATE TABLE public.lances_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sessao_id UUID NOT NULL REFERENCES public.sessoes_lance_real(id) ON DELETE CASCADE,
  rodada INTEGER NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'meu',
  origem TEXT NOT NULL DEFAULT 'simulacao',
  timestamp_lance TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to log webhook communications
CREATE TABLE public.webhook_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  direcao TEXT NOT NULL DEFAULT 'entrada',
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code INTEGER,
  resposta JSONB,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agente_externo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_lance_real ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lances_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can CRUD own agente config"
  ON public.agente_externo_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own sessoes"
  ON public.sessoes_lance_real FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own lances historico"
  ON public.lances_historico FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own webhook logs"
  ON public.webhook_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_agente_externo_config_updated_at
  BEFORE UPDATE ON public.agente_externo_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessoes_lance_real_updated_at
  BEFORE UPDATE ON public.sessoes_lance_real
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates during bidding
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_lance_real;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lances_historico;
