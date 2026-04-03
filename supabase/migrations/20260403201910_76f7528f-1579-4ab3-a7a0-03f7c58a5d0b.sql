
-- =============================================
-- FIX 1: Remove anon SELECT on cert_upload_tokens
-- The upload-certificado edge function uses service_role, no anon access needed
-- =============================================
DROP POLICY IF EXISTS "Anon can read token by value" ON public.cert_upload_tokens;

-- =============================================
-- FIX 2: Fix timbrados bucket policies - check empresa membership
-- Path structure: {empresa_id}/filename
-- =============================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Empresa members can delete timbrados" ON storage.objects;
DROP POLICY IF EXISTS "Empresa members can update timbrados" ON storage.objects;
DROP POLICY IF EXISTS "Empresa members can upload timbrados" ON storage.objects;
DROP POLICY IF EXISTS "Members can view timbrados" ON storage.objects;

-- New policies that check empresa membership via path
CREATE POLICY "Empresa members can view timbrados"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'timbrados'
  AND public.is_empresa_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Empresa members can upload timbrados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'timbrados'
  AND public.is_empresa_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Empresa members can update timbrados"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'timbrados'
  AND public.is_empresa_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Empresa members can delete timbrados"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'timbrados'
  AND public.is_empresa_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- =============================================
-- FIX 3: aurelia_cache - RLS enabled but no policies
-- This is a service-role-only cache table (no user_id column)
-- Add authenticated read-only policy so edge functions can serve cached results
-- Writes happen via service_role only
-- =============================================
CREATE POLICY "Authenticated users can read cache"
ON public.aurelia_cache FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- FIX 4: pncp_editais_cache - already has authenticated SELECT, acceptable for public data
-- No change needed - marking as reviewed
-- =============================================

-- =============================================
-- FIX 5: backup_verificacao - admin SELECT only, inserts via service_role
-- Add admin INSERT policy for completeness
-- =============================================
CREATE POLICY "Admins can insert backup verification"
ON public.backup_verificacao FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
