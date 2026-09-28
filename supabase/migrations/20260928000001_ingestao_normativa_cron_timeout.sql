-- ============================================================================
-- Ingestão normativa diária: o cron esperava só 5 segundos pela edge
-- ============================================================================
--
-- 28/09/2026, 01:30 (Belém): `cron.job_run_details` diz "succeeded" e nenhuma
-- coleta foi registrada. O `net.http_post` do job não passava
-- `timeout_milliseconds`, e o padrão do pg_net é 5 s: a conexão caía antes de
-- a edge terminar o Planalto (≈14 s), e a execução morria junto. Os outros
-- jobs longos do projeto (18/04) já usam 1.500.000 ms.
-- A edge também passou a responder de imediato ao cron e seguir em segundo
-- plano (EdgeRuntime.waitUntil); o timeout maior é a segunda rede.
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingestao-normativa-diaria') THEN
      PERFORM cron.unschedule('ingestao-normativa-diaria');
    END IF;
    PERFORM cron.schedule(
      'ingestao-normativa-diaria',
      '30 4 * * *',   -- 04:30 UTC = 01:30 em Belém
      $job$
  SELECT net.http_post(
    url     := public.supabase_project_url() || '/functions/v1/ingestao-normativa',
    headers := public.cron_auth_header(),
    body    := '{}'::jsonb,
    timeout_milliseconds := 600000
  );
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron ausente: a ingestão normativa diária não foi agendada.';
  END IF;
END $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'ingestao-normativa-diaria';
--   -- O command deve conter timeout_milliseconds := 600000.
--   -- No dia seguinte: SELECT fonte, iniciado_em, novos, detalhe FROM public.base_normativa_coletas ORDER BY iniciado_em DESC LIMIT 3;
--   -- Esperado: três linhas por volta de 01:30 (Belém) com detalhe->>'disparo' = 'cron'.
