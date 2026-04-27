-- Tabela de log dos disparos de alerta
CREATE TABLE IF NOT EXISTS public.mural_alerta_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  janela_minutos integer NOT NULL,
  total_eventos integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  total_warnings integer NOT NULL DEFAULT 0,
  duplicatas_total integer NOT NULL DEFAULT 0,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  destinatarios_email jsonb NOT NULL DEFAULT '[]'::jsonb,
  envios_email jsonb NOT NULL DEFAULT '[]'::jsonb,
  slack jsonb NOT NULL DEFAULT '{}'::jsonb,
  amostras jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mural_alerta_log_created_at
  ON public.mural_alerta_log (created_at DESC);

ALTER TABLE public.mural_alerta_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mural_alerta_log' AND policyname = 'Admins podem ver alertas do mural'
  ) THEN
    CREATE POLICY "Admins podem ver alertas do mural"
      ON public.mural_alerta_log
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Extensões necessárias para o cron HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior (se existir) para reagendar de forma idempotente
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'mural-telemetria-alerta-15min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Agenda a cada 15 minutos
SELECT cron.schedule(
  'mural-telemetria-alerta-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sbnlovigyifvrkgsoalj.supabase.co/functions/v1/mural-telemetria-alerta',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmxvdmlneWlmdnJrZ3NvYWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTI5MzUsImV4cCI6MjA4NzI4ODkzNX0.IAI8PmpKVKNuME8j9Otoq7htk-O4pjcM55og7ZZGVmU'
    ),
    body := jsonb_build_object('source', 'cron', 'ts', now())
  );
  $$
);