
-- Rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limit_lookup ON public.rate_limit_log (user_id, function_name, created_at DESC);

-- Auto-cleanup: delete entries older than 1 hour
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM public.rate_limit_log WHERE created_at < now() - interval '1 hour';
$$;

-- Rate limit check function: returns true if allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_max_requests INT DEFAULT 30,
  p_window_minutes INT DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Count recent requests
  SELECT count(*) INTO v_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;
  
  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;
  
  -- Log this request
  INSERT INTO public.rate_limit_log (user_id, function_name)
  VALUES (p_user_id, p_function_name);
  
  -- Opportunistic cleanup (1% chance)
  IF random() < 0.01 THEN
    PERFORM public.cleanup_rate_limit_log();
  END IF;
  
  RETURN true;
END;
$$;

-- RLS: users can only see their own rate limit logs (not really needed but good practice)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
ON public.rate_limit_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Backup verification log table
CREATE TABLE IF NOT EXISTS public.backup_verificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pendente',
  tabelas_verificadas TEXT[] DEFAULT '{}',
  registros_verificados INT DEFAULT 0,
  erros TEXT[] DEFAULT '{}',
  detalhes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.backup_verificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backup verification"
ON public.backup_verificacao FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
