-- 1. Fix leads table: replace broad admin policy with proper SELECT restriction
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;

-- Admin-only SELECT policy (blocks non-admin authenticated users)
CREATE POLICY "Only admins can read leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only write policy
CREATE POLICY "Only admins can manage leads"
ON public.leads
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Move pg_trgm extension from public to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 3. Fix search_path on custom functions
ALTER FUNCTION public.delete_email SET search_path = public;
ALTER FUNCTION public.enqueue_email SET search_path = public;
ALTER FUNCTION public.move_to_dlq SET search_path = public;
ALTER FUNCTION public.read_email_batch SET search_path = public;