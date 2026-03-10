
-- Tabela de leads capturados
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  empresa TEXT,
  cnpj TEXT,
  cargo TEXT,
  segmento TEXT,
  uf TEXT,
  municipio TEXT,
  interesse TEXT DEFAULT 'trial',
  origem TEXT DEFAULT 'landing',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  referrer TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  convertido BOOLEAN DEFAULT false,
  data_conversao TIMESTAMP WITH TIME ZONE,
  plano_convertido TEXT,
  valor_convertido NUMERIC,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: admins gerenciam tudo, público pode inserir (formulário)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
ON public.leads FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admins can manage all leads"
ON public.leads FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
