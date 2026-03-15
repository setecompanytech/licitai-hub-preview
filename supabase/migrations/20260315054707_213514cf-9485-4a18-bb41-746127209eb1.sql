
-- Create a security definer function to check if user is the creator of an empresa
CREATE OR REPLACE FUNCTION public.is_empresa_creator(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = _empresa_id AND created_by = _user_id
  )
$$;

-- Add policy: creators can self-add as first member (admin) of their own empresa
CREATE POLICY "Creators can add themselves as member"
ON public.empresa_membros
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND papel = 'admin'
  AND is_empresa_creator(auth.uid(), empresa_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_membros em WHERE em.empresa_id = empresa_membros.empresa_id
  )
);
