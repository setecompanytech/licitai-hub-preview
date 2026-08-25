-- ═══════════════════════════════════════════════════════════════════════════
-- financeiro_conferencia() — o módulo passa a poder provar a própria correção
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nada no Financeiro comparava o que ele afirmava com o que ele mesmo tinha.
-- Nada conferia `saldo_atual` contra `saldo_inicial + movimentos`; nada
-- comparava faturamento declarado com contabilizado; nada notou que uma tabela
-- de configuração estava vazia desde abril. Cada achado da auditoria de 25/08
-- precisou de um humano indo procurar.
--
-- É essa ausência que faz um erro de digitação virar cascata. Sem prova local,
-- o erro não fica contido: vaza para tudo a jusante, porque a jusante não tem
-- como se defender. Um número derivável e conferido isola o estrago; um número
-- guardado e nunca conferido o espalha.
--
-- Esta função refaz as derivações e devolve o que não fecha. Não corrige nada
-- — corrigir dinheiro é decisão de gente. Ela só se recusa a ficar calada.

CREATE OR REPLACE FUNCTION public.financeiro_conferencia(p_empresa_id uuid)
RETURNS TABLE (
  severidade  text,   -- 'critico' | 'atencao' | 'informativo'
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
  -- A conferência que provou a correção de 25/08. Enquanto der zero, o saldo é
  -- derivável a qualquer momento; qualquer valor aqui é saldo fóssil voltando.
  WITH mov AS (
    SELECT c.id AS conta_id,
           COALESCE(SUM(
             CASE
               WHEN l.tipo = 'transferencia' AND l.natureza IN ('despesa','receita') THEN
                 CASE WHEN l.conta_id = c.id
                      THEN CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
                      ELSE 0 END
               WHEN l.tipo = 'transferencia' AND l.conta_id = c.id         THEN -l.valor
               WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN  l.valor
               WHEN l.conta_id IS DISTINCT FROM c.id THEN 0
               WHEN l.tipo = 'a_receber' AND l.status IN ('realizado','conciliado') THEN  l.valor
               WHEN l.tipo = 'a_pagar'   AND l.status IN ('realizado','conciliado') THEN -l.valor
               WHEN l.tipo = 'movimento_bancario' AND l.status IS DISTINCT FROM 'cancelado' THEN
                 CASE WHEN l.natureza = 'despesa' THEN -l.valor ELSE l.valor END
               ELSE 0
             END), 0) AS movimento
      FROM public.financeiro_contas c
      LEFT JOIN public.financeiro_lancamentos l
             ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
     WHERE c.empresa_id = p_empresa_id
     GROUP BY c.id
  )
  SELECT 'critico'::text,
         'saldo divergente'::text,
         'O saldo gravado de "' || c.nome || '" não corresponde aos lançamentos. '
           || 'Gravado ' || to_char(c.saldo_atual, 'FM999G999G999D00')
           || ', derivado ' || to_char(COALESCE(c.saldo_inicial,0) + m.movimento, 'FM999G999G999D00') || '.',
         c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento),
         c.id::text
    FROM public.financeiro_contas c
    JOIN mov m ON m.conta_id = c.id
   WHERE abs(c.saldo_atual - (COALESCE(c.saldo_inicial,0) + m.movimento)) > 0.005

  UNION ALL

  -- ── 2. Conta com saldo negativo ───────────────────────────────────────────
  -- Conta corrente pode ficar negativa (cheque especial). Aplicação e caixa,
  -- não: é sempre saldo de abertura faltando ou lançamento com sentido trocado.
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
  -- O erro de 25/08: oito PIX lançados como saída de uma conta que abriu o ano
  -- com R$ 39,75. A conferência olha o saldo de abertura contra o que saiu.
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
  -- O formato espelhado grava duas linhas por lote. Lote com uma perna só
  -- significa dinheiro saindo de uma conta e não entrando em nenhuma.
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

  -- ── 5. Faturamento declarado × contabilizado ──────────────────────────────
  -- Os dois números que não convergiam. A diferença não é erro por si: parte é
  -- nota a receber com prazo correndo. Vira aviso quando passa de 10%.
  SELECT 'atencao'::text,
         'faturamento não confere'::text,
         'O faturamento declarado em Apuração difere do que os lançamentos somam. '
           || 'Declarado ' || to_char(d.declarado, 'FM999G999G999D00')
           || ', contabilizado ' || to_char(d.contabilizado, 'FM999G999G999D00') || '.',
         d.declarado - d.contabilizado,
         NULL::text
    FROM (
      SELECT
        (SELECT COALESCE(SUM(f.valor_faturamento), 0)
           FROM public.faturamento_mensal f WHERE f.empresa_id = p_empresa_id) AS declarado,
        (SELECT COALESCE(SUM(l.valor), 0)
           FROM public.financeiro_lancamentos l
           JOIN public.financeiro_categorias c ON c.id = l.categoria_id
          WHERE l.empresa_id = p_empresa_id
            AND c.grupo_dre = 'receita_bruta'
            AND l.status IN ('realizado','conciliado')) AS contabilizado
    ) d
   WHERE d.declarado > 0
     AND abs(d.declarado - d.contabilizado) > d.declarado * 0.10

  UNION ALL

  -- ── 6. Regime tributário ausente ──────────────────────────────────────────
  -- Sem regime não há por qual tabela apurar, e o padrão do banco era
  -- 'simples' — foi assim que uma empresa de Lucro Presumido foi apurada pela
  -- tabela do Simples Nacional sem ninguém ter escolhido nada.
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
  -- Percentual apurado sobre lançamento sem categoria é palpite com cara de
  -- número. A cobertura entra como informativo enquanto for pequena.
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

$$;

COMMENT ON FUNCTION public.financeiro_conferencia(uuid) IS
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria. Não corrige nada — corrigir dinheiro é decisão de '
  'gente. Ela só se recusa a ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
