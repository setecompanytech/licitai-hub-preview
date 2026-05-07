CREATE OR REPLACE FUNCTION public.restaurar_lancamentos_audit(p_limite int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_count int;
BEGIN
  ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_audit_fl;
  ALTER TABLE public.financeiro_lancamentos DISABLE TRIGGER trg_marcar_apuracao_desatualizada;

  WITH alvo AS (
    SELECT al.dados_antes
    FROM public.financeiro_audit_log al
    WHERE al.tabela='financeiro_lancamentos' AND al.operacao='DELETE'
      AND al.created_at > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos l WHERE l.id = (al.dados_antes->>'id')::uuid)
    LIMIT p_limite
  ),
  rec AS (SELECT (jsonb_populate_record(NULL::public.financeiro_lancamentos, dados_antes)).* FROM alvo)
  INSERT INTO public.financeiro_lancamentos
  SELECT r.id, r.empresa_id, r.tipo, r.status, r.natureza, r.descricao, r.valor,
    r.data_competencia, r.data_vencimento, r.data_realizado, r.data_conciliado,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_contas WHERE id=r.conta_id) THEN r.conta_id END,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_contas WHERE id=r.conta_destino_id) THEN r.conta_destino_id END,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_categorias WHERE id=r.categoria_id) THEN r.categoria_id END,
    CASE WHEN EXISTS(SELECT 1 FROM fin_centros_custo WHERE id=r.centro_custo_id) THEN r.centro_custo_id END,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_pessoas WHERE id=r.pessoa_id) THEN r.pessoa_id END,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_documentos_fiscais WHERE id=r.documento_fiscal_id) THEN r.documento_fiscal_id END,
    r.valor_juros, r.valor_multa, r.valor_desconto, r.valor_tarifa, r.valor_imposto,
    r.forma_pagamento, r.meio_pagamento_dados, r.origem, r.origem_ref,
    r.recorrencia_id, r.recorrencia_rrule, r.edital_id, r.contrato_id,
    CASE WHEN EXISTS(SELECT 1 FROM financeiro_categorias WHERE id=r.categoria_sugerida_id) THEN r.categoria_sugerida_id END,
    r.categoria_sugerida_confianca, r.categoria_sugerida_modelo,
    r.anexos, r.observacoes, r.tags, r.created_at, r.updated_at,
    r.created_by, r.updated_by, r.tipo_documento, r.numero_documento, r.serie_documento,
    r.chave_acesso_nfe, r.data_emissao, r.parcela_numero, r.parcela_total, NULL::uuid,
    r.vendedor_responsavel_id,
    CASE WHEN EXISTS(SELECT 1 FROM contrato_pedidos WHERE id=r.contrato_pedido_id) THEN r.contrato_pedido_id END,
    CASE WHEN EXISTS(SELECT 1 FROM contrato_itens WHERE id=r.contrato_item_id) THEN r.contrato_item_id END,
    r.origem_tipo, r.origem_lote_id, r.origem_job, r.origem_usuario_id, r.origem_timestamp, r.origem_metadata
  FROM rec r ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  ALTER TABLE public.financeiro_lancamentos ENABLE TRIGGER trg_audit_fl;
  ALTER TABLE public.financeiro_lancamentos ENABLE TRIGGER trg_marcar_apuracao_desatualizada;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.restaurar_lancamentos_audit(int) TO service_role;