
-- Drop all existing restrictive policies on empresas
DROP POLICY IF EXISTS "Authenticated users can create empresas" ON public.empresas;
DROP POLICY IF EXISTS "Members can view their empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins can update their empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins can delete their empresas" ON public.empresas;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Authenticated users can create empresas"
ON public.empresas FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can view their empresas"
ON public.empresas FOR SELECT TO authenticated
USING (is_empresa_member(auth.uid(), id));

CREATE POLICY "Admins can update their empresas"
ON public.empresas FOR UPDATE TO authenticated
USING (is_empresa_admin(auth.uid(), id));

CREATE POLICY "Admins can delete their empresas"
ON public.empresas FOR DELETE TO authenticated
USING (is_empresa_admin(auth.uid(), id));

-- Also fix empresa_membros INSERT policy (same issue - user needs to add themselves after creating empresa)
DROP POLICY IF EXISTS "Admins can manage empresa members" ON public.empresa_membros;
CREATE POLICY "Users can add themselves or admins can add members"
ON public.empresa_membros FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR is_empresa_admin(auth.uid(), empresa_id));
