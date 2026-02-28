
CREATE TABLE public.pesquisas_preco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  termo_busca TEXT NOT NULL,
  categoria TEXT DEFAULT 'todos',
  resultado TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pesquisas_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own pesquisas" ON public.pesquisas_preco
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pesquisas_preco_user ON public.pesquisas_preco(user_id, created_at DESC);
