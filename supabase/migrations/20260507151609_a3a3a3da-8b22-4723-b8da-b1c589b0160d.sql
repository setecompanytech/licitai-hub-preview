
CREATE OR REPLACE FUNCTION public.backfill_origem_lancamentos(p_limite int DEFAULT 5000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.financeiro_lancamentos l
  SET origem_tipo='migracao',
      origem_timestamp = COALESCE(origem_timestamp, l.created_at, now())
  WHERE l.id IN (
    SELECT id FROM public.financeiro_lancamentos WHERE origem_tipo IS NULL LIMIT p_limite
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.backfill_origem_lancamentos(int) FROM PUBLIC, anon, authenticated;
