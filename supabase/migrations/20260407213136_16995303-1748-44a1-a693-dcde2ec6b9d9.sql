
-- 1. Fix system_logs INSERT policy: restrict user_id to caller's own identity
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.system_logs;
CREATE POLICY "Authenticated users can insert logs" ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 2. Fix vw_editais_por_fonte: set security_invoker to prevent SECURITY DEFINER
ALTER VIEW public.vw_editais_por_fonte SET (security_invoker = true);

-- 3. Remove empresas from Realtime publication (contains PII: rep_cpf, rep_rg, etc.)
ALTER PUBLICATION supabase_realtime DROP TABLE public.empresas;
