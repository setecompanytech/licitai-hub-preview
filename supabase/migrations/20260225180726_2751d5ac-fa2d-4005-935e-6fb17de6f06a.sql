
-- WhatsApp preferences per sector
CREATE TABLE public.whatsapp_preferencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  setor_licitacoes BOOLEAN NOT NULL DEFAULT true,
  setor_juridico BOOLEAN NOT NULL DEFAULT false,
  setor_financeiro BOOLEAN NOT NULL DEFAULT false,
  setor_documentos BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp prefs" ON public.whatsapp_preferencias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whatsapp prefs" ON public.whatsapp_preferencias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whatsapp prefs" ON public.whatsapp_preferencias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whatsapp prefs" ON public.whatsapp_preferencias FOR DELETE USING (auth.uid() = user_id);

-- WhatsApp send history
CREATE TABLE public.whatsapp_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  telefone TEXT NOT NULL,
  setor TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulado',
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp envios" ON public.whatsapp_envios FOR SELECT USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_preferencias_updated_at
  BEFORE UPDATE ON public.whatsapp_preferencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
