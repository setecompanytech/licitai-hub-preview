-- Corrige RLS das tabelas de contratos para visibilidade por empresa
-- Antes: somente o criador (user_id) via contratos e tabelas filhas
-- Depois: todos os membros da empresa podem gerenciar (is_empresa_member)
-- Fallback: contratos antigos sem empresa_id ainda visíveis ao criador

-- ── contratos (tem empresa_id) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can CRUD own contratos" ON public.contratos;

CREATE POLICY "Membros podem gerenciar contratos da empresa" ON public.contratos
  FOR ALL TO authenticated
  USING (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.is_empresa_member(auth.uid(), empresa_id)
    OR (empresa_id IS NULL AND auth.uid() = user_id)
  );

-- ── contrato_aditivos (sem empresa_id, herda via contrato_id) ────────────────
DROP POLICY IF EXISTS "Users can CRUD own aditivos" ON public.contrato_aditivos;

CREATE POLICY "Membros podem gerenciar aditivos da empresa" ON public.contrato_aditivos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  );

-- ── contrato_itens (sem empresa_id, herda via contrato_id) ───────────────────
DROP POLICY IF EXISTS "Users can CRUD own contrato_itens" ON public.contrato_itens;

CREATE POLICY "Membros podem gerenciar itens de contratos da empresa" ON public.contrato_itens
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  );

-- ── contrato_pedidos (sem empresa_id, herda via contrato_id) ─────────────────
DROP POLICY IF EXISTS "Users can CRUD own contrato_pedidos" ON public.contrato_pedidos;

CREATE POLICY "Membros podem gerenciar pedidos de contratos da empresa" ON public.contrato_pedidos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  );

-- ── contrato_custos (sem empresa_id, herda via contrato_id) ──────────────────
DROP POLICY IF EXISTS "Users can CRUD own contrato_custos" ON public.contrato_custos;

CREATE POLICY "Membros podem gerenciar custos de contratos da empresa" ON public.contrato_custos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contratos c
      WHERE c.id = contrato_id
        AND (
          public.is_empresa_member(auth.uid(), c.empresa_id)
          OR (c.empresa_id IS NULL AND auth.uid() = c.user_id)
        )
    )
  );
