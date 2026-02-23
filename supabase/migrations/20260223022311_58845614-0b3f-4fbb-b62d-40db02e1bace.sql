
-- Add timbrado columns to empresas
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS timbrado_path text,
ADD COLUMN IF NOT EXISTS timbrado_url text;

-- Create storage bucket for timbrados
INSERT INTO storage.buckets (id, name, public)
VALUES ('timbrados', 'timbrados', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: members can view timbrados
CREATE POLICY "Members can view timbrados"
ON storage.objects FOR SELECT
USING (bucket_id = 'timbrados');

-- RLS: empresa members can upload timbrados
CREATE POLICY "Empresa members can upload timbrados"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'timbrados' AND auth.uid() IS NOT NULL);

-- RLS: empresa members can update timbrados
CREATE POLICY "Empresa members can update timbrados"
ON storage.objects FOR UPDATE
USING (bucket_id = 'timbrados' AND auth.uid() IS NOT NULL);

-- RLS: empresa members can delete timbrados
CREATE POLICY "Empresa members can delete timbrados"
ON storage.objects FOR DELETE
USING (bucket_id = 'timbrados' AND auth.uid() IS NOT NULL);
