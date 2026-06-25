-- Corrige o constraint único em pncp_editais_cache para funcionar com o
-- Supabase upsert (onConflict: "fonte,fonte_id").
-- Partial unique indexes NÃO funcionam com ON CONFLICT sem WHERE explícito.
-- A solução é um índice não-parcial: NULLs são permitidos pois NULL != NULL no PostgreSQL.

DROP INDEX IF EXISTS public.idx_editais_cache_fonte_id;
DROP INDEX IF EXISTS public.pncp_editais_cache_fonte_fonte_id_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS pncp_editais_cache_fonte_fonte_id_idx
  ON public.pncp_editais_cache (fonte, fonte_id);

-- Corrige o cron job que chamava 'crawler-pncp' (inexistente) para 'pncp-sync-diario'
SELECT cron.unschedule('crawler-pncp-30min');

SELECT cron.schedule(
  'pncp-sync-diario',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/pncp-sync-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{"modo":"orquestrador","dias_para_tras":1}'::jsonb
  );
  $$
);
