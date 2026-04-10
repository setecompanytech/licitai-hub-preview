
DROP POLICY IF EXISTS "fin_categorias_ins" ON public.fin_categorias;
CREATE POLICY "fin_categorias_ins" ON public.fin_categorias FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
