-- =============================================================================
-- MIGRATION: convite por setor reutilizavel + login individual
-- Data: 2026-08-09
-- Objetivo: sustentar o fluxo real do produto — o e-mail do setor e ponto de
--           DISTRIBUICAO do link, e cada colaborador cria o proprio acesso.
--
-- Como estava (e por que nao funcionava):
--   1. `empresa_convites.accepted_at` era marcado no primeiro uso e a tela
--      tratava o convite como consumido. O segundo colaborador do setor via
--      "convite ja utilizado" — contradizendo o proprio texto da tela, que
--      promete "qualquer colaborador que recebe-lo podera criar um acesso".
--   2. O formulario vinha com o e-mail do SETOR preenchido. Quem nao trocasse
--      criava a conta com ele, queimando o endereco compartilhado como conta
--      individual.
--   3. Ninguem gravava `profiles.username` — o unico campo que o login por
--      usuario consulta. Dai o "Usuario nao encontrado" para COMERCIAL-01.
--
-- Decisao de arquitetura (setor tem UM e-mail compartilhado): a identidade
-- passa a ser o LOGIN. O e-mail da conta e sintetico e derivado do login; o
-- e-mail do setor fica como contato. Ver o comentario em profiles.username.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Unicidade do login, agora sem depender de maiusculas
--    A constraint antiga era case-sensitive: COMERCIAL-01 e comercial-01
--    coexistiam, e a RPC de login (que compara com lower()) escolheria uma
--    das duas por LIMIT 1 — deixando alguem de fora sem explicacao.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
DROP INDEX IF EXISTS public.profiles_username_lower_idx;

CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN public.profiles.username IS
  'Login individual do colaborador. E a identidade de acesso quando o setor '
  'usa um e-mail compartilhado: o e-mail da conta em auth.users e sintetico '
  '(<login>@praefectus.invalid) e nunca recebe mensagem. Unico sem distinguir '
  'maiusculas.';

-- -----------------------------------------------------------------------------
-- 2. Convite reutilizavel
--    `accepted_at` deixa de ser porteiro e passa a registrar o PRIMEIRO uso.
--    Quem controla o reuso agora e `max_usos` (NULL = ilimitado ate expirar).
-- -----------------------------------------------------------------------------
ALTER TABLE public.empresa_convites
  ADD COLUMN IF NOT EXISTS usos int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_usos int;

ALTER TABLE public.empresa_convites DROP CONSTRAINT IF EXISTS empresa_convites_max_usos_positivo;
ALTER TABLE public.empresa_convites
  ADD CONSTRAINT empresa_convites_max_usos_positivo
  CHECK (max_usos IS NULL OR max_usos > 0);

COMMENT ON COLUMN public.empresa_convites.max_usos IS
  'Quantos acessos o link pode criar. NULL = ilimitado ate expires_at.';
COMMENT ON COLUMN public.empresa_convites.accepted_at IS
  'Primeiro uso do convite. NAO bloqueia reuso — quem limita e max_usos.';

-- Convites ja aceitos passam a contar 1 uso, para o numero nao nascer mentindo
UPDATE public.empresa_convites
   SET usos = 1
 WHERE accepted_at IS NOT NULL
   AND usos = 0;

-- -----------------------------------------------------------------------------
-- 3. Quem usou cada convite
--    `accepted_by_email` guarda um unico valor e era sobrescrito. Com varios
--    colaboradores por link, rastreabilidade exige uma linha por aceite.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_convite_aceites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id   uuid NOT NULL REFERENCES public.empresa_convites(id) ON DELETE CASCADE,
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  username     text NOT NULL,
  nome         text,
  aceito_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_convite_aceites_user_unico UNIQUE (convite_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_convite_aceites_convite
  ON public.empresa_convite_aceites (convite_id);

ALTER TABLE public.empresa_convite_aceites ENABLE ROW LEVEL SECURITY;

-- Leitura para membros da empresa; escrita so pela edge function (service_role,
-- que ignora RLS). Sem policy de INSERT de proposito: ninguem cria aceite
-- direto pelo cliente.
DROP POLICY IF EXISTS "convite_aceites_select" ON public.empresa_convite_aceites;
CREATE POLICY "convite_aceites_select" ON public.empresa_convite_aceites FOR SELECT
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "convite_aceites_delete" ON public.empresa_convite_aceites;
CREATE POLICY "convite_aceites_delete" ON public.empresa_convite_aceites FOR DELETE
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

-- -----------------------------------------------------------------------------
-- 4. Disponibilidade do login, checavel ANTES de existir sessao
--    A tela de aceite roda deslogada, entao precisa ser liberada para `anon`.
--    Devolve so um booleano — nunca expoe de quem e o login ocupado.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.username_disponivel(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.username_disponivel(text) TO anon, authenticated;

COMMENT ON FUNCTION public.username_disponivel(text) IS
  'True se o login esta livre. Liberada para anon porque a checagem acontece '
  'na tela de aceite do convite, antes de haver sessao. Retorna apenas o '
  'booleano, sem revelar a quem pertence um login ocupado.';
