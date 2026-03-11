
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

CREATE OR REPLACE FUNCTION public.check_lead_rate_limit(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT (
    SELECT count(*) FROM public.leads
    WHERE email = p_email
    AND created_at > (now() - interval '1 hour')
  ) < 5
$$;

CREATE POLICY "Public can submit leads with rate limit"
ON public.leads
FOR INSERT
TO public
WITH CHECK (
  check_lead_rate_limit(email)
);
