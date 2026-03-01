
-- Tabela para editais favoritos/salvos
CREATE TABLE public.editais_favoritos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  numero VARCHAR NOT NULL,
  orgao VARCHAR NOT NULL,
  objeto TEXT NOT NULL,
  modalidade VARCHAR,
  portal VARCHAR,
  uf VARCHAR(2),
  municipio VARCHAR,
  valor_estimado NUMERIC,
  data_abertura DATE,
  url TEXT,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.editais_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
ON public.editais_favoritos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
ON public.editais_favoritos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
ON public.editais_favoritos FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_editais_favoritos_user ON public.editais_favoritos(user_id);
CREATE UNIQUE INDEX idx_editais_favoritos_unique ON public.editais_favoritos(user_id, numero, orgao);
