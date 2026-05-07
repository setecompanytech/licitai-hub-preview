
CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_por_id_v3(p_batch int DEFAULT 5000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos int := 0;
BEGIN
  WITH faltantes AS (
    SELECT a.registro_id
    FROM public.financeiro_audit_log a
    WHERE a.tabela='financeiro_lancamentos' AND a.operacao='DELETE' AND a.registro_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id=a.registro_id)
    GROUP BY a.registro_id
    LIMIT p_batch
  ),
  snapshot AS (
    SELECT s.dados_antes
    FROM faltantes f
    CROSS JOIN LATERAL (
      SELECT a.dados_antes FROM public.financeiro_audit_log a
      WHERE a.tabela='financeiro_lancamentos' AND a.operacao='DELETE'
        AND a.registro_id=f.registro_id AND a.dados_antes IS NOT NULL
      ORDER BY a.created_at DESC LIMIT 1
    ) s
  ),
  sanitizado AS (
    SELECT
      CASE WHEN s.dados_antes->>'pessoa_id' IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM financeiro_pessoas WHERE id=(s.dados_antes->>'pessoa_id')::uuid)
        THEN s.dados_antes - 'pessoa_id' ELSE s.dados_antes END
      AS d1
    FROM snapshot s
  ),
  s2 AS (SELECT CASE WHEN d1->>'categoria_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_categorias WHERE id=(d1->>'categoria_id')::uuid) THEN d1 - 'categoria_id' ELSE d1 END AS d FROM sanitizado),
  s3 AS (SELECT CASE WHEN d->>'categoria_sugerida_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_categorias WHERE id=(d->>'categoria_sugerida_id')::uuid) THEN d - 'categoria_sugerida_id' ELSE d END AS d FROM s2),
  s4 AS (SELECT CASE WHEN d->>'centro_custo_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_centros_custo WHERE id=(d->>'centro_custo_id')::uuid) THEN d - 'centro_custo_id' ELSE d END AS d FROM s3),
  s5 AS (SELECT CASE WHEN d->>'conta_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE id=(d->>'conta_id')::uuid) THEN d - 'conta_id' ELSE d END AS d FROM s4),
  s6 AS (SELECT CASE WHEN d->>'conta_destino_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_contas WHERE id=(d->>'conta_destino_id')::uuid) THEN d - 'conta_destino_id' ELSE d END AS d FROM s5),
  s7 AS (SELECT CASE WHEN d->>'documento_fiscal_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_documentos_fiscais WHERE id=(d->>'documento_fiscal_id')::uuid) THEN d - 'documento_fiscal_id' ELSE d END AS d FROM s6),
  s8 AS (SELECT CASE WHEN d->>'contrato_item_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contrato_itens WHERE id=(d->>'contrato_item_id')::uuid) THEN d - 'contrato_item_id' ELSE d END AS d FROM s7),
  s9 AS (SELECT CASE WHEN d->>'contrato_pedido_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contrato_pedidos WHERE id=(d->>'contrato_pedido_id')::uuid) THEN d - 'contrato_pedido_id' ELSE d END AS d FROM s8),
  s10 AS (SELECT CASE WHEN d->>'created_by' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id=(d->>'created_by')::uuid) THEN d - 'created_by' ELSE d END AS d FROM s9),
  s11 AS (SELECT CASE WHEN d->>'updated_by' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id=(d->>'updated_by')::uuid) THEN d - 'updated_by' ELSE d END AS d FROM s10),
  -- parcela_pai_id: deixa nullável (ON DELETE SET NULL já existe, mas precisamos validar p/ caso de FK)
  s12 AS (SELECT CASE WHEN d->>'parcela_pai_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM financeiro_lancamentos WHERE id=(d->>'parcela_pai_id')::uuid) THEN d - 'parcela_pai_id' ELSE d END AS d FROM s11),
  inseridos AS (
    INSERT INTO public.financeiro_lancamentos
    SELECT * FROM jsonb_populate_recordset(
      NULL::public.financeiro_lancamentos,
      COALESCE((SELECT jsonb_agg(d) FROM s12), '[]'::jsonb)
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inseridos FROM inseridos;
  RETURN COALESCE(v_inseridos, 0);
END;
$$;
