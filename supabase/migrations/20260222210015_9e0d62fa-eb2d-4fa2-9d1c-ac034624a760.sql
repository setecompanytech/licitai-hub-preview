
-- Tabela para preferências de boletins por e-mail
CREATE TABLE public.boletim_preferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  boletim_manha BOOLEAN NOT NULL DEFAULT true,
  boletim_meiodia BOOLEAN NOT NULL DEFAULT true,
  boletim_tarde BOOLEAN NOT NULL DEFAULT true,
  notificacao_push BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por user_id
CREATE UNIQUE INDEX idx_boletim_preferencias_user_id ON public.boletim_preferencias(user_id);

-- Enable RLS
ALTER TABLE public.boletim_preferencias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own preferences"
  ON public.boletim_preferencias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.boletim_preferencias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.boletim_preferencias FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_boletim_preferencias_updated_at
  BEFORE UPDATE ON public.boletim_preferencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de log de boletins enviados
CREATE TABLE public.boletim_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manha',
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  resend_id TEXT,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boletim_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own envios"
  ON public.boletim_envios FOR SELECT
  USING (auth.uid() = user_id);

-- Admin pode inserir (via edge function com service role)
CREATE POLICY "Service role can insert envios"
  ON public.boletim_envios FOR INSERT
  WITH CHECK (true);
