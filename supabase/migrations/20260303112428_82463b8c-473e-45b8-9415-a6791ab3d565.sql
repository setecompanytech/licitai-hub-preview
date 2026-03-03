
-- Create base_contabil table (mirrors base_juridica structure)
CREATE TABLE public.base_contabil (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'balanco',
  orgao_emissor TEXT,
  numero_documento TEXT,
  ementa TEXT,
  texto_integral TEXT,
  arquivo_path TEXT,
  arquivo_nome TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  data_documento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.base_contabil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own base_contabil"
ON public.base_contabil
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_base_contabil_updated_at
BEFORE UPDATE ON public.base_contabil
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create apoio_contabil table for generated documents
CREATE TABLE public.apoio_contabil (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'parecer',
  conteudo TEXT,
  fundamentacao TEXT,
  licitacao_id UUID REFERENCES public.licitacoes(id),
  status TEXT DEFAULT 'rascunho',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.apoio_contabil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own apoio_contabil"
ON public.apoio_contabil
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_apoio_contabil_updated_at
BEFORE UPDATE ON public.apoio_contabil
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
