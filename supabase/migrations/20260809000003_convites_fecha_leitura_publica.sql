-- =============================================================================
-- MIGRATION: fecha a leitura publica de empresa_convites
-- Data: 2026-08-09
-- SEVERIDADE: alta — vazamento de token de convite entre empresas.
--
-- O que estava aberto:
--   A policy "convite publico por token" era `FOR SELECT USING (true)`. A
--   intencao (pelo proprio comentario original) era permitir buscar UM convite
--   pelo token na tela de aceite, que roda deslogada. Mas RLS nao restringe
--   quais linhas o cliente pede: `USING (true)` libera a tabela inteira.
--
--   Verificado em 09/08/2026 com a chave anon — a mesma que vai no bundle do
--   site — sem nenhuma sessao:
--     GET /rest/v1/empresa_convites?select=token,email_setor,equipe
--   devolveu convites de MULTIPLAS empresas, com os tokens. Token e o unico
--   segredo necessario para criar um acesso dentro da empresa.
--
--   O impacto cresceu com o convite reutilizavel (20260809000001): antes o
--   token morria no primeiro aceite; agora cria acessos ate expirar.
--
-- A correcao:
--   RLS nao sabe dizer "so devolvo se voce informou o token certo" — a
--   condicao vale por linha, nao sobre o filtro que o cliente mandou. Entao a
--   leitura publica sai da tabela e vira uma funcao SECURITY DEFINER que
--   RECEBE o token e devolve no maximo uma linha, sem o proprio token e sem
--   campos que nao interessam a tela de aceite.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fecha a porta
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "convite publico por token" ON public.empresa_convites;

-- O admin da empresa segue com acesso total pela policy "admin pode gerenciar
-- convites", que ja existe e continua valendo.

-- -----------------------------------------------------------------------------
-- 2. Leitura por token, e so por token
--    Nao devolve `token`: quem chama ja o tem, e ecoa-lo so criaria mais uma
--    forma de vazar. Tambem nao devolve empresa_id sozinho sem contexto util.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convite_por_token(p_token text)
RETURNS TABLE (
  id           uuid,
  empresa_id   uuid,
  equipe       text,
  papel        text,
  email_setor  text,
  expires_at   timestamptz,
  usos         int,
  max_usos     int,
  empresa_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         c.empresa_id,
         c.equipe,
         c.papel,
         c.email_setor,
         c.expires_at,
         c.usos,
         c.max_usos,
         COALESCE(e.nome_fantasia, e.razao_social, 'sua empresa') AS empresa_nome
    FROM public.empresa_convites c
    LEFT JOIN public.empresas e ON e.id = c.empresa_id
   WHERE c.token = p_token
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.convite_por_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.convite_por_token(text) IS
  'Dados do convite para a tela de aceite, que roda deslogada. Substitui a '
  'policy SELECT USING(true), que expunha a tabela inteira — incluindo tokens '
  'de outras empresas — a qualquer portador da chave anon. Exige o token e '
  'devolve no maximo uma linha, sem ecoar o proprio token.';
