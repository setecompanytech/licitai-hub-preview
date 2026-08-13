-- =============================================================================
-- Reagenda os jobs que apontavam para um projeto Supabase inexistente
--
-- DIAGNÓSTICO (2026-08-13). Os 14 jobs de `cron.job` se dividiam em dois grupos,
-- com correlação perfeita entre a forma de montar a URL e o resultado:
--
--   a) Montam a URL pelo vault  → status 'failed' (4 de 4)
--      O vault só tinha `email_queue_service_role_key`, então
--      `NULL || '/functions/v1/...'` = NULL e `net.http_post(url := NULL)`
--      levanta erro. Resolvido criando `SUPABASE_URL` no vault.
--
--   b) URL fixa 'sbnlovigyifvrkgsoalj' → status 'succeeded' (4 de 4)
--      Verde falso: `net.http_post` é assíncrono e o pg_cron só registra se o
--      comando SQL rodou, não se o HTTP chegou. Esse ref não existe na
--      organização (docs/pendencias.md, 2026-08-08) — os POSTs saem para o
--      vazio desde então.
--
-- Evidência do impacto: `pncp_sync_log` não recebe uma linha desde 2026-06-25,
-- e 0 syncs nos últimos 7 dias. Os 6.147 editais em cache entraram pelo app,
-- que chama as funções direto do navegador quando alguém abre a tela.
--
-- Esta migration trata só o grupo (b). O grupo (a) se resolveu sozinho quando
-- `SUPABASE_URL` passou a existir no vault.
-- =============================================================================

-- Idempotência: derruba os agendamentos antigos antes de recriar.
SELECT cron.unschedule(j.jobname)
  FROM cron.job j
 WHERE j.jobname IN (
   'boletim-ia-diario-06h',
   'pncp-sync-madrugada',
   'pncp-sync-meiodia',
   'mural-telemetria-alerta-15min'
 );

-- -----------------------------------------------------------------------------
-- Helper: monta a URL do projeto uma vez só, em vez de repetir o COALESCE em
-- cada job. O literal é o último recurso — o mesmo projeto ao qual o app está
-- preso em quatro lugares (client.ts:5, vite.config.ts:12, .env, config.toml).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.supabase_project_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1),
    'https://uwtyuwktxalnpgrcbbgk.supabase.co'
  );
$$;

COMMENT ON FUNCTION public.supabase_project_url() IS
  'URL do projeto para os jobs do pg_cron. Existe para que a URL apareça em um '
  'lugar só: quatro migrations de 2026-04 fixaram um host que nao existe mais, '
  'e o erro passou meses sem ser notado porque net.http_post e assincrono.';

CREATE OR REPLACE FUNCTION public.cron_auth_header()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' ||
      COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1), '')
  );
$$;

COMMENT ON FUNCTION public.cron_auth_header() IS
  'Header de autenticacao dos jobs. As edge functions comparam este token com '
  'o CRON_SECRET do proprio ambiente (Deno.env) e devolvem 401 se diferir — os '
  'dois lados precisam ser cadastrados com o mesmo valor.';

-- -----------------------------------------------------------------------------
-- Reagendamento — mesmos horários de antes, host correto.
-- -----------------------------------------------------------------------------

-- Boletim diário por e-mail. 09:00 UTC = 06:00 BRT.
SELECT cron.schedule(
  'boletim-ia-diario-06h',
  '0 9 * * *',
  $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/boletim-ia-diario',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
  $job$
);

-- Sincronização do PNCP, duas janelas: 06:05 e 15:05 UTC.
SELECT cron.schedule(
  'pncp-sync-madrugada',
  '5 6 * * *',
  $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/pncp-sync-diario',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
  $job$
);

SELECT cron.schedule(
  'pncp-sync-meiodia',
  '5 15 * * *',
  $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/pncp-sync-diario',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
  $job$
);

-- Alerta de telemetria do mural, a cada 15 minutos.
SELECT cron.schedule(
  'mural-telemetria-alerta-15min',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/mural-telemetria-alerta',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
  $job$
);

-- -----------------------------------------------------------------------------
-- `licitacoes-cleanup-diario` (criado hoje) passa a usar os mesmos helpers,
-- em vez de repetir o COALESCE inline.
-- -----------------------------------------------------------------------------
SELECT cron.unschedule('licitacoes-cleanup-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'licitacoes-cleanup-diario');

SELECT cron.schedule(
  'licitacoes-cleanup-diario',
  '20 6 * * *',
  $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/licitacoes-cleanup',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb
  );
  $job$
);

-- -----------------------------------------------------------------------------
-- NÃO reagendado de propósito: `crawler-pncp-30min`. Ele está nas migrations de
-- 2026-04 mas não existe em `cron.job` hoje, o que sugere remoção deliberada
-- quando o `pncp-sync-diario` passou a cobrir a coleta. Recriá-lo sem saber o
-- motivo poderia duplicar ingestão. Decidir antes de reativar.
-- -----------------------------------------------------------------------------
