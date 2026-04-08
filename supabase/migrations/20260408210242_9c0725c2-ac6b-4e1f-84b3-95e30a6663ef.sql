CREATE POLICY "Authenticated users can insert manual editais"
ON public.pncp_editais_cache
FOR INSERT
TO authenticated
WITH CHECK (fonte = 'Manual');