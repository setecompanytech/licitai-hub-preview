-- 1) Tabela LGPD Art. 37
CREATE TABLE IF NOT EXISTS public.lgpd_tratamento_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('acesso','exportacao','exclusao','anonimizacao','retificacao','compartilhamento','coleta')),
  categoria_dados TEXT NOT NULL,
  titular_id TEXT,
  titular_tipo TEXT,
  finalidade TEXT NOT NULL,
  base_legal TEXT NOT NULL DEFAULT 'execucao_contrato',
  modulo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_log_empresa_data ON public.lgpd_tratamento_log(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_log_user ON public.lgpd_tratamento_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lgpd_log_operacao ON public.lgpd_tratamento_log(operacao);

ALTER TABLE public.lgpd_tratamento_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd_admin_select"
ON public.lgpd_tratamento_log FOR SELECT TO authenticated
USING (empresa_id IS NOT NULL AND public.is_empresa_admin(auth.uid(), empresa_id));

CREATE POLICY "lgpd_member_insert"
ON public.lgpd_tratamento_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (empresa_id IS NULL OR public.is_empresa_member(auth.uid(), empresa_id))
);

-- 2) Função de expurgo (5 anos)
CREATE OR REPLACE FUNCTION public.expurgo_auditoria_5anos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lgpd INT := 0; v_ativ INT := 0; v_lance INT := 0; v_fin INT := 0; v_sys INT := 0;
  v_cutoff TIMESTAMPTZ := now() - INTERVAL '5 years';
BEGIN
  WITH d AS (DELETE FROM public.lgpd_tratamento_log WHERE created_at < v_cutoff RETURNING 1) SELECT count(*) INTO v_lgpd FROM d;
  WITH d AS (DELETE FROM public.atividades_colaborador WHERE created_at < v_cutoff RETURNING 1) SELECT count(*) INTO v_ativ FROM d;
  WITH d AS (DELETE FROM public.audit_log_lances WHERE created_at < v_cutoff RETURNING 1) SELECT count(*) INTO v_lance FROM d;
  BEGIN
    EXECUTE 'WITH d AS (DELETE FROM public.financeiro_audit_log WHERE created_at < $1 RETURNING 1) SELECT count(*) FROM d'
      INTO v_fin USING v_cutoff;
  EXCEPTION WHEN undefined_table THEN v_fin := 0; END;
  BEGIN
    EXECUTE 'WITH d AS (DELETE FROM public.system_logs WHERE created_at < $1 RETURNING 1) SELECT count(*) FROM d'
      INTO v_sys USING v_cutoff;
  EXCEPTION WHEN undefined_table THEN v_sys := 0; END;

  RETURN jsonb_build_object(
    'executado_em', now(),
    'cutoff', v_cutoff,
    'lgpd_tratamento_log', v_lgpd,
    'atividades_colaborador', v_ativ,
    'audit_log_lances', v_lance,
    'financeiro_audit_log', v_fin,
    'system_logs', v_sys
  );
END;
$$;

-- 3) Cron diário 03h
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expurgo_auditoria_5anos_diario')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expurgo_auditoria_5anos_diario');
    PERFORM cron.schedule(
      'expurgo_auditoria_5anos_diario',
      '0 3 * * *',
      $cron$ SELECT public.expurgo_auditoria_5anos(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;