-- Add a RESTRICTIVE SELECT policy to explicitly block non-admin users
CREATE POLICY "Block non-admin select on leads"
ON public.leads
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));