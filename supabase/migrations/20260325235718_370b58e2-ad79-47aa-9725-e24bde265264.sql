
-- Add updated_at column to pncp_editais_cache if not exists
ALTER TABLE public.pncp_editais_cache ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger to auto-update updated_at on upsert
CREATE OR REPLACE FUNCTION public.update_pncp_cache_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pncp_cache_updated_at ON public.pncp_editais_cache;
CREATE TRIGGER trg_pncp_cache_updated_at
  BEFORE INSERT OR UPDATE ON public.pncp_editais_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pncp_cache_updated_at();

-- Index on updated_at for efficient "recent items" queries
CREATE INDEX IF NOT EXISTS idx_pncp_cache_updated_at ON public.pncp_editais_cache (updated_at DESC);

-- Index on objeto for keyword search (GIN trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_pncp_cache_objeto_trgm ON public.pncp_editais_cache USING gin (objeto gin_trgm_ops);

-- Schedule crawler-pncp to run every 30 minutes via pg_cron
SELECT cron.schedule(
  'crawler-pncp-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/crawler-pncp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{"dias_atras": 3, "dias_futuros": 30}'::jsonb
  );
  $$
);

-- Schedule pesquisa-tempo-real to run every 30 minutes (offset by 15 min from crawler)
SELECT cron.schedule(
  'pesquisa-tempo-real-30min',
  '15,45 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/pesquisa-tempo-real',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
