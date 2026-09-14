-- ============================================================================
-- Segredos do robô fora do navegador
--
-- Em 14/09/2026 dois segredos continuavam alcançáveis pela API REST do
-- Supabase, mesmo depois de as telas pararem de pedi-los:
--
--   1. `agente_externo_config.api_key_hash` — apesar do nome, é a chave EM
--      CLARO que a edge function manda ao agente em `X-Agent-Key` e que o
--      `callback` exige de volta. A policy "Users can CRUD own agente config"
--      deixa o dono ler a própria linha inteira: qualquer usuário logado fazia
--      `select=api_key_hash` no DevTools e passava a falar direto com o agente
--      — e a forjar callbacks de sessão.
--   2. `credenciais_portais.senha_hash` — a senha do portal, cifrada. Cifrada
--      não quer dizer pública: com o texto cifrado fora do servidor, tudo passa
--      a depender de o segredo de cifra nunca vazar.
--
-- RLS decide LINHAS; quem decide COLUNAS é privilégio. Aqui o SELECT de tabela
-- inteira sai de `anon` e `authenticated` e volta para `authenticated` coluna
-- a coluna — todas, menos o segredo. `service_role` (edge functions) não é
-- tocado e segue lendo tudo. INSERT/UPDATE/DELETE não mudam.
--
-- `anon` não recebe a lista de volta: as policies dessas tabelas exigem
-- `auth.uid() = user_id`, então anônimo nunca teve linha nenhuma para ler.
--
-- A lista de colunas é lida de `information_schema` na hora de aplicar, e não
-- escrita à mão: uma coluna criada pelo painel e ausente das migrations
-- continua legível. (Rodar no SQL Editor, como `postgres` — o
-- `information_schema` só lista colunas que o papel corrente enxerga.)
--
-- ⚠️ Efeito a lembrar: COLUNA NOVA criada DEPOIS desta migration nessas duas
-- tabelas nasce sem SELECT para `authenticated`. Rode este arquivo de novo (é
-- idempotente) ou faça o GRANT da coluna nova.
--
-- Leitores conferidos no front em 14/09/2026:
--   agente_externo_config → AgenteExternoConfig e AtivacaoChecklist (colunas
--     explícitas, sem a chave) e useParticipacoesDoRobo
--     (`capacidades, updated_at`). Um `select('*')` nessa tabela passa a
--     falhar com "permission denied" — de propósito.
--   credenciais_portais → nenhum leitor direto. As telas usam
--     `credenciais_portais_safe` (security_invoker, não seleciona
--     `senha_hash`), que segue funcionando.
--
-- Esta migration NÃO troca a chave comprometida: a que estava no bundle
-- continua no histórico do git. A rotação é no `.env` da VPS + segredo
-- `AGENTE_API_KEY` da edge function (ver robo-lances-webhook/configurar-agente).
--
-- ── Reversão ────────────────────────────────────────────────────────────────
--   GRANT SELECT ON TABLE public.agente_externo_config TO anon, authenticated;
--   GRANT SELECT ON TABLE public.credenciais_portais   TO anon, authenticated;
--   (as concessões por coluna ficam redundantes e podem permanecer)
-- ============================================================================

DO $$
DECLARE
  alvo record;
  v_colunas text;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('agente_externo_config', 'api_key_hash'),
      ('credenciais_portais',   'senha_hash')
    ) AS t(tabela, segredo)
  LOOP
    IF to_regclass(format('public.%I', alvo.tabela)) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe — nada a fazer.', alvo.tabela;
      CONTINUE;
    END IF;

    SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
      INTO v_colunas
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = alvo.tabela
       AND column_name <> alvo.segredo;

    -- REVOKE de tabela também revoga os privilégios de coluna já concedidos
    -- (comportamento documentado do Postgres). Por isso a ordem: tira tudo,
    -- depois devolve coluna a coluna — rodar de novo chega ao mesmo estado.
    EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM anon, authenticated', alvo.tabela);

    IF v_colunas IS NOT NULL THEN
      EXECUTE format('GRANT SELECT (%s) ON TABLE public.%I TO authenticated', v_colunas, alvo.tabela);
    END IF;
  END LOOP;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- Os dois primeiros têm que sair `false`; os dois últimos, `true`.
DO $$
BEGIN
  IF to_regclass('public.agente_externo_config') IS NOT NULL THEN
    RAISE NOTICE 'authenticated lê agente_externo_config.api_key_hash? %  · lê url_base? %',
      has_column_privilege('authenticated', 'public.agente_externo_config', 'api_key_hash', 'SELECT'),
      has_column_privilege('authenticated', 'public.agente_externo_config', 'url_base', 'SELECT');
  END IF;
  IF to_regclass('public.credenciais_portais') IS NOT NULL THEN
    RAISE NOTICE 'authenticated lê credenciais_portais.senha_hash? %  · lê portal_id? %',
      has_column_privilege('authenticated', 'public.credenciais_portais', 'senha_hash', 'SELECT'),
      has_column_privilege('authenticated', 'public.credenciais_portais', 'portal_id', 'SELECT');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
