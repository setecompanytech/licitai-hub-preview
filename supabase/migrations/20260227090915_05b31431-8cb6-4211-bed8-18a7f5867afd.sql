
-- Fix empresa_membros: drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Members can view empresa members" ON public.empresa_membros;
DROP POLICY IF EXISTS "Admins can update empresa members" ON public.empresa_membros;
DROP POLICY IF EXISTS "Admins can remove empresa members" ON public.empresa_membros;

CREATE POLICY "Members can view empresa members"
ON public.empresa_membros FOR SELECT TO authenticated
USING (is_empresa_member(auth.uid(), empresa_id));

CREATE POLICY "Admins can update empresa members"
ON public.empresa_membros FOR UPDATE TO authenticated
USING (is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "Admins can remove empresa members"
ON public.empresa_membros FOR DELETE TO authenticated
USING (is_empresa_admin(auth.uid(), empresa_id));
