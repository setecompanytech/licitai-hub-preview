-- ============================================================================
-- Relatório de Consumo da ATA volta a funcionar (e para toda a empresa)
-- ============================================================================
--
-- Dois defeitos na relatorio_consumo_ata:
-- 1) `array_agg(DISTINCT (regexp_matches(...))[1])` — regexp_matches é função
--    de CONJUNTO e o Postgres proíbe conjunto dentro de agregação: o botão
--    PDF/CSV caía com "aggregate function calls cannot contain set-returning
--    function calls". Trocado por substring(), que devolve o primeiro match
--    como escalar (o padrão captura um UUID inteiro; um por linha basta).
-- 2) Acesso exigia ser o DONO da ata (user_id = auth.uid()) — colegas da
--    empresa eram barrados. Agora vale is_empresa_member (princípio 2).

CREATE OR REPLACE FUNCTION public.relatorio_consumo_ata(p_ata_id uuid, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date, p_limite_detalhe integer DEFAULT 500, p_offset_detalhe integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_ata JSONB;
  v_resumo_contratos JSONB;
  v_detalhe_itens JSONB;
  v_saldos JSONB;
  v_total_detalhe INTEGER;
  v_overrides_set UUID[];
BEGIN
  -- Processo é da EMPRESA (princípio 2): membro da empresa acessa o
  -- relatório; exigir ser o dono barrava colegas — a mesma classe do
  -- defeito M2 do painel.
  SELECT user_id INTO v_user_id FROM public.contratos c
   WHERE c.id = p_ata_id
     AND public.is_empresa_member(auth.uid(), c.empresa_id);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'ATA não encontrada ou acesso negado' USING ERRCODE = '42501';
  END IF;

  -- Cabeçalho da ATA
  SELECT to_jsonb(c) INTO v_ata
  FROM (
    SELECT id, numero_contrato, numero_ata, objeto, orgao_contratante,
           valor_global, valor_global_original, valor_consumido,
           data_assinatura, data_fim
    FROM public.contratos WHERE id = p_ata_id
  ) c;

  -- Conjunto de IDs de itens marcados como override manual (pré-cálculo único)
  -- substring() devolve o PRIMEIRO match como escalar: regexp_matches é
  -- função de conjunto e o Postgres proíbe conjunto dentro de agregação —
  -- era o erro que derrubava o relatório (09/09).
  SELECT COALESCE(array_agg(DISTINCT substring(valor_novo from '[0-9a-f-]{36}')::uuid), ARRAY[]::uuid[])
  INTO v_overrides_set
  FROM public.contrato_ia_auditoria
  WHERE contrato_id = p_ata_id
    AND origem = 'manual_override'
    AND valor_novo ~ '[0-9a-f-]{36}';

  -- Resumo agregado por contrato derivado (tudo no banco)
  WITH derivados AS (
    SELECT id, numero_contrato, orgao_contratante, data_assinatura, valor_global, status
    FROM public.contratos
    WHERE ata_srp_id = p_ata_id
      AND tipo_documento = 'contrato'
      AND (p_data_inicio IS NULL OR data_assinatura >= p_data_inicio)
      AND (p_data_fim IS NULL OR data_assinatura <= p_data_fim)
  ),
  itens_d AS (
    SELECT ci.contrato_id, ci.id, ci.ata_item_id, ci.valor_total
    FROM public.contrato_itens ci
    WHERE ci.contrato_id IN (SELECT id FROM derivados)
  ),
  classif AS (
    SELECT i.contrato_id,
      COUNT(*) AS qtd_itens,
      COALESCE(SUM(i.valor_total),0) AS valor_total,
      COUNT(*) FILTER (WHERE i.ata_item_id IS NOT NULL AND NOT (i.id = ANY(v_overrides_set))) AS ia,
      COUNT(*) FILTER (WHERE i.id = ANY(v_overrides_set)) AS override_,
      COUNT(*) FILTER (WHERE i.ata_item_id IS NULL) AS sem_vinculo
    FROM itens_d i
    GROUP BY i.contrato_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'numero', d.numero_contrato,
    'orgao', d.orgao_contratante,
    'data_assinatura', d.data_assinatura,
    'qtd_itens', COALESCE(c.qtd_itens,0),
    'valor_total', COALESCE(c.valor_total,0),
    'ia', COALESCE(c.ia,0),
    'override', COALESCE(c.override_,0),
    'manual', 0,
    'sem', COALESCE(c.sem_vinculo,0),
    'status', d.status
  ) ORDER BY d.data_assinatura DESC), '[]'::jsonb)
  INTO v_resumo_contratos
  FROM derivados d LEFT JOIN classif c ON c.contrato_id = d.id;

  -- Total de itens para paginação
  SELECT COUNT(*)
  INTO v_total_detalhe
  FROM public.contrato_itens ci
  WHERE ci.contrato_id IN (
    SELECT id FROM public.contratos
    WHERE ata_srp_id = p_ata_id AND tipo_documento = 'contrato'
      AND (p_data_inicio IS NULL OR data_assinatura >= p_data_inicio)
      AND (p_data_fim IS NULL OR data_assinatura <= p_data_fim)
  );

  -- Detalhe paginado (com join para descrição da ATA)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'contrato_numero', ct.numero_contrato,
    'orgao', ct.orgao_contratante,
    'data_assinatura', ct.data_assinatura,
    'item_descricao', ci.descricao,
    'ata_item_descricao', COALESCE(ai.descricao, CASE WHEN ci.ata_item_id IS NOT NULL THEN '(item removido)' ELSE '—' END),
    'unidade', COALESCE(ci.unidade, ai.unidade, '—'),
    'qtd_consumida', COALESCE(ci.quantidade_contratada, 0),
    'valor_unitario', COALESCE(ci.valor_unitario, 0),
    'valor_total', COALESCE(ci.valor_total, 0),
    'origem_vinculo', CASE
      WHEN ci.ata_item_id IS NULL THEN 'Sem vínculo'
      WHEN ci.id = ANY(v_overrides_set) THEN 'Override'
      ELSE 'IA'
    END,
    'motivo', CASE WHEN ci.ata_item_id IS NOT NULL THEN 'vinculado' ELSE 'sem_vinculo' END
  )), '[]'::jsonb)
  INTO v_detalhe_itens
  FROM public.contrato_itens ci
  JOIN public.contratos ct ON ct.id = ci.contrato_id
  LEFT JOIN public.contrato_itens ai ON ai.id = ci.ata_item_id
  WHERE ct.ata_srp_id = p_ata_id
    AND ct.tipo_documento = 'contrato'
    AND (p_data_inicio IS NULL OR ct.data_assinatura >= p_data_inicio)
    AND (p_data_fim IS NULL OR ct.data_assinatura <= p_data_fim)
  ORDER BY ct.data_assinatura DESC, ci.numero_item NULLS LAST
  LIMIT p_limite_detalhe OFFSET p_offset_detalhe;

  -- Saldos por item da ATA mãe
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'descricao', descricao,
    'unidade', COALESCE(unidade, '—'),
    'qtd_total', COALESCE(quantidade_contratada, 0),
    'qtd_consumida', COALESCE(quantidade_ata_consumida, 0),
    'saldo_qtd', GREATEST(COALESCE(quantidade_contratada,0) - COALESCE(quantidade_ata_consumida,0), 0),
    'valor_total', COALESCE(valor_total, 0),
    'saldo_financeiro', COALESCE(saldo_financeiro, 0)
  ) ORDER BY numero_item NULLS LAST), '[]'::jsonb)
  INTO v_saldos
  FROM public.contrato_itens
  WHERE contrato_id = p_ata_id;

  RETURN jsonb_build_object(
    'ata', v_ata,
    'resumo_contratos', v_resumo_contratos,
    'detalhe_itens', v_detalhe_itens,
    'saldos', v_saldos,
    'total_detalhe', v_total_detalhe,
    'pagina', jsonb_build_object('limite', p_limite_detalhe, 'offset', p_offset_detalhe)
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
