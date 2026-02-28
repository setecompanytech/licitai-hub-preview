
-- Tabela para armazenar documentos jurídicos de referência (decisões, acórdãos, doutrinas)
CREATE TABLE public.base_juridica (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'decisao', -- decisao, acordao, doutrina, sumula, parecer, legislacao
  tribunal TEXT,
  numero_processo TEXT,
  data_documento DATE,
  ementa TEXT,
  texto_integral TEXT,
  arquivo_path TEXT,
  arquivo_nome TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.base_juridica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own base_juridica"
  ON public.base_juridica FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_base_juridica_updated_at
  BEFORE UPDATE ON public.base_juridica
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para arquivos jurídicos
INSERT INTO storage.buckets (id, name, public) VALUES ('juridico', 'juridico', false);

CREATE POLICY "Users can upload juridico files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'juridico' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own juridico files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'juridico' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own juridico files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'juridico' AND auth.uid()::text = (storage.foldername(name))[1]);
