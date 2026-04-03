
-- Table for LGPD data requests (art. 18)
CREATE TABLE IF NOT EXISTS public.solicitacoes_lgpd (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('exclusao','portabilidade','correcao','acesso')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_analise','concluida','recusada')),
  descricao TEXT,
  resposta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prazo_resposta TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days')
);

ALTER TABLE public.solicitacoes_lgpd ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own lgpd requests"
  ON public.solicitacoes_lgpd FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create lgpd requests"
  ON public.solicitacoes_lgpd FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view and update all requests
CREATE POLICY "Admins can view all lgpd requests"
  ON public.solicitacoes_lgpd FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lgpd requests"
  ON public.solicitacoes_lgpd FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_solicitacoes_lgpd_updated_at
  BEFORE UPDATE ON public.solicitacoes_lgpd
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
