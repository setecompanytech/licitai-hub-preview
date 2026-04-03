
-- FIX 1: licitacoes - allow operador_id to read assigned licitacoes
CREATE POLICY "Operadores can view assigned licitacoes"
ON public.licitacoes FOR SELECT
TO authenticated
USING (operador_id = auth.uid());

-- FIX 2: aurelia_cache - restrict to admin only instead of all authenticated
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.aurelia_cache;

CREATE POLICY "Admins can read aurelia cache"
ON public.aurelia_cache FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- FIX 3: backup_verificacao - add DELETE for admins
CREATE POLICY "Admins can delete backup verification"
ON public.backup_verificacao FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- FIX 4: whatsapp_envios - add INSERT for users
CREATE POLICY "Users can insert own whatsapp envios"
ON public.whatsapp_envios FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
