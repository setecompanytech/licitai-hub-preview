-- Fase 2: agendar boletim IA diário às 06h BRT (09h UTC)
-- Garante extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('boletim-ia-diario-06h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda novo job — chama edge function autenticando via CRON_SECRET (Bearer)
SELECT cron.schedule(
  'boletim-ia-diario-06h',
  '0 9 * * *', -- 09:00 UTC = 06:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/boletim-ia-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);