-- Allow anonymous users to update a token (mark as used) when they know the token ID
CREATE POLICY "Anon can mark token as used"
ON public.cert_upload_tokens
FOR UPDATE
TO anon
USING (used_at IS NULL AND expires_at > now())
WITH CHECK (true);

-- Allow anonymous users to upload certificates to the certificados bucket
CREATE POLICY "Anon can upload certificates via token"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'certificados');