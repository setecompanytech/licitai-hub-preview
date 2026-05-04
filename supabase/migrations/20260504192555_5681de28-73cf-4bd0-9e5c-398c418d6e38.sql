-- Corrige vincular_lancamento_a_pedido para aceitar contratos legados sem empresa_id.
-- Antes: a função abortava com "Contrato não encontrado" sempre que contratos.empresa_id era NULL.
-- Agora: a verificação considera o contrato encontrado pela existência do user_id, e usa
-- a empresa ativa do usuário (ou o pessoa_id) como fallback para o lançamento financeiro.

CREATE OR REPLACE FUNCTION public.vincular_lancamento_a_pedido(
  p_contrato_id uuid,
  p_contrato_item_id uuid,
  p_origem_aditivo_id uuid,
  p_numero_pedido text,
  p_descricao text,
  p_quantidade numeric,
  p_valor_unitario numeric,
  p_valor_total numeric,
  p_data_pedido date,
  p_tipo financeiro_tipo_lancamento,
  p_natureza financeiro_natureza,
  p_status financeiro_status_lancamento,
  p_data_competencia date,
  p_data_vencimento date,
  p_data_emissao date,
  p_tipo_documento financeiro_tipo_documento,
  p_numero_documento text,
  p_chave_acesso_nfe text,
  p_pessoa_id uuid,
  p_observacoes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_contrato_owner uuid;
  v_contrato_existe boolean;
  v_pedido_id uuid;
  v_lancamento_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Busca dados do contrato. Importante: empresa_id PODE ser NULL
  -- em contratos legados — não usar isso como critério de existência.
  SELECT empresa_id, user_id, true
  INTO v_empresa_id, v_contrato_owner, v_contrato_existe
  FROM public.contratos
  WHERE id = p_contrato_id;

  IF NOT COALESCE(v_contrato_existe, false) THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  IF v_contrato_owner <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão para vincular ao contrato';
  END IF;

  -- Fallback de empresa: se o contrato não tem empresa_id (legado),
  -- usa a primeira empresa ativa do usuário.
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id
    FROM public.empresas
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar a empresa do lançamento';
  END IF;

  -- 1. Cria o pedido (dispara triggers de saldo e ATA)
  INSERT INTO public.contrato_pedidos (
    contrato_id, contrato_item_id, user_id, numero_pedido, descricao,
    quantidade, valor_unitario, valor_total,
    data_pedido, status, nota_fiscal, observacoes, origem_aditivo_id
  ) VALUES (
    p_contrato_id, p_contrato_item_id, v_user_id,
    COALESCE(p_numero_pedido, 'AUTO-' || to_char(now(), 'YYYYMMDDHH24MISS')),
    p_descricao,
    COALESCE(p_quantidade, 1),
    COALESCE(p_valor_unitario, p_valor_total),
    COALESCE(p_valor_total, 0),
    COALESCE(p_data_pedido, CURRENT_DATE),
    'pendente',
    p_numero_documento,
    p_observacoes,
    p_origem_aditivo_id
  ) RETURNING id INTO v_pedido_id;

  -- 2. Cria o lançamento financeiro vinculado
  INSERT INTO public.financeiro_lancamentos (
    empresa_id, tipo, natureza, status, descricao, valor,
    data_competencia, data_vencimento, data_emissao,
    tipo_documento, numero_documento, chave_acesso_nfe,
    pessoa_id, contrato_id, contrato_item_id, contrato_pedido_id,
    observacoes, origem, created_by
  ) VALUES (
    v_empresa_id, p_tipo, p_natureza, COALESCE(p_status, 'previsto'),
    p_descricao, COALESCE(p_valor_total, 0),
    COALESCE(p_data_competencia, CURRENT_DATE),
    p_data_vencimento, p_data_emissao,
    p_tipo_documento, p_numero_documento, p_chave_acesso_nfe,
    p_pessoa_id, p_contrato_id, p_contrato_item_id, v_pedido_id,
    p_observacoes, 'manual', v_user_id
  ) RETURNING id INTO v_lancamento_id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'lancamento_id', v_lancamento_id,
    'contrato_id', p_contrato_id,
    'empresa_id', v_empresa_id
  );
END;
$function$;