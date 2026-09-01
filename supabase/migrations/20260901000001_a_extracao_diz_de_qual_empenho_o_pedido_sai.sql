-- ═══════════════════════════════════════════════════════════════════════════
-- A Extração passa a dizer de qual empenho o pedido sai
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O modelo firmado em 30/08 é "o empenho AUTORIZA; o pedido CONSOME": todo
-- pedido aponta `empenho_id` (e cota), e é por esse vínculo que o saldo do
-- empenho baixa e a checagem do art. 60 acontece.
--
-- O diálogo da Gestão já grava os dois. Mas `vincular_lancamento_a_pedido` —
-- o caminho da EXTRAÇÃO de documentos — é de maio, anterior ao modelo: o
-- pedido nascia sem empenho, o 2025NE000064 nunca baixava por esse fluxo, e o
-- dono do produto viu exatamente isso ao subir um DANFE em 01/09.
--
-- Aproveitando a reescrita, sai também o `v_contrato_owner <> v_user_id` que
-- barrava colega: contrato é da EMPRESA (princípio 2 do CLAUDE.md — o mesmo
-- defeito corrigido no seletor desta mesma tela em 01/09). Quem é membro da
-- empresa do contrato vincula; o owner segue valendo para legado sem empresa.

-- A lista de parâmetros muda; CREATE OR REPLACE não altera assinatura.
DROP FUNCTION IF EXISTS public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  financeiro_tipo_lancamento, financeiro_natureza, financeiro_status_lancamento,
  date, date, date, financeiro_tipo_documento, text, text, uuid, text
);

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
  p_observacoes text,
  -- Novos, com DEFAULT: chamada antiga continua válida. Nulo é permitido de
  -- propósito — contrato sem controle de empenho não pode ser barrado por ele.
  p_empenho_id uuid DEFAULT NULL,
  p_cota text DEFAULT NULL
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

  SELECT empresa_id, user_id, true
  INTO v_empresa_id, v_contrato_owner, v_contrato_existe
  FROM public.contratos
  WHERE id = p_contrato_id;

  IF NOT COALESCE(v_contrato_existe, false) THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  -- Contrato é da empresa: membro vincula. O owner permanece como critério
  -- apenas para o legado sem empresa_id, onde não há empresa a consultar.
  IF NOT (
    v_contrato_owner = v_user_id
    OR (v_empresa_id IS NOT NULL AND public.is_empresa_member(v_user_id, v_empresa_id))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para vincular ao contrato';
  END IF;

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

  -- O empenho, quando apontado, tem de ser DESTE contrato — empenho de outro
  -- contrato baixaria saldo alheio em silêncio.
  IF p_empenho_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contrato_empenhos e
     WHERE e.id = p_empenho_id AND e.contrato_id = p_contrato_id
  ) THEN
    RAISE EXCEPTION 'O empenho informado não pertence a este contrato';
  END IF;

  INSERT INTO public.contrato_pedidos (
    contrato_id, contrato_item_id, user_id, numero_pedido, descricao,
    quantidade, valor_unitario, valor_total,
    data_pedido, status, nota_fiscal, observacoes, origem_aditivo_id,
    empenho_id, cota
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
    p_origem_aditivo_id,
    p_empenho_id,
    p_cota
  ) RETURNING id INTO v_pedido_id;

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

COMMENT ON FUNCTION public.vincular_lancamento_a_pedido IS
  'Cria pedido + lançamento a partir de um documento (Extração/vínculo). '
  'Desde 01/09/2026 aceita p_empenho_id e p_cota: o pedido nasce apontando de '
  'qual empenho sai, e o saldo do empenho baixa também por este caminho. '
  'Permissão por empresa (membro), com owner como critério só para legado sem '
  'empresa_id.';
