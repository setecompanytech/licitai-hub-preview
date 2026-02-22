
-- Table for portal credentials (sensitive data stored server-side)
CREATE TABLE public.credenciais_portais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  portal_id TEXT NOT NULL,
  portal_nome TEXT NOT NULL,
  login TEXT,
  senha_hash TEXT,
  certificado_path TEXT,
  certificado_tipo TEXT, -- 'pf' (pessoa física) or 'pj' (pessoa jurídica)
  certificado_nome TEXT,
  validade_certificado TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, portal_id)
);

ALTER TABLE public.credenciais_portais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials" ON public.credenciais_portais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credentials" ON public.credenciais_portais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credentials" ON public.credenciais_portais FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own credentials" ON public.credenciais_portais FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_credenciais_portais_updated_at
  BEFORE UPDATE ON public.credenciais_portais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for digital certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificados', 'certificados', false);

CREATE POLICY "Users can upload own certificates" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own certificates" ON storage.objects FOR SELECT
  USING (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own certificates" ON storage.objects FOR DELETE
  USING (bucket_id = 'certificados' AND auth.uid()::text = (storage.foldername(name))[1]);
