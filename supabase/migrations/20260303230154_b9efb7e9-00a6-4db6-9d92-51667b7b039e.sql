
-- Create storage bucket for compliance documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-habilitacao', 'documentos-habilitacao', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Users can upload their own docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-habilitacao' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-habilitacao' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-habilitacao' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own docs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-habilitacao' AND auth.uid()::text = (storage.foldername(name))[1]);
