UPDATE public.financeiro_contas SET ativa=true 
WHERE id IN ('66c399fd-1f48-4c25-8db4-674ce626bebb','42360b9d-fd72-40c2-a02f-ac441e8fc3c6','bcf98fce-4e12-4332-9a7a-97e7e2032a4e','bc705144-61ec-4d84-9595-3a1e26103114');

CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_audit(p_limite int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  v_inserted int;
BEGIN
  ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_audit_fl;
  ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_marcar_apuracao_desatualizada;

  WITH alvo AS (
    SELECT al.dados_antes
    FROM public.financeiro_audit_log al
    WHERE al.tabela='financeiro_lancamentos'
      AND al.operacao='DELETE'
      AND al.created_at > now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id = (al.dados_antes->>'id')::uuid)
    LIMIT p_limite
  )
  INSERT INTO public.financeiro_lancamentos
  SELECT (jsonb_populate_record(NULL::public.financeiro_lancamentos, dados_antes)).*
  FROM alvo
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  ALTER TABLE public.financeiro_lancamentos ENABLE TRIGGER trg_audit_fl;
  ALTER TABLE public.financeiro_lancamentos ENABLE TRIGGER trg_marcar_apuracao_desatualizada;

  RETURN v_inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.restaurar_lancamentos_audit(int) FROM PUBLIC;