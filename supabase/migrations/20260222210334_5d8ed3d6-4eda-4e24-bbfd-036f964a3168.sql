
-- Fix: remove overly permissive INSERT policy
DROP POLICY "Service role can insert envios" ON public.boletim_envios;

-- Service role bypasses RLS, so no INSERT policy needed for edge functions
-- Users should not insert envios directly
