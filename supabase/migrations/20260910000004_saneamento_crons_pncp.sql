-- ============================================================================
-- Saneamento dos crons do PNCP e das funções de coleta (10/09)
-- ============================================================================
-- Três achados na investigação do "Boletim IA: 0 editais":
--
-- 1. `pesquisa-tempo-real-30min` (job 2) e `coletar-portais-cron` (job 3)
--    autenticavam com o service_role guardado no VAULT — chave defasada em
--    relação ao ambiente atual: o job 2 tomava 401 a cada meia hora (visível
--    em net._http_response) e o pg_cron seguia dizendo "succeeded". Ambos
--    passam ao padrão da casa: supabase_project_url() + cron_auth_header().
--
-- 2. `pncp-sync-madrugada` (job 19) rodava às 06:05 UTC — DENTRO da janela
--    da semeadura do acervo (04:00-08:59, a cada 4 min). Os dois somados
--    estouram o rate limit do PNCP (que apertou em ~08/09: ~26 requisições
--    e começa o 429). Vai para 03:10 UTC, antes da janela.
--
-- 3. O sync em si foi redesenhado (cadeia com cursor) na própria edge —
--    sem mudança de schema.
SELECT cron.unschedule('pesquisa-tempo-real-30min')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pesquisa-tempo-real-30min');

SELECT cron.schedule(
  'pesquisa-tempo-real-30min',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/pesquisa-tempo-real',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('coletar-portais-cron')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coletar-portais-cron');

SELECT cron.schedule(
  'coletar-portais-cron',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/coletar-portais',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('pncp-sync-madrugada')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pncp-sync-madrugada');

SELECT cron.schedule(
  'pncp-sync-madrugada',
  '10 3 * * *',
  $$
  SELECT net.http_post(
    url := public.supabase_project_url() || '/functions/v1/pncp-sync-diario',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
  $$
);
