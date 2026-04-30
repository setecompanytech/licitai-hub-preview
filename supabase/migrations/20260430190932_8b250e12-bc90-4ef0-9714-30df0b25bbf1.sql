CREATE OR REPLACE FUNCTION public.sincronizar_saldos_contas_sem_movimento(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_uid uuid := auth.uid();
  v_autorizado boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não informada.';
  END IF;

  -- Verifica vínculo do usuário com a empresa (dono ou membro)
  SELECT EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = p_empresa_id
      AND (
        e.user_id = v_uid
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(e.membros, '[]'::jsonb)) m
          WHERE (m->>'user_id')::uuid = v_uid
        )
      )
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;

  WITH alvos AS (
    SELECT c.id
    FROM public.financeiro_contas c
    WHERE c.empresa_id = p_empresa_id
      AND COALESCE(c.ativa, true) = true
      AND COALESCE(c.saldo_atual, 0) <> COALESCE(c.saldo_inicial, 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_lancamentos l
        WHERE l.conta_id = c.id
      )
  )
  UPDATE public.financeiro_contas c
     SET saldo_atual = COALESCE(c.saldo_inicial, 0),
         updated_at  = now()
    FROM alvos
   WHERE c.id = alvos.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sincronizar_saldos_contas_sem_movimento(uuid) TO authenticated;