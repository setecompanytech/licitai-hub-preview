-- ═══════════════════════════════════════════════════════════════════════════
-- Casar o recebimento antes de criar o título (21/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O extrato importado e conciliado antes da DANFE virava dois títulos por
-- nota: o recebimento (do banco) e o título previsto (do anexo no Gestão de
-- Contratos). Regra do dono, 21/09: a identidade é o NÚMERO da nota e do
-- pedido; valor igual não prova duplicidade (o cliente fatura o mesmo valor
-- em pedidos distintos, cada um com a sua nota). A tela procura o
-- recebimento pelo número/chave (lib/financeiro/recebimento-da-nota.ts) e,
-- achando um só com o mesmo valor, chama esta função com o recebimento em
-- vez de deixá-la criar outro título.

-- ── 1. vincular_lancamento_a_pedido: casa antes de criar ─────────────────────
-- Assinatura nova (dois parâmetros no fim, com padrão): a antiga sai para não
-- restarem duas funções com o mesmo nome. Quem chama sem os novos parâmetros
-- continua funcionando igual.
DROP FUNCTION IF EXISTS public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.vincular_lancamento_a_pedido(
  p_contrato_id uuid, p_contrato_item_id uuid, p_origem_aditivo_id uuid, p_numero_pedido text, p_descricao text,
  p_quantidade numeric, p_valor_unitario numeric, p_valor_total numeric, p_data_pedido date,
  p_tipo public.financeiro_tipo_lancamento, p_natureza public.financeiro_natureza, p_status public.financeiro_status_lancamento,
  p_data_competencia date, p_data_vencimento date, p_data_emissao date, p_tipo_documento public.financeiro_tipo_documento,
  p_numero_documento text, p_chave_acesso_nfe text, p_pessoa_id uuid, p_observacoes text,
  p_empenho_id uuid DEFAULT NULL::uuid, p_cota text DEFAULT NULL::text,
  -- Novos (21/09): o recebimento que JÁ existe, para casar em vez de criar; e
  -- a opção de criar o pedido sem título (caso ambíguo, decidido depois).
  p_lancamento_existente uuid DEFAULT NULL::uuid,
  p_criar_titulo boolean DEFAULT true)
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
  END IF;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'lancamento_id', v_lancamento_id,
    'casado', p_lancamento_existente IS NOT NULL,
    'contrato_id', p_contrato_id,
    'empresa_id', v_empresa_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_lancamento_a_pedido(
  uuid, uuid, uuid, text, text, numeric, numeric, numeric, date,
  public.financeiro_tipo_lancamento, public.financeiro_natureza, public.financeiro_status_lancamento,
  date, date, date, public.financeiro_tipo_documento, text, text, uuid, text, uuid, text, uuid, boolean) TO authenticated;

-- ── 2. Central de conferência: duas verificações novas (15 e 16) ─────────────
-- Corpo VIVO copiado do banco em 21/09 (pg_get_functiondef) + os dois blocos
-- no fim. Repo × banco já divergiram três vezes; por isso a cópia é do banco.
CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
 RETURNS TABLE(severidade text, categoria text, descricao text, valor numeric, referencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || public.fmt_brl(c.saldo_atual)
           || ', derivado ' || public.fmt_brl(d.derivado) || '.',
         c.saldo_atual - d.derivado,
         c.id::text
    FROM public.financeiro_contas c
    CROSS JOIN LATERAL (SELECT public.financeiro_saldo_derivado(c.id) AS derivado) d
   WHERE c.empresa_id = p_empresa_id
     AND abs(c.saldo_atual - d.derivado) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  SELECT (CASE WHEN c.nome ILIKE '%aplica%' OR c.nome ILIKE '%caix%' THEN 'critico' ELSE 'atencao' END)::text,
         'saldo negativo'::text,
         'A conta "' || c.nome || '" está com saldo negativo. '
           || CASE WHEN COALESCE(c.saldo_inicial,0) = 0
                   THEN 'O saldo de abertura está zerado — confira se ele foi informado.'
                   ELSE 'Confira se há lançamento com origem ou sentido trocado.' END,
         c.saldo_atual,
         c.id::text
    FROM public.financeiro_contas c
   WHERE c.empresa_id = p_empresa_id
     AND c.ativa
     AND c.saldo_atual < 0

  UNION ALL

  -- ── 3. Transferência de conta que não tinha o dinheiro ────────────────────
  SELECT 'atencao'::text,
         'transferência acima do saldo'::text,
         'A conta "' || c.nome || '" registra saídas por transferência muito acima '
           || 'do que recebeu. Confira a conta de origem desses lançamentos.',
         t.saiu - t.entrou,
         c.id::text
    FROM public.financeiro_contas c
    JOIN LATERAL (
      SELECT COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'despesa'), 0) AS saiu,
             COALESCE(SUM(l.valor) FILTER (WHERE l.natureza = 'receita'), 0) AS entrou
        FROM public.financeiro_lancamentos l
       WHERE l.conta_id = c.id AND l.tipo = 'transferencia'
    ) t ON true
   WHERE c.empresa_id = p_empresa_id
     AND t.saiu - t.entrou > COALESCE(c.saldo_inicial, 0) + 1000

  UNION ALL

  -- ── 4. Perna de transferência sem par ─────────────────────────────────────
  SELECT 'critico'::text,
         'transferência sem par'::text,
         'Lote de transferência com ' || cnt || ' perna(s) em vez de 2. '
           || 'O dinheiro sai de uma conta e não entra em nenhuma.',
         valor_lote,
         lote::text
    FROM (
      SELECT l.origem_lote_id AS lote, count(*) AS cnt, max(l.valor) AS valor_lote
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'transferencia'
         AND l.natureza IN ('despesa','receita')
         AND l.origem_lote_id IS NOT NULL
       GROUP BY l.origem_lote_id
      HAVING count(*) <> 2
    ) pares

  UNION ALL

  -- ── 5. Faturamento declarado × faturado com documento fiscal ──────────────
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere das receitas com documento '
           || 'fiscal. Declarado ' || public.fmt_brl(d.declarado)
           || ', faturado (NF-e/NFS-e) ' || public.fmt_brl(d.faturado) || '.',
         d.declarado - d.faturado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
          WHERE l.empresa_id = p_empresa_id
            AND l.natureza = 'receita'
            AND l.tipo_documento IN ('nfe','nfse','nfce')
            AND l.status IN ('realizado','conciliado')) AS faturado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.faturado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  SELECT 'critico'::text,
         'regime não definido'::text,
         'A empresa não tem regime tributário no cadastro. A apuração não pode '
           || 'ser feita, e qualquer padrão adotado seria decidir no lugar de alguém.',
         NULL::numeric,
         e.id::text
    FROM public.empresas e
   WHERE e.id = p_empresa_id
     AND e.regime_tributario IS NULL

  UNION ALL

  -- ── 7. Lançamento com data implausível ────────────────────────────────────
  SELECT 'atencao'::text,
         'data implausível'::text,
         count(*) || ' lançamento(s) com vencimento a mais de 15 anos da competência. '
           || 'Provável ano digitado errado.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.data_vencimento IS NOT NULL
     AND l.data_competencia IS NOT NULL
     AND l.data_vencimento > l.data_competencia + interval '15 years'
  HAVING count(*) > 0

  UNION ALL

  -- ── 8. Lançamento sem categoria ───────────────────────────────────────────
  SELECT (CASE WHEN SUM(l.valor) > 50000 THEN 'atencao' ELSE 'informativo' END)::text,
         'sem classificação'::text,
         count(*) || ' lançamento(s) realizado(s) sem categoria. '
           || 'Eles ficam fora do DRE e dos indicadores gerenciais.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.categoria_id IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  SELECT 'critico'::text,
         'gatilho do saldo inativo'::text,
         'O gatilho trg_saldo_lancamento não está ativo em financeiro_lancamentos. '
           || 'Sem ele, o saldo das contas para de acompanhar os lançamentos: '
           || 'continua exibido, com a mesma aparência, apenas parado no tempo. '
           || 'Reinstale antes de confiar em qualquer saldo desta tela.',
         NULL::numeric,
         NULL::text
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_trigger t
       JOIN pg_class cl     ON cl.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public'
        AND cl.relname = 'financeiro_lancamentos'
        AND t.tgname   = 'trg_saldo_lancamento'
        AND NOT t.tgisinternal
        AND t.tgenabled = 'O'
   )

  UNION ALL

  -- ── 10. Nota fiscal lançada sem o documento guardado ──────────────────────
  SELECT 'atencao'::text,
         'nota sem documento'::text,
         count(*) || ' lançamento(s) de NF-e/NFS-e sem o arquivo guardado. '
           || 'Os campos foram registrados, o documento não — e é ele que vale '
           || 'como prova e cumpre o prazo de guarda.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo_documento IN ('nfe','nfse','nfce')
     AND l.created_at >= DATE '2026-08-25'
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_documentos_fiscais d
        WHERE d.lancamento_id = l.id
          AND (d.storage_path IS NOT NULL OR d.arquivo_xml IS NOT NULL)
     )
  HAVING count(*) > 0

  UNION ALL

  -- ── 11. Título que na verdade é transferência entre contas próprias ───────
  SELECT 'atencao'::text,
         'título que é transferência'::text,
         count(*) || ' título(s) a receber/pagar cuja descrição é de movimentação '
           || 'entre contas próprias (resgate, aplicação, transferência). '
           || 'Não são receita nem despesa — são o mesmo dinheiro mudando de conta.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo IN ('a_receber','a_pagar')
     AND l.status <> 'cancelado'
     AND (
          lower(public.unaccent_imutavel(l.descricao)) LIKE '%resgate%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%aplicacao%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transferencia entre%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%transf propria%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%entre contas%'
       OR lower(public.unaccent_imutavel(l.descricao)) LIKE '%mesma titularidade%'
     )
  HAVING count(*) > 0


  UNION ALL

  -- ── 12. Categoria que existe mas não tem grupo de DRE ─────────────────────
  SELECT (CASE WHEN SUM(l.valor) > 20000 THEN 'atencao' ELSE 'informativo' END)::text,
         'categoria fora do DRE'::text,
         count(DISTINCT c.id) || ' categoria(s) com lançamento e sem grupo de DRE. '
           || 'Os lançamentos aparecem classificados na tela, mas ficam fora do '
           || 'resultado. Financeiro → Categorias, coluna Grupo DRE.',
         SUM(l.valor),
         string_agg(DISTINCT c.nome, ', ' ORDER BY c.nome)
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_categorias c ON c.id = l.categoria_id
   WHERE l.empresa_id = p_empresa_id
     AND c.grupo_dre IS NULL
     AND l.status IN ('realizado','conciliado')
     AND l.tipo IN ('a_receber','a_pagar')
  HAVING count(*) > 0

  UNION ALL

  -- ── 13. Duas categorias com o mesmo nome ──────────────────────────────────
  SELECT 'informativo'::text,
         'categoria repetida'::text,
         count(*) || ' nome(s) de categoria cadastrado(s) mais de uma vez, '
           || 'variando só maiúsculas ou espaços. O DRE mostra uma linha para cada.',
         NULL::numeric,
         string_agg(nome_exemplo, ', ' ORDER BY nome_exemplo)
    FROM (
      SELECT min(c.nome) AS nome_exemplo
        FROM public.financeiro_categorias c
       WHERE c.empresa_id = p_empresa_id
       GROUP BY lower(btrim(c.nome))
      HAVING count(*) > 1
    ) AS repetidas
  HAVING count(*) > 0

  UNION ALL

  -- ── 14. Transferência de linha única sem conta de destino ─────────────────
  -- A régua debita a origem e não credita ninguém: é o único formato de
  -- lançamento capaz de sumir com dinheiro do consolidado em silêncio.
  SELECT 'critico'::text,
         'transferência sem destino'::text,
         count(*) || ' transferência(s) de linha única sem conta de destino. '
           || 'O dinheiro sai da origem e não entra em nenhuma conta — '
           || 'informe o destino ou converta em lançamento comum.',
         SUM(l.valor),
         NULL::text
    FROM public.financeiro_lancamentos l
   WHERE l.empresa_id = p_empresa_id
     AND l.tipo = 'transferencia'
     AND l.natureza NOT IN ('despesa','receita')
     AND l.conta_destino_id IS NULL
     AND l.status <> 'cancelado'
  HAVING count(*) > 0

  UNION ALL

  -- ── 15. Título a receber de nota que já foi recebida ──────────────────────
  -- O extrato entrou antes da DANFE (21/09): o recebimento conciliado cita o
  -- número da nota e o título aberto repete a mesma nota com o mesmo valor.
  -- Identidade pelo NÚMERO da nota, nunca só pelo valor (regra do dono).
  SELECT 'atencao'::text,
         'título de nota já recebida'::text,
         count(*) || ' título(s) a receber em aberto cuja nota já consta em recebimento '
           || 'realizado/conciliado da empresa, com o mesmo valor. Case o recebimento ao pedido '
           || 'e apague o título duplicado (Pedidos → casar).',
         SUM(t.valor),
         string_agg(t.numero_documento, ', ' ORDER BY t.numero_documento)
    FROM public.financeiro_lancamentos t
   WHERE t.empresa_id = p_empresa_id
     AND t.tipo = 'a_receber'
     AND t.status IN ('previsto','em_atraso')
     AND t.numero_documento IS NOT NULL
     AND ltrim(regexp_replace(t.numero_documento, '\D', '', 'g'), '0') <> ''
     AND EXISTS (
       SELECT 1 FROM public.financeiro_lancamentos r
        WHERE r.empresa_id = t.empresa_id
          AND r.id <> t.id
          AND r.tipo = 'a_receber'
          AND r.status IN ('realizado','conciliado')
          AND r.contrato_pedido_id IS NULL
          AND abs(r.valor - t.valor) < 0.005
          AND (COALESCE(r.numero_documento,'') || ' ' || COALESCE(r.descricao,''))
              ~ ('(^|[^0-9])0*' || ltrim(regexp_replace(t.numero_documento, '\D', '', 'g'), '0') || '([^0-9]|$)')
     )
  HAVING count(*) > 0

  UNION ALL

  -- ── 16. Títulos a receber repetidos sem pedido ────────────────────────────
  -- O mesmo empenho registrado 8 vezes (Santa Rosa, 30/08) gerou 16 títulos
  -- iguais, sem pedido. Empenho não é recebível; a repetição menos ainda.
  SELECT 'atencao'::text,
         'títulos repetidos sem pedido'::text,
         count(*) || ' grupo(s) de títulos a receber em aberto repetidos (mesma descrição, valor e '
           || 'competência) sem pedido ligado — ' || sum(n - 1) || ' título(s) a mais, '
           || public.fmt_brl(sum((n - 1) * valor)) || '. Confira se são o mesmo documento.',
         sum((n - 1) * valor),
         string_agg(left(descricao, 40), ' · ' ORDER BY valor DESC)
    FROM (
      SELECT l.descricao, l.valor, l.data_competencia, count(*) AS n
        FROM public.financeiro_lancamentos l
       WHERE l.empresa_id = p_empresa_id
         AND l.tipo = 'a_receber'
         AND l.status IN ('previsto','em_atraso')
         AND l.contrato_pedido_id IS NULL
       GROUP BY l.descricao, l.valor, l.data_competencia
      HAVING count(*) > 1
    ) AS g
  HAVING count(*) > 0
$function$;
