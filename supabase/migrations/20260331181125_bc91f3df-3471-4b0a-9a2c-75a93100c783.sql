-- Remove anon storage policy (upload now goes through edge function with service_role)
DROP POLICY IF EXISTS "Anon can upload certificates via token" ON storage.objects;

-- Remove anon update policy on cert_upload_tokens (edge function uses service_role)
DROP POLICY IF EXISTS "Anon can mark token as used" ON public.cert_upload_tokens;