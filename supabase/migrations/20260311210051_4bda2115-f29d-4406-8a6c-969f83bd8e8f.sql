
-- Drop the vulnerable INSERT policy
DROP POLICY IF EXISTS "Users can add themselves or admins can add members" ON public.empresa_membros;

-- Self-add: users can only add themselves with non-privileged role
CREATE POLICY "Users can add themselves as operador"
ON public.empresa_membros
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND papel = 'operador');

-- Admin-add: empresa admins can add any member with any role
CREATE POLICY "Admins can add members to their empresa"
ON public.empresa_membros
FOR INSERT
TO authenticated
WITH CHECK (is_empresa_admin(auth.uid(), empresa_id));
