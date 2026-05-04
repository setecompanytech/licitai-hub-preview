-- 1. Colunas de vínculo direto em financeiro_lancamentos
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS contrato_pedido_id uuid
    REFERENCES public.contrato_pedidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contrato_item_id uuid
    REFERENCES public.contrato_itens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fl_contrato_pedido
  ON public.financeiro_lancamentos(contrato_pedido_id)
  WHERE contrato_pedido_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fl_contrato
  ON public.financeiro_lancamentos(contrato_id)
  WHERE contrato_id IS NOT NULL;

-- 2. Função helper: cria pedido + lançamento atomicamente
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
  p_tipo public.financeiro_tipo_lancamento,
  p_natureza public.financeiro_natureza,
  p_status public.financeiro_status_lancamento,
  p_data_competencia date,
  p_data_vencimento date,
  p_data_emissao date,
  p_tipo_documento public.financeiro_tipo_documento,
  p_numero_documento text,
  p_chave_acesso_nfe text,
  p_pessoa_id uuid,
  p_observacoes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_contrato_owner uuid;
  v_pedido_id uuid;
  v_lancamento_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT empresa_id, user_id
  INTO v_empresa_id, v_contrato_owner
  FROM public.contratos
  WHERE id = p_contrato_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  IF v_contrato_owner <> v_user_id THEN
    RAISE EXCEPTION 'Sem permissão para vincular ao contrato';
  END IF;

  -- 1. Cria o pedido (dispara triggers de saldo e ATA)
  INSERT INTO public.contrato_pedidos (
    contrato_id, contrato_item_id, user_id, numero_pedido, descricao,
    quantidade, valor_unitario, valor_total,
    data_pedido, status, nota_fiscal, observacoes, origem_aditivo_id
  ) VALUES (
    p_contrato_id, p_contrato_item_id, v_user_id,
    COALESCE(p_numero_pedido, 'AUTO-' || to_char(now(),'YYYYMMDDHH24MISS')),
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
    'contrato_id', p_contrato_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza,
  public.financeiro_status_lancamento, date, date, date,
  public.financeiro_tipo_documento, text, text, uuid, text
) TO authenticated;