-- Fix 1: alertas_gerados - restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service inserts alerts" ON alertas_gerados;

CREATE POLICY "Service inserts alerts"
  ON alertas_gerados FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix 2: documentos-publicos storage - restrict uploads to service_role only
DROP POLICY IF EXISTS "Service role can upload documentos-publicos" ON storage.objects;

CREATE POLICY "Service role can upload documentos-publicos"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'documentos-publicos');

-- Fix 3: empresa_membros - add unique constraint to prevent duplicate admin race condition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'empresa_membros_empresa_user_unique'
  ) THEN
    ALTER TABLE public.empresa_membros
      ADD CONSTRAINT empresa_membros_empresa_user_unique UNIQUE (empresa_id, user_id);
  END IF;
END $$;