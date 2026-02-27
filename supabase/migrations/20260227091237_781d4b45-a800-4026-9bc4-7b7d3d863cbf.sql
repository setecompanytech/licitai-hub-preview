
-- Add SELECT policy so creators can see their own empresa immediately after INSERT
-- (before empresa_membros row exists)
CREATE POLICY "Creators can view their empresas"
ON public.empresas FOR SELECT TO authenticated
USING (auth.uid() = created_by);
