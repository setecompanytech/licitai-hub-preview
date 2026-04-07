
-- ==============================================
-- FIX 1: agent_concorrentes - restringir a empresa_id
-- Não é possível adicionar empresa_id sem saber o schema atual,
-- mas podemos restringir INSERT/UPDATE ao service_role
-- ==============================================

DROP POLICY IF EXISTS "Qualquer autenticado pode inserir concorrentes" ON public.agent_concorrentes;
DROP POLICY IF EXISTS "Qualquer autenticado pode atualizar concorrentes" ON public.agent_concorrentes;

CREATE POLICY "Service role insere concorrentes"
ON public.agent_concorrentes FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role atualiza concorrentes"
ON public.agent_concorrentes FOR UPDATE TO service_role
USING (true) WITH CHECK (true);

-- ==============================================
-- FIX 2: publicacoes_dou_processadas - restringir a service_role
-- ==============================================

DROP POLICY IF EXISTS "Service manages DOU records" ON public.publicacoes_dou_processadas;

CREATE POLICY "Service manages DOU records"
ON public.publicacoes_dou_processadas FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read DOU records"
ON public.publicacoes_dou_processadas FOR SELECT TO authenticated
USING (true);

-- ==============================================
-- FIX 3: price_search_cache - restringir INSERT
-- ==============================================

DROP POLICY IF EXISTS "Authenticated can insert cache" ON public.price_search_cache;
DROP POLICY IF EXISTS "Anyone can insert price cache" ON public.price_search_cache;

-- Check existing policies first, drop any permissive INSERT
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'price_search_cache' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.price_search_cache', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY "Service role insere price cache"
ON public.price_search_cache FOR INSERT TO service_role
WITH CHECK (true);

-- ==============================================
-- FIX 4: notificacoes_enviadas - restringir INSERT
-- ==============================================

DROP POLICY IF EXISTS "Service inserts notifications" ON public.notificacoes_enviadas;

CREATE POLICY "Service inserts notifications"
ON public.notificacoes_enviadas FOR INSERT TO service_role
WITH CHECK (true);
