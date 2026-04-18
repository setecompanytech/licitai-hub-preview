CREATE OR REPLACE FUNCTION public.pncp_status_sincronizacao()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ultima_sync_sucesso', (SELECT concluido_em FROM public.pncp_sync_log WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1),
    'ultima_sync_status', (SELECT status FROM public.pncp_sync_log ORDER BY iniciado_em DESC LIMIT 1),
    'novos_ultima_sync', (SELECT novos FROM public.pncp_sync_log WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1),
    'total_editais', (SELECT count(*) FROM public.pncp_editais_cache),
    'editais_abertos', (SELECT count(*) FROM public.pncp_editais_cache WHERE data_encerramento_proposta >= now()),
    'minutos_desde_ultima_sync', (SELECT EXTRACT(EPOCH FROM (now() - concluido_em))/60 FROM public.pncp_sync_log WHERE status = 'sucesso' ORDER BY concluido_em DESC LIMIT 1)
  );
$$;