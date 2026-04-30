REVOKE EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) TO authenticated;