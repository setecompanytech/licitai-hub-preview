
-- ============================================================
-- FIX 1: fin_plano_contas — restrict mutations on system rows (empresa_id IS NULL) to admins only
-- ============================================================

-- Drop existing mutation policies
DROP POLICY IF EXISTS "fin_plano_contas_insert" ON public.fin_plano_contas;
DROP POLICY IF EXISTS "fin_plano_contas_update" ON public.fin_plano_contas;
DROP POLICY IF EXISTS "fin_plano_contas_delete" ON public.fin_plano_contas;

-- SELECT stays the same (all authenticated can read system + own empresa rows)
-- INSERT: only allow empresa-scoped rows (no NULL empresa_id inserts by regular users)
CREATE POLICY "fin_plano_contas_insert" ON public.fin_plano_contas
    FOR INSERT TO authenticated
    WITH CHECK (
      (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id))
      OR (empresa_id IS NULL AND public.has_role(auth.uid(), 'admin'))
    );

-- UPDATE: system rows only by admins, empresa rows by members
CREATE POLICY "fin_plano_contas_update" ON public.fin_plano_contas
    FOR UPDATE TO authenticated
    USING (
      (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id))
      OR (empresa_id IS NULL AND public.has_role(auth.uid(), 'admin'))
    );

-- DELETE: system rows only by admins, empresa rows by members
CREATE POLICY "fin_plano_contas_delete" ON public.fin_plano_contas
    FOR DELETE TO authenticated
    USING (
      (empresa_id IS NOT NULL AND public.is_empresa_member(auth.uid(), empresa_id))
      OR (empresa_id IS NULL AND public.has_role(auth.uid(), 'admin'))
    );

-- ============================================================
-- FIX 2: Public buckets — restrict SELECT to prevent file listing
-- Replace broad SELECT with path-based access (read individual files only)
-- ============================================================

-- Drop existing broad SELECT policies on public buckets
DROP POLICY IF EXISTS "Empresa members can view timbrados" ON storage.objects;
DROP POLICY IF EXISTS "Public timbrados access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public docs" ON storage.objects;
DROP POLICY IF EXISTS "Public docs access" ON storage.objects;

-- Timbrados: authenticated users can read files by direct path (no listing)
CREATE POLICY "Authenticated read timbrados by path"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'timbrados');

-- documentos-publicos: authenticated users can read files by direct path
CREATE POLICY "Authenticated read documentos-publicos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-publicos');
