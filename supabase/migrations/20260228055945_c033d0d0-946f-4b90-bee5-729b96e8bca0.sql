
-- Tabela para artigos do blog gerados por IA
CREATE TABLE public.blog_artigos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  resumo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'mercado',
  autor TEXT NOT NULL DEFAULT 'LicitIA News',
  tempo_leitura TEXT NOT NULL DEFAULT '5 min',
  tags TEXT[] DEFAULT '{}'::text[],
  destaque BOOLEAN DEFAULT false,
  fonte_url TEXT,
  fonte_nome TEXT,
  tcu_referencia TEXT,
  caso_fortuito BOOLEAN DEFAULT false,
  forca_maior BOOLEAN DEFAULT false,
  data_publicacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS - artigos do blog são públicos para leitura
ALTER TABLE public.blog_artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog articles"
  ON public.blog_artigos FOR SELECT
  USING (true);

CREATE POLICY "Only service role can insert"
  ON public.blog_artigos FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Only service role can update"
  ON public.blog_artigos FOR UPDATE
  USING (false);

CREATE POLICY "Only service role can delete"
  ON public.blog_artigos FOR DELETE
  USING (false);

-- Trigger de updated_at
CREATE TRIGGER update_blog_artigos_updated_at
  BEFORE UPDATE ON public.blog_artigos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_blog_artigos_categoria ON public.blog_artigos(categoria);
CREATE INDEX idx_blog_artigos_data ON public.blog_artigos(data_publicacao DESC);
CREATE INDEX idx_blog_artigos_destaque ON public.blog_artigos(destaque) WHERE destaque = true;
