-- Pause old cron and recreate tick with smaller batch + timeouts
DO $$
BEGIN
  PERFORM cron.unschedule('restaurar-lancamentos-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurado int;
BEGIN
  PERFORM set_config('statement_timeout', '50000', true);
  PERFORM set_config('lock_timeout', '5000', true);

  SELECT public.restaurar_lancamentos_por_id_v3(200) INTO v_restaurado;

  UPDATE public.restauracao_lancamentos_progresso
  SET
    total_restaurado = total_restaurado + COALESCE(v_restaurado, 0),
    lotes = lotes + 1,
    ultimo_lote = COALESCE(v_restaurado, 0),
    ultima_execucao = now(),
    finalizado_em = CASE WHEN COALESCE(v_restaurado,0) = 0 THEN now() ELSE finalizado_em END,
    erro = NULL
  WHERE id = 1;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.restauracao_lancamentos_progresso
  SET erro = SQLERRM, ultima_execucao = now()
  WHERE id = 1;
END;
$$;

SELECT cron.schedule(
  'restaurar-lancamentos-tick',
  '*/2 * * * *',
  $$ SELECT public.restaurar_lancamentos_tick() WHERE (SELECT finalizado_em IS NULL FROM public.restauracao_lancamentos_progresso WHERE id = 1); $$
);