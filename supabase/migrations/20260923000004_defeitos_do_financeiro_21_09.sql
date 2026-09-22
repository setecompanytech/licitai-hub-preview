-- ═══════════════════════════════════════════════════════════════════════════
-- Defeitos de código da auditoria contábil de 21/09/2026 — o que é de banco
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dos sete defeitos da seção 5 do relatório, dois tocam o banco:
--   1. a RPC `vincular_lancamento_a_pedido` gravava título com vencimento e
--      conta nulos (NF-e sem duplicata, pela Extração de Documentos);
--   5. a âncora do saldo do extrato (`saldo_final_em`) passa a ter UMA
--      semântica — o saldo no FIM do dia gravado — e `saldo_apos` passa a
--      ser preenchido pela edge `import-ofx` (seção 2: só comentários das
--      colunas e conferência; a mudança é na edge).
-- O resto (régua de caixa, atraso derivado, paginação, DRE, par de
-- transferência) é código do front, sem mudança de schema.

-- ── 1. vincular_lancamento_a_pedido: todo título nasce com vencimento ──────
--
-- A NF 736 da ETHOS (R$ 2.145.439,42) entrou pela Extração sem duplicata e
-- ficou com `data_vencimento` nula: fora do fluxo de caixa (a view agrupa por
-- vencimento), fora do "Em atraso", e "Vencida" no Kanban pela competência.
-- A escada é a mesma de `src/lib/financeiro/vencimento-do-titulo.ts`, que o
-- front aplica antes de chamar — aqui ela vale para QUALQUER chamador:
--   informado > emissão + prazo do cadastro da pessoa > emissão > competência > hoje.
-- O que foi assumido é dito nas observações do título: vencimento inventado
-- em silêncio é pior do que nenhum, porque ninguém o corrige.
--
-- A conta: a informada (`p_conta_id`, parâmetro novo, com padrão) ou, quando
-- a empresa tem UMA conta ativa, essa — conhecida por exclusão. Com várias,
-- fica nula: escolher uma seria decidir no lugar de alguém.
--
-- Assinatura nova (um parâmetro a mais, com padrão): a de 21/09 sai para não
-- restarem duas funções com o mesmo nome. Quem chama por nome continua igual.
DROP FUNCTION IF EXISTS public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean);

CREATE OR REPLACE FUNCTION public.vincular_lancamento_a_pedido(
  p_contrato_id uuid, p_contrato_item_id uuid, p_origem_aditivo_id uuid, p_numero_pedido text, p_descricao text,
  p_quantidade numeric, p_valor_unitario numeric, p_valor_total numeric, p_data_pedido date,
  p_tipo public.financeiro_tipo_lancamento, p_natureza public.financeiro_natureza, p_status public.financeiro_status_lancamento,
  p_data_competencia date, p_data_vencimento date, p_data_emissao date, p_tipo_documento public.financeiro_tipo_documento,
  p_numero_documento text, p_chave_acesso_nfe text, p_pessoa_id uuid, p_observacoes text,
  p_empenho_id uuid DEFAULT NULL::uuid, p_cota text DEFAULT NULL::text,
  p_lancamento_existente uuid DEFAULT NULL::uuid,
  p_criar_titulo boolean DEFAULT true,
  -- Novo (23/09): a conta do título, quando quem chama a conhece.
  p_conta_id uuid DEFAULT NULL::uuid)
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
  v_existente public.financeiro_lancamentos%ROWTYPE;
  v_prazo_dias integer;
  v_vencimento date;
  v_conta_id uuid;
  v_observacoes text := p_observacoes;
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
  -- apenas para o legado sem empresa_id.
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

  -- O recebimento que já existe tem de ser DA empresa, do mesmo tipo, já
  -- baixado e livre de pedido — senão casar seria roubar o título de outro.
  IF p_lancamento_existente IS NOT NULL THEN
    SELECT * INTO v_existente FROM public.financeiro_lancamentos WHERE id = p_lancamento_existente;
    IF v_existente.id IS NULL OR v_existente.empresa_id <> v_empresa_id THEN
      RAISE EXCEPTION 'O lançamento existente não é desta empresa';
    END IF;
    IF v_existente.tipo <> p_tipo OR v_existente.status NOT IN ('realizado','conciliado') THEN
      RAISE EXCEPTION 'O lançamento existente precisa ser um % já baixado (está como %)', p_tipo, v_existente.status;
    END IF;
    IF v_existente.contrato_pedido_id IS NOT NULL THEN
      RAISE EXCEPTION 'O lançamento existente já está ligado a outro pedido';
    END IF;
  END IF;

  -- ── Vencimento: nunca nulo (defeito 1 da auditoria de 21/09) ──────────────
  v_vencimento := p_data_vencimento;
  IF v_vencimento IS NULL AND p_pessoa_id IS NOT NULL AND p_data_emissao IS NOT NULL THEN
    SELECT p.prazo_padrao_dias INTO v_prazo_dias
      FROM public.financeiro_pessoas p
     WHERE p.id = p_pessoa_id AND p.empresa_id = v_empresa_id;
    IF v_prazo_dias IS NOT NULL AND v_prazo_dias >= 0 THEN
      v_vencimento := p_data_emissao + v_prazo_dias;
      v_observacoes := concat_ws(E'\n', v_observacoes,
        format('Vencimento assumido: emissão + %s dia(s), prazo do cadastro da pessoa. Confira.', v_prazo_dias));
    END IF;
  END IF;
  IF v_vencimento IS NULL AND p_data_emissao IS NOT NULL THEN
    v_vencimento := p_data_emissao;
    v_observacoes := concat_ws(E'\n', v_observacoes,
      'Vencimento assumido pela data de emissão: o documento não trouxe prazo. Confira e corrija.');
  END IF;
  IF v_vencimento IS NULL AND p_data_competencia IS NOT NULL THEN
    v_vencimento := p_data_competencia;
    v_observacoes := concat_ws(E'\n', v_observacoes,
      'Vencimento assumido pela competência: o documento não trouxe prazo nem emissão. Confira e corrija.');
  END IF;
  IF v_vencimento IS NULL THEN
    v_vencimento := CURRENT_DATE;
    v_observacoes := concat_ws(E'\n', v_observacoes,
      'Vencimento assumido pela data do lançamento: o documento não trouxe datas. Confira e corrija.');
  END IF;

  -- ── Conta: a informada, ou a única ativa da empresa; senão, nula ──────────
  IF p_conta_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_contas c WHERE c.id = p_conta_id AND c.empresa_id = v_empresa_id) THEN
      RAISE EXCEPTION 'A conta informada não é desta empresa';
    END IF;
    v_conta_id := p_conta_id;
  ELSE
    SELECT (array_agg(c.id))[1] INTO v_conta_id
      FROM public.financeiro_contas c
     WHERE c.empresa_id = v_empresa_id AND c.ativa
    HAVING count(*) = 1;
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

  IF p_lancamento_existente IS NOT NULL THEN
    -- Casa: o recebimento ganha o pedido e os dados da nota que lhe faltavam.
    -- O gatilho de quitação marca o pedido como pago na data do recebimento.
    UPDATE public.financeiro_lancamentos
       SET contrato_pedido_id = v_pedido_id,
           contrato_id        = COALESCE(contrato_id, p_contrato_id),
           contrato_item_id   = COALESCE(contrato_item_id, p_contrato_item_id),
           numero_documento   = COALESCE(numero_documento, p_numero_documento),
           tipo_documento     = COALESCE(tipo_documento, p_tipo_documento),
           chave_acesso_nfe   = COALESCE(chave_acesso_nfe, p_chave_acesso_nfe),
           data_emissao       = COALESCE(data_emissao, p_data_emissao)
     WHERE id = p_lancamento_existente;
    v_lancamento_id := p_lancamento_existente;
  ELSIF p_criar_titulo THEN
    INSERT INTO public.financeiro_lancamentos (
      empresa_id, tipo, natureza, status, descricao, valor,
      data_competencia, data_vencimento, data_emissao,
      tipo_documento, numero_documento, chave_acesso_nfe,
      pessoa_id, conta_id, contrato_id, contrato_item_id, contrato_pedido_id,
      observacoes, origem, created_by
    ) VALUES (
      v_empresa_id, p_tipo, p_natureza, COALESCE(p_status, 'previsto'),
      p_descricao, COALESCE(p_valor_total, 0),
      COALESCE(p_data_competencia, CURRENT_DATE),
      v_vencimento, p_data_emissao,
      p_tipo_documento, p_numero_documento, p_chave_acesso_nfe,
      p_pessoa_id, v_conta_id, p_contrato_id, p_contrato_item_id, v_pedido_id,
      v_observacoes, 'manual', v_user_id
    ) RETURNING id INTO v_lancamento_id;
  END IF;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'lancamento_id', v_lancamento_id,
    'casado', p_lancamento_existente IS NOT NULL,
    'contrato_id', p_contrato_id,
    'empresa_id', v_empresa_id,
    'data_vencimento', v_vencimento,
    'conta_id', v_conta_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean, uuid) TO authenticated;

COMMENT ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean, uuid) IS
  'Cria o pedido do contrato e o título (ou casa com o recebimento existente). Desde 23/09 o '
  'título nunca nasce sem vencimento (informado > emissão + prazo da pessoa > emissão > '
  'competência > hoje, com nota do que foi assumido) e recebe a conta informada ou a única '
  'conta ativa da empresa. Escada espelhada em src/lib/financeiro/vencimento-do-titulo.ts.';

-- ── Conferência da seção 1 (só leitura) ─────────────────────────────────────
-- 1) A função nova está no ar, com 25 parâmetros (o último é p_conta_id):
--   SELECT pronargs, pg_get_function_identity_arguments(oid)
--     FROM pg_proc WHERE proname = 'vincular_lancamento_a_pedido';
--   -- esperado: UMA linha, pronargs = 25
-- 2) Títulos de pedido que ainda estão sem vencimento (dado legado — a
--    função não os corrige; quem decide é o dono, título a título):
--   SELECT l.id, l.descricao, l.valor, l.data_competencia, l.conta_id
--     FROM public.financeiro_lancamentos l
--    WHERE l.contrato_pedido_id IS NOT NULL AND l.data_vencimento IS NULL
--      AND l.status IN ('previsto','em_atraso')
--    ORDER BY l.valor DESC;

-- ── 2. A âncora do saldo do extrato tem UMA semântica ───────────────────────
--
-- A edge `import-ofx` gravava `saldo_final_em` como a data de geração do OFX
-- (o DTEND, quando faltava DTASOF — e até sem saldo nenhum), e nunca
-- preenchia `saldo_apos`. Os bancos não dizem a mesma coisa: o Banpará
-- declara o saldo ANTERIOR ao período com DTASOF = início; o Itaú declara na
-- data de geração. A regra agora vive em src/lib/financeiro/ancora-do-extrato.ts
-- (espelho Deno em _shared/ofx-ancora.ts): `saldo_final_em` é o dia no FIM do
-- qual `saldo_final` vale — para o Banpará, o dia anterior ao início —, e a
-- função `financeiro_confronto_com_extrato` (27/08) já lê exatamente assim
-- (`lancamentos_apos` conta o que veio depois desse dia). Sem LEDGERBAL, as
-- duas colunas ficam nulas e `saldo_apos` também: a tela diz que o arquivo
-- não trouxe o saldo. Aqui só os comentários mudam; nenhum dado é reescrito.
COMMENT ON COLUMN public.financeiro_extratos_importados.saldo_final_em IS
  'Dia no FIM do qual vale saldo_final (OFX: LEDGERBAL/DTASOF, normalizado pela '
  'edge import-ofx desde 23/09/2026). O Banpará declara o saldo ANTERIOR ao período '
  'com DTASOF = início: fica gravado o dia anterior. O Itaú declara na data de '
  'geração e fica como está. Nulo quando o arquivo não traz LEDGERBAL — nunca a data '
  'de geração no lugar do saldo.';

COMMENT ON COLUMN public.financeiro_extrato_movimentos.saldo_apos IS
  'Saldo da conta depois deste movimento, acumulado pela edge import-ofx a partir do '
  'saldo declarado do próprio arquivo (data, depois ordem do arquivo). Nulo quando o '
  'arquivo não traz LEDGERBAL. Extrato importado antes de 23/09/2026 não o tem.';

-- ── Conferência da seção 2 (só leitura) ─────────────────────────────────────
-- 1) Âncoras gravadas ANTES desta versão da edge com DTASOF no início do
--    período (o formato do Banpará): a data está um dia à frente do que a
--    semântica nova diz. Não são reescritas; reimportar o OFX corrige.
--   SELECT x.id, c.nome, x.arquivo_nome, x.data_inicio, x.data_fim, x.saldo_final, x.saldo_final_em
--     FROM public.financeiro_extratos_importados x
--     JOIN public.financeiro_contas c ON c.id = x.conta_id
--    WHERE x.saldo_final IS NOT NULL AND x.saldo_final_em = x.data_inicio
--    ORDER BY x.created_at DESC;
-- 2) Âncora sem saldo (a data de geração gravada sozinha, o defeito):
--   SELECT count(*) FROM public.financeiro_extratos_importados
--    WHERE saldo_final IS NULL AND saldo_final_em IS NOT NULL;
-- 3) Depois da primeira importação com a edge nova, o saldo após o último
--    movimento tem de bater com o saldo declarado (Itaú) ou com o declarado
--    mais os movimentos (Banpará):
--   SELECT m.data_movimento, m.valor, m.saldo_apos
--     FROM public.financeiro_extrato_movimentos m
--    WHERE m.extrato_id = '<id do extrato>'
--    ORDER BY m.data_movimento, m.created_at;
