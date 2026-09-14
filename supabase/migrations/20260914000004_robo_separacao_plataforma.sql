-- ============================================================================
-- Robô de Lances: o que é da empresa e o que é da Praefectus
--
-- Em 14/09/2026 o cliente via, na própria tela do robô, endereço e versão do
-- agente, RAM, slots, teste do freio e o erro técnico cru do portal. Nada disso
-- é decisão dele. A referência de mercado mostra o limite certo: o cliente liga
-- e desliga o robô da empresa, informa o próprio acesso aos portais e lê avisos
-- escritos por gente — o resto fica com quem opera a plataforma.
--
-- Esta migration cria o que falta para essa separação:
--   1. `robo_empresa_config` — o robô da EMPRESA ligado ou desligado;
--   2. `robo_avisos_portal`  — avisos por portal, escritos pela Praefectus e
--      lidos pelo cliente ("instabilidade no portal X, já estamos monitorando");
--   3. leitura de diagnóstico (sessões e registro de chamadas) para o
--      ADMINISTRADOR DA PLATAFORMA (`user_roles.role = 'admin'`).
--
-- Registro existente herda o comportamento atual (CLAUDE.md, princípio 7):
-- empresa sem linha em `robo_empresa_config` é tratada como LIGADA.
--
-- ── Reversão ────────────────────────────────────────────────────────────────
--   DROP POLICY IF EXISTS "Plataforma lê sessões do robô" ON public.sessoes_lance_real;
--   DROP POLICY IF EXISTS "Plataforma lê registro de chamadas" ON public.webhook_log;
--   DROP POLICY IF EXISTS "Plataforma lê configuração dos agentes" ON public.agente_externo_config;
--   DROP FUNCTION IF EXISTS public.nomes_de_empresas_para_plataforma(uuid[]);
--   DROP TABLE IF EXISTS public.robo_avisos_portal;
--   DROP TABLE IF EXISTS public.robo_empresa_config;
-- ============================================================================

-- Também criada na 20260914000002. Repetida aqui (idempotente) para esta
-- migration não depender da ordem em que as duas forem coladas.
CREATE OR REPLACE FUNCTION public.is_empresa_operador(_user_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros
     WHERE user_id = _user_id
       AND empresa_id = _empresa_id
       AND papel IN ('admin', 'operador')
  );
$$;

-- ── 1. Robô da empresa: ligado ou desligado ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.robo_empresa_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ligado boolean NOT NULL DEFAULT true,
  motivo text,
  alterado_por uuid,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_empresa_config IS
  'Robô de Lances da empresa ligado ou desligado. Sem linha = ligado (comportamento '
  'anterior). Desligado: o servidor recusa iniciar sessões novas. Desligar não '
  'cancela lance já aceito pelo portal.';

CREATE OR REPLACE FUNCTION public.robo_empresa_config_carimbar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.alterado_por := auth.uid();
  NEW.alterado_em := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_robo_empresa_config_carimbar ON public.robo_empresa_config;
CREATE TRIGGER trg_robo_empresa_config_carimbar
  BEFORE INSERT OR UPDATE ON public.robo_empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.robo_empresa_config_carimbar();

ALTER TABLE public.robo_empresa_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros veem se o robô está ligado" ON public.robo_empresa_config;
CREATE POLICY "Membros veem se o robô está ligado"
ON public.robo_empresa_config FOR SELECT TO authenticated
USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores ligam o robô" ON public.robo_empresa_config;
CREATE POLICY "Operadores ligam o robô"
ON public.robo_empresa_config FOR INSERT TO authenticated
WITH CHECK (public.is_empresa_operador(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Operadores ligam e desligam o robô" ON public.robo_empresa_config;
CREATE POLICY "Operadores ligam e desligam o robô"
ON public.robo_empresa_config FOR UPDATE TO authenticated
USING (public.is_empresa_operador(auth.uid(), empresa_id))
WITH CHECK (public.is_empresa_operador(auth.uid(), empresa_id));

-- ── 2. Avisos por portal ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.robo_avisos_portal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Id do portal (vocabulário de src/lib/robo/portais.ts). Nulo = todos.
  portal_id text,
  severidade text NOT NULL DEFAULT 'atencao'
    CHECK (severidade IN ('informativo', 'atencao', 'critico')),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  inicio_em timestamptz NOT NULL DEFAULT now(),
  fim_em timestamptz,
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fim_em IS NULL OR fim_em > inicio_em)
);

COMMENT ON TABLE public.robo_avisos_portal IS
  'Avisos da operação da Praefectus aos clientes do Robô de Lances, por portal. '
  'Linguagem de negócio — nunca erro técnico.';

CREATE INDEX IF NOT EXISTS idx_robo_avisos_portal_vigentes
  ON public.robo_avisos_portal (ativo, inicio_em, fim_em);

DROP TRIGGER IF EXISTS set_updated_at_robo_avisos_portal ON public.robo_avisos_portal;
CREATE TRIGGER set_updated_at_robo_avisos_portal
  BEFORE UPDATE ON public.robo_avisos_portal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.robo_avisos_portal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes leem avisos vigentes" ON public.robo_avisos_portal;
CREATE POLICY "Clientes leem avisos vigentes"
ON public.robo_avisos_portal FOR SELECT TO authenticated
USING (
  (ativo AND inicio_em <= now() AND (fim_em IS NULL OR fim_em > now()))
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Plataforma escreve avisos" ON public.robo_avisos_portal;
CREATE POLICY "Plataforma escreve avisos"
ON public.robo_avisos_portal FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 3. Diagnóstico para a plataforma ────────────────────────────────────────
--
-- Somente LEITURA, somente o técnico: sessões (com o erro completo), registro
-- de chamadas e configuração dos agentes. Lances e preços não entram aqui.
-- As policies antigas (dono / membros) continuam; estas somam.

DROP POLICY IF EXISTS "Plataforma lê sessões do robô" ON public.sessoes_lance_real;
CREATE POLICY "Plataforma lê sessões do robô"
ON public.sessoes_lance_real FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Plataforma lê registro de chamadas" ON public.webhook_log;
CREATE POLICY "Plataforma lê registro de chamadas"
ON public.webhook_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Plataforma lê configuração dos agentes" ON public.agente_externo_config;
CREATE POLICY "Plataforma lê configuração dos agentes"
ON public.agente_externo_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 4. Nome das empresas para o diagnóstico ─────────────────────────────────
--
-- O diagnóstico da plataforma precisa dizer DE QUAL empresa é cada sessão.
-- Liberar SELECT em `empresas` inteira entregaria CPF, RG e dados do
-- representante legal de todos os clientes — muito além do necessário. A
-- função devolve só id e nomes, e só para o administrador da plataforma.

CREATE OR REPLACE FUNCTION public.nomes_de_empresas_para_plataforma(p_ids uuid[])
RETURNS TABLE (id uuid, razao_social text, nome_fantasia text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Consulta exclusiva da operação Praefectus.';
  END IF;
  RETURN QUERY
    SELECT e.id, e.razao_social::text, e.nome_fantasia::text
      FROM public.empresas e
     WHERE e.id = ANY (p_ids);
END $$;

REVOKE ALL ON FUNCTION public.nomes_de_empresas_para_plataforma(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nomes_de_empresas_para_plataforma(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
