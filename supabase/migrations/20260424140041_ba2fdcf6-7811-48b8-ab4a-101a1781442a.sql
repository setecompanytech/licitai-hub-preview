-- 1) RPC: Recálculo em massa de todas as ATAs SRP do usuário (ou de uma específica)
-- Reexecuta as triggers de saldo via UPDATE no-op nos contrato_itens dos contratos derivados.
CREATE OR REPLACE FUNCTION public.recalcular_saldos_atas_srp(p_ata_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_atas_processadas int := 0;
  v_itens_recalc int := 0;
  v_contratos_pais_recalc int := 0;
  v_atas uuid[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501';
  END IF;

  -- Seleciona ATAs alvo (uma específica ou todas do usuário)
  IF p_ata_id IS NOT NULL THEN
    SELECT array_agg(id) INTO v_atas
    FROM public.contratos
    WHERE id = p_ata_id AND tipo_documento = 'ata_srp' AND user_id = v_user;
  ELSE
    SELECT array_agg(id) INTO v_atas
    FROM public.contratos
    WHERE tipo_documento = 'ata_srp' AND user_id = v_user;
  END IF;

  IF v_atas IS NULL OR array_length(v_atas,1) IS NULL THEN
    RETURN jsonb_build_object('atas_processadas',0,'itens_recalculados',0,'contratos_pais_recalculados',0);
  END IF;

  -- Dispara recalc_saldo_ata_item via UPDATE no-op nos itens vinculados dos contratos derivados
  WITH itens_alvo AS (
    SELECT ci.id
    FROM public.contrato_itens ci
    JOIN public.contratos c ON c.id = ci.contrato_id
    WHERE c.ata_srp_id = ANY(v_atas)
      AND c.tipo_documento = 'contrato'
      AND ci.ata_item_id IS NOT NULL
  ), upd AS (
    UPDATE public.contrato_itens ci
    SET updated_at = now()
    FROM itens_alvo ia
    WHERE ci.id = ia.id
    RETURNING 1
  )
  SELECT count(*) INTO v_itens_recalc FROM upd;

  -- Dispara recalc_consumo_ata_pai via UPDATE no-op nos contratos derivados
  WITH upd_pais AS (
    UPDATE public.contratos
    SET updated_at = now()
    WHERE ata_srp_id = ANY(v_atas) AND tipo_documento = 'contrato'
    RETURNING 1
  )
  SELECT count(*) INTO v_contratos_pais_recalc FROM upd_pais;

  v_atas_processadas := array_length(v_atas, 1);

  RETURN jsonb_build_object(
    'atas_processadas', v_atas_processadas,
    'itens_recalculados', v_itens_recalc,
    'contratos_pais_recalculados', v_contratos_pais_recalc,
    'executado_em', now()
  );
END;
$$;

-- 2) RPC: Relatório de órfãos — contratos sem ata_srp_id e itens sem ata_item_id
CREATE OR REPLACE FUNCTION public.relatorio_orfaos_ata_srp(
  p_ata_id uuid DEFAULT NULL,
  p_limite int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_contratos_orfaos jsonb;
  v_itens_orfaos jsonb;
  v_total_contratos int;
  v_total_itens int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501';
  END IF;

  -- Contratos órfãos: sem ata_srp_id, com heurística de ATA provável (mesmo orgao + período compatível)
  WITH base AS (
    SELECT c.id, c.numero_contrato, c.objeto, c.orgao_contratante, c.data_assinatura,
           c.valor_global, c.empresa_id
    FROM public.contratos c
    WHERE c.user_id = v_user
      AND c.tipo_documento = 'contrato'
      AND c.ata_srp_id IS NULL
      AND (p_ata_id IS NULL OR EXISTS (
        SELECT 1 FROM public.contratos a
        WHERE a.id = p_ata_id AND a.tipo_documento = 'ata_srp'
          AND a.user_id = v_user
          AND lower(coalesce(a.orgao_contratante,'')) = lower(coalesce(c.orgao_contratante,''))
      ))
  ), com_sugestao AS (
    SELECT b.*,
      (SELECT jsonb_build_object(
          'ata_id', a.id,
          'numero_ata', a.numero_ata,
          'objeto', a.objeto,
          'orgao', a.orgao_contratante,
          'similaridade_objeto', extensions.similarity(lower(coalesce(a.objeto,'')), lower(coalesce(b.objeto,'')))::real
        )
        FROM public.contratos a
        WHERE a.user_id = v_user
          AND a.tipo_documento = 'ata_srp'
          AND lower(coalesce(a.orgao_contratante,'')) = lower(coalesce(b.orgao_contratante,''))
          AND (b.data_assinatura IS NULL OR a.data_assinatura IS NULL OR b.data_assinatura >= a.data_assinatura)
        ORDER BY extensions.similarity(lower(coalesce(a.objeto,'')), lower(coalesce(b.objeto,''))) DESC NULLS LAST
        LIMIT 1
      ) AS sugestao
    FROM base b
  )
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'numero_contrato', s.numero_contrato,
    'objeto', s.objeto,
    'orgao', s.orgao_contratante,
    'data_assinatura', s.data_assinatura,
    'valor_global', s.valor_global,
    'sugestao_ata', s.sugestao
  ) ORDER BY s.data_assinatura DESC NULLS LAST), '[]'::jsonb)
  INTO v_total_contratos, v_contratos_orfaos
  FROM (SELECT * FROM com_sugestao LIMIT p_limite) s;

  -- Itens órfãos: contratos JÁ vinculados a uma ATA, mas itens sem ata_item_id
  WITH base AS (
    SELECT ci.id, ci.descricao, ci.unidade, ci.codigo_item,
           ci.quantidade_contratada, ci.valor_unitario, ci.valor_total,
           ct.id as contrato_id, ct.numero_contrato, ct.ata_srp_id
    FROM public.contrato_itens ci
    JOIN public.contratos ct ON ct.id = ci.contrato_id
    WHERE ct.user_id = v_user
      AND ct.tipo_documento = 'contrato'
      AND ct.ata_srp_id IS NOT NULL
      AND ci.ata_item_id IS NULL
      AND (p_ata_id IS NULL OR ct.ata_srp_id = p_ata_id)
  )
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'contrato_id', b.contrato_id,
    'numero_contrato', b.numero_contrato,
    'ata_srp_id', b.ata_srp_id,
    'descricao', b.descricao,
    'unidade', b.unidade,
    'codigo_item', b.codigo_item,
    'quantidade', b.quantidade_contratada,
    'valor_unitario', b.valor_unitario,
    'valor_total', b.valor_total
  )), '[]'::jsonb)
  INTO v_total_itens, v_itens_orfaos
  FROM (SELECT * FROM base LIMIT p_limite) b;

  RETURN jsonb_build_object(
    'contratos_orfaos', v_contratos_orfaos,
    'total_contratos_orfaos', v_total_contratos,
    'itens_orfaos', v_itens_orfaos,
    'total_itens_orfaos', v_total_itens,
    'limite', p_limite
  );
END;
$$;

-- 3) RPC: Aplicar vínculo aprovado pelo usuário (usado pela tela de revisão assistida)
-- Vincula um contrato órfão a uma ATA OU um item de contrato a um item da ATA.
CREATE OR REPLACE FUNCTION public.aplicar_vinculo_ata(
  p_contrato_id uuid DEFAULT NULL,
  p_ata_id uuid DEFAULT NULL,
  p_contrato_item_id uuid DEFAULT NULL,
  p_ata_item_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_acoes text[] := ARRAY[]::text[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501';
  END IF;

  -- Vínculo de contrato → ATA
  IF p_contrato_id IS NOT NULL AND p_ata_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.contratos WHERE id = p_contrato_id;
    IF v_owner <> v_user THEN
      RAISE EXCEPTION 'Acesso negado ao contrato' USING ERRCODE='42501';
    END IF;
    SELECT user_id INTO v_owner FROM public.contratos WHERE id = p_ata_id AND tipo_documento='ata_srp';
    IF v_owner <> v_user THEN
      RAISE EXCEPTION 'ATA inválida ou acesso negado' USING ERRCODE='42501';
    END IF;
    UPDATE public.contratos SET ata_srp_id = p_ata_id, updated_at = now()
    WHERE id = p_contrato_id;
    -- Auditoria
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    VALUES (p_contrato_id, 'ata_srp_id', 'NULL', p_ata_id::text, 'vinculo_manual_orfao', v_user, 'Revisão assistida');
    v_acoes := array_append(v_acoes, 'contrato_vinculado_ata');
  END IF;

  -- Vínculo de item de contrato → item da ATA
  IF p_contrato_item_id IS NOT NULL AND p_ata_item_id IS NOT NULL THEN
    SELECT c.user_id INTO v_owner
    FROM public.contrato_itens ci
    JOIN public.contratos c ON c.id = ci.contrato_id
    WHERE ci.id = p_contrato_item_id;
    IF v_owner <> v_user THEN
      RAISE EXCEPTION 'Acesso negado ao item' USING ERRCODE='42501';
    END IF;
    UPDATE public.contrato_itens SET ata_item_id = p_ata_item_id, updated_at = now()
    WHERE id = p_contrato_item_id;
    INSERT INTO public.contrato_ia_auditoria (contrato_id, campo, valor_anterior, valor_novo, origem, user_id, arquivo_nome)
    SELECT ci.contrato_id, 'ata_item_id', 'NULL', p_ata_item_id::text, 'vinculo_manual_item_orfao', v_user, 'Revisão assistida'
    FROM public.contrato_itens ci WHERE ci.id = p_contrato_item_id;
    v_acoes := array_append(v_acoes, 'item_vinculado_ata_item');
  END IF;

  IF array_length(v_acoes,1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum vínculo informado' USING ERRCODE='22023';
  END IF;

  RETURN jsonb_build_object('ok', true, 'acoes', v_acoes);
END;
$$;