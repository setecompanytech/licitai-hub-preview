-- ═══════════════════════════════════════════════════════════════════════════
-- Faturamento se confere com quem tem documento fiscal
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A verificação 5 comparava o declarado na Apuração com TODA receita lançada
-- em categoria de receita bruta. O dono explicou o desenho real (01/09): a
-- Apuração declara NF-e FATURADAS; os lançamentos somam tudo que entra na
-- conta — inclusive repasses públicos que chegam em mês diferente da nota.
-- Comparar os dois acusava diferença permanente por construção, não por erro.
--
-- O espelho honesto da Apuração: lançamentos de RECEITA com documento fiscal
-- (NF-e / NFS-e / NFC-e), realizados ou conciliados. Verificações 1–4 e 6–13
-- seguem exatamente como na 20260901000006.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,
  categoria   text,
  descricao   text,
  valor       numeric,
  referencia  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$

  -- ── 1. O saldo bate com os lançamentos? ───────────────────────────────────
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(d.derivado, 'FM999G999G999D00') || '.',
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
  -- A Apuração declara NF-e FATURADAS. O par honesto é a receita lançada COM
  -- documento fiscal — comparar com toda entrada de dinheiro acusava
  -- diferença permanente por desenho (repasse chega sem nota no mesmo mês).
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere das receitas com documento '
           || 'fiscal. Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', faturado (NF-e/NFS-e) ' || to_char(d.faturado, 'FM999G999G999D00') || '.',
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
$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha. O faturamento '
  'declarado se compara com receitas COM documento fiscal (NF-e/NFS-e) — a '
  'Apuração declara notas faturadas, não toda entrada de dinheiro. Não corrige '
  'nada — corrigir dinheiro é decisão de gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;
