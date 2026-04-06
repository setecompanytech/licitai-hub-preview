
CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'info',
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  error_details TEXT,
  context TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_level_created ON public.system_logs (level, created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert logs
CREATE POLICY "Authenticated users can insert logs"
  ON public.system_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only admins can read logs
CREATE POLICY "Admins can read logs"
  ON public.system_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
