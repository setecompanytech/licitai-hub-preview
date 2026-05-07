-- Fila pré-computada de IDs a restaurar
CREATE TABLE IF NOT EXISTS public.restauracao_lancamentos_fila (
  registro_id uuid PRIMARY KEY,
  processado_em timestamptz
);
ALTER TABLE public.restauracao_lancamentos_fila ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin select fila" ON public.restauracao_lancamentos_fila;
CREATE POLICY "admin select fila" ON public.restauracao_lancamentos_fila FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_fila_pendente ON public.restauracao_lancamentos_fila (registro_id) WHERE processado_em IS NULL;

-- Função para popular a fila (executar uma vez, em background)
CREATE OR REPLACE FUNCTION public.popular_fila_restauracao(p_batch int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cnt int;
BEGIN
  PERFORM set_config('statement_timeout','55000',true);
  WITH novos AS (
    SELECT DISTINCT a.registro_id
    FROM public.financeiro_audit_log a
    WHERE a.tabela='financeiro_lancamentos' AND a.operacao='DELETE' AND a.registro_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id=a.registro_id)
      AND NOT EXISTS (SELECT 1 FROM public.restauracao_lancamentos_fila f WHERE f.registro_id=a.registro_id)
    LIMIT p_batch
  )
  INSERT INTO public.restauracao_lancamentos_fila (registro_id)
  SELECT registro_id FROM novos;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;

-- Novo tick: consome da fila (rápido)
CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_ids uuid[];
  v_inseridos int := 0;
BEGIN
  PERFORM set_config('statement_timeout','55000',true);
  PERFORM set_config('lock_timeout','5000',true);

  SELECT array_agg(registro_id) INTO v_ids FROM (
    SELECT registro_id FROM public.restauracao_lancamentos_fila
    WHERE processado_em IS NULL LIMIT 300 FOR UPDATE SKIP LOCKED
  ) q;

  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
    UPDATE public.restauracao_lancamentos_progresso
    SET ultima_execucao=now(),
        finalizado_em = COALESCE(finalizado_em, now()),
        ultimo_lote=0, erro=NULL
    WHERE id=1;
    RETURN;
  END IF;

  WITH snapshot AS (
    SELECT a.registro_id, a.dados_antes
    FROM unnest(v_ids) AS u(rid)
    CROSS JOIN LATERAL (
      SELECT a.dados_antes, a.registro_id FROM public.financeiro_audit_log a
      WHERE a.tabela='financeiro_lancamentos' AND a.operacao='DELETE'
        AND a.registro_id=u.rid AND a.dados_antes IS NOT NULL
      ORDER BY a.created_at DESC LIMIT 1
    ) a
  ),
  s1 AS (SELECT CASE WHEN dados_antes->>'pessoa_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_pessoas WHERE id=(dados_antes->>'pessoa_id')::uuid) THEN dados_antes - 'pessoa_id' ELSE dados_antes END AS d FROM snapshot),
  s2 AS (SELECT CASE WHEN d->>'categoria_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_categorias WHERE id=(d->>'categoria_id')::uuid) THEN d - 'categoria_id' ELSE d END AS d FROM s1),
  s3 AS (SELECT CASE WHEN d->>'categoria_sugerida_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_categorias WHERE id=(d->>'categoria_sugerida_id')::uuid) THEN d - 'categoria_sugerida_id' ELSE d END AS d FROM s2),
  s4 AS (SELECT CASE WHEN d->>'centro_custo_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_centros_custo WHERE id=(d->>'centro_custo_id')::uuid) THEN d - 'centro_custo_id' ELSE d END AS d FROM s3),
  s5 AS (SELECT CASE WHEN d->>'conta_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE id=(d->>'conta_id')::uuid) THEN d - 'conta_id' ELSE d END AS d FROM s4),
  s6 AS (SELECT CASE WHEN d->>'conta_destino_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE id=(d->>'conta_destino_id')::uuid) THEN d - 'conta_destino_id' ELSE d END AS d FROM s5),
  s7 AS (SELECT CASE WHEN d->>'documento_fiscal_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_documentos_fiscais WHERE id=(d->>'documento_fiscal_id')::uuid) THEN d - 'documento_fiscal_id' ELSE d END AS d FROM s6),
  s8 AS (SELECT CASE WHEN d->>'contrato_item_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contrato_itens WHERE id=(d->>'contrato_item_id')::uuid) THEN d - 'contrato_item_id' ELSE d END AS d FROM s7),
  s9 AS (SELECT CASE WHEN d->>'contrato_pedido_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contrato_pedidos WHERE id=(d->>'contrato_pedido_id')::uuid) THEN d - 'contrato_pedido_id' ELSE d END AS d FROM s8),
  s10 AS (SELECT CASE WHEN d->>'created_by' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id=(d->>'created_by')::uuid) THEN d - 'created_by' ELSE d END AS d FROM s9),
  s11 AS (SELECT CASE WHEN d->>'updated_by' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id=(d->>'updated_by')::uuid) THEN d - 'updated_by' ELSE d END AS d FROM s10),
  s12 AS (SELECT CASE WHEN d->>'parcela_pai_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_lancamentos WHERE id=(d->>'parcela_pai_id')::uuid) THEN d - 'parcela_pai_id' ELSE d END AS d FROM s11),
  ins AS (
    INSERT INTO public.financeiro_lancamentos
    SELECT * FROM jsonb_populate_recordset(NULL::public.financeiro_lancamentos, COALESCE((SELECT jsonb_agg(d) FROM s12),'[]'::jsonb))
    ON CONFLICT (id) DO NOTHING RETURNING 1
  )
  SELECT COUNT(*) INTO v_inseridos FROM ins;

  UPDATE public.restauracao_lancamentos_fila SET processado_em=now()
  WHERE registro_id = ANY(v_ids);

  UPDATE public.restauracao_lancamentos_progresso
  SET total_restaurado = total_restaurado + COALESCE(v_inseridos,0),
      lotes = lotes + 1,
      ultimo_lote = COALESCE(v_inseridos,0),
      ultima_execucao = now(),
      erro = NULL
  WHERE id=1;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.restauracao_lancamentos_progresso
  SET erro=SQLERRM, ultima_execucao=now() WHERE id=1;
END;
$$;

-- Cron para popular fila (a cada 1 min até completar)
DO $$ BEGIN PERFORM cron.unschedule('popular-fila-restauracao'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('popular-fila-restauracao', '* * * * *',
  $$ SELECT public.popular_fila_restauracao(5000); $$);