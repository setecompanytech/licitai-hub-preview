DO $$
DECLARE r record;
BEGIN
  -- Remove crons antigos do crawler-pncp e quaisquer versões prévias dos novos
  FOR r IN SELECT jobid FROM cron.job
    WHERE jobname IN (
      'crawler-pncp-30min',
      'crawler-pncp-seg0','crawler-pncp-seg1','crawler-pncp-seg2','crawler-pncp-seg3',
      'crawler-pncp-seg4','crawler-pncp-seg5','crawler-pncp-seg6','crawler-pncp-seg7','crawler-pncp-seg8',
      'pncp-sync-madrugada','pncp-sync-meiodia'
    )
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Cron principal: 03h05 BRT (= 06h05 UTC)
SELECT cron.schedule(
  'pncp-sync-madrugada',
  '5 6 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/pncp-sync-diario',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmxvdmlneWlmdnJrZ3NvYWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTI5MzUsImV4cCI6MjA4NzI4ODkzNX0.IAI8PmpKVKNuME8j9Otoq7htk-O4pjcM55og7ZZGVmU'
    ),
    body := jsonb_build_object('modo','diario_madrugada','dias_para_tras', 1),
    timeout_milliseconds := 1500000
  );
  $cmd$
);

-- Cron de reforço: 12h05 BRT (= 15h05 UTC)
SELECT cron.schedule(
  'pncp-sync-meiodia',
  '5 15 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/pncp-sync-diario',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmxvdmlneWlmdnJrZ3NvYWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTI5MzUsImV4cCI6MjA4NzI4ODkzNX0.IAI8PmpKVKNuME8j9Otoq7htk-O4pjcM55og7ZZGVmU'
    ),
    body := jsonb_build_object('modo','reforco_meio_dia','dias_para_tras', 0),
    timeout_milliseconds := 1500000
  );
  $cmd$
);