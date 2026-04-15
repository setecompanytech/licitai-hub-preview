-- Tabela LGPD: log de acessos a dados pessoais (Art. 37)
CREATE TABLE IF NOT EXISTS public.lgpd_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  acao text NOT NULL,
  recurso text NOT NULL,
  detalhes jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  finalidade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_access_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver o log de acessos
CREATE POLICY "Admins podem ler lgpd_access_log"
ON public.lgpd_access_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Qualquer usuário autenticado pode gerar log (insert)
CREATE POLICY "Usuarios autenticados inserem lgpd_access_log"
ON public.lgpd_access_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_lgpd_access_log_user_data 
ON public.lgpd_access_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_data_encerramento 
ON public.pncp_editais_cache (data_encerramento_proposta) 
WHERE data_encerramento_proposta IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_acoes_log_agente_data 
ON public.agent_acoes_log (agente, created_at DESC);