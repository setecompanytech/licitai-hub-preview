
-- Base de conhecimento acumulativa da IA
CREATE TABLE public.conhecimento_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  fontes JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  tipo TEXT NOT NULL DEFAULT 'achado',
  confiabilidade INTEGER DEFAULT 0,
  verificado BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conhecimento_ia ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own knowledge" ON public.conhecimento_ia
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own knowledge" ON public.conhecimento_ia
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own knowledge" ON public.conhecimento_ia
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own knowledge" ON public.conhecimento_ia
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_conhecimento_ia_user_categoria ON public.conhecimento_ia(user_id, categoria);
CREATE INDEX idx_conhecimento_ia_tags ON public.conhecimento_ia USING gin(tags);

-- Trigger for updated_at
CREATE TRIGGER update_conhecimento_ia_updated_at
  BEFORE UPDATE ON public.conhecimento_ia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
