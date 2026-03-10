
DROP POLICY "Service can insert routing logs" ON public.whatsapp_roteamento_log;
CREATE POLICY "Insert routing logs via service role"
  ON public.whatsapp_roteamento_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
