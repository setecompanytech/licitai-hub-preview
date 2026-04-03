
-- FIX 1: boletim_envios - add INSERT and DELETE for own records
CREATE POLICY "Users can insert own boletim envios"
ON public.boletim_envios FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own boletim envios"
ON public.boletim_envios FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- FIX 2: rate_limit_log - add INSERT for authenticated users (needed by check_rate_limit function but also direct inserts)
CREATE POLICY "Users can insert own rate limit log"
ON public.rate_limit_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- FIX 3: aurelia_cache - confirm write-only via service_role by adding explicit comment (no policy needed)
-- Already handled by service_role. No change needed.

-- FIX 4: portal_healthcheck - restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can view healthchecks" ON public.portal_healthcheck;

CREATE POLICY "Admins can view portal healthchecks"
ON public.portal_healthcheck FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- FIX 5: pncp_editais_cache - public procurement data, SELECT open is acceptable. No change.
