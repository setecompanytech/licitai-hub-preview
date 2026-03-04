
-- Table for admin-managed manufacturer/portal sources for the catalog AI
CREATE TABLE public.fontes_fabricantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url_base TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'geral',
  descricao TEXT,
  palavras_chave TEXT[] DEFAULT '{}',
  prioridade INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only admins can manage
ALTER TABLE public.fontes_fabricantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fontes_fabricantes"
  ON public.fontes_fabricantes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can read active sources (needed by catalog AI)
CREATE POLICY "Authenticated users can view active fontes"
  ON public.fontes_fabricantes FOR SELECT
  TO authenticated
  USING (ativo = true);
