
-- Tabela de sessões ativas dos agentes (monitoramento de conexões com portais)
CREATE TABLE IF NOT EXISTS public.agent_sessoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  portal TEXT NOT NULL,
  ativa BOOLEAN DEFAULT TRUE,
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  jsessionid TEXT,
  expirada_em TIMESTAMPTZ,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.agent_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da empresa veem sessões"
  ON public.agent_sessoes FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Service role gerencia sessões"
  ON public.agent_sessoes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_agent_sessoes_updated_at
  BEFORE UPDATE ON public.agent_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sessoes;
