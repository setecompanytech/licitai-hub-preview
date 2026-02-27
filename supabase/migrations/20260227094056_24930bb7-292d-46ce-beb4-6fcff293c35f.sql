
-- Tabela para armazenar dados de empenhos extraídos do Portal de Transparência do Pará
CREATE TABLE public.transparencia_empenhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  orgao TEXT NOT NULL,
  ano INTEGER NOT NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  quantidade_empenhos INTEGER NOT NULL DEFAULT 0,
  categoria TEXT,
  fonte_recurso TEXT,
  municipio TEXT DEFAULT 'Belém',
  uf TEXT DEFAULT 'PA',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_transparencia_empenhos_user ON public.transparencia_empenhos(user_id);
CREATE INDEX idx_transparencia_empenhos_orgao ON public.transparencia_empenhos(orgao);
CREATE INDEX idx_transparencia_empenhos_ano ON public.transparencia_empenhos(ano);

-- RLS
ALTER TABLE public.transparencia_empenhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own transparencia data"
ON public.transparencia_empenhos
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_transparencia_empenhos_updated_at
BEFORE UPDATE ON public.transparencia_empenhos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
