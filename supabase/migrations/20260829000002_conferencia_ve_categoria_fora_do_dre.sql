-- ═══════════════════════════════════════════════════════════════════════════
-- A conferência passa a ver categoria que não entra no DRE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A verificação 8 já acusava lançamento SEM categoria. Faltava o buraco
-- vizinho, e mais difícil de enxergar: o lançamento TEM categoria, a tela
-- mostra o nome dela, e mesmo assim ele não entra em linha nenhuma do
-- resultado — porque a categoria não está ligada a um grupo do DRE.
--
-- Em 28/08/2026 isso valia 445 das 603 categorias. O que impedia de notar era
-- um atalho no cálculo do DRE: quando não achava o grupo, ele somava tudo que
-- tivesse aquela natureza, e as categorias sem classificação entravam em
-- Receita Bruta ou Despesas Operacionais como se estivessem classificadas.
--
-- O atalho saiu em 27/08. As categorias foram classificadas em 28 e 29 — 191
-- por herança de nome, 13 à mão. Sobrou uma, de R$ 177,00.
--
-- Falta o que impede de voltar. Sem esta verificação, a próxima categoria
-- cadastrada sem grupo repete o ciclo em silêncio, e ninguém descobre até
-- alguém conferir o DRE contra a contabilidade.
--
-- Entra junto a verificação 13: categoria cadastrada duas vezes com caixa
-- diferente. Não erra total nenhum — mas parte a mesma despesa em duas linhas
-- do relatório, e faz quem confere procurar diferença onde não há.
--
-- Este arquivo recria a função inteira; as verificações 1 a 11 seguem iguais.

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

  UNION ALL

  -- ── 9. O gatilho que mantém o saldo derivado está ativo? ──────────────────
  -- Sem ele, saldo_atual congela no último recálculo manual e passa a mentir
  -- em silêncio. É a única checagem aqui que não olha dado, e sim o motor.
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
        AND t.tgenabled = 'O'   -- 'O' = ativo; 'D' = desabilitado
   )

  UNION ALL

  -- ── 10. Nota fiscal lançada sem o documento guardado ──────────────────────
  -- O XML da NF-e É o documento fiscal; o DANFE é a representação impressa
  -- dele. Guardar só os campos extraídos não cumpre o prazo decadencial de
  -- cinco anos, e deixa sem prova quem precisar responder a questionamento do
  -- órgão ou pedir reequilíbrio.
  --
  -- Só conta lançamento nascido a partir de 2026-08-25: cobrar documento do
  -- que foi lançado antes de o arquivamento existir seria cobrar uma
  -- obrigação retroativa que ninguém tinha como cumprir.
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
  -- "INT RESGATE MAPFRERFDI" lançado como conta a receber não é recebimento de
  -- cliente: é dinheiro da empresa voltando do CDB para a conta corrente. Ele
  -- infla o "Total a receber em aberto" e, antes da correção de 25/08, entrava
  -- como faturamento na calculadora de margem.
  --
  -- O achado APONTA e não prescreve: o remédio depende de a transferência
  -- correspondente já existir. Se existe, o título é duplicata e se remove; se
  -- não existe, o título É a transferência e se converte. Converter uma
  -- duplicata criaria uma TERCEIRA contagem.
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
  -- A verificação 8 pega lançamento SEM categoria. Este é o buraco vizinho, e
  -- mais difícil de ver: o lançamento tem categoria, a tela mostra o nome dela
  -- bonitinho, e mesmo assim ele não entra em linha nenhuma do resultado —
  -- porque a categoria não está ligada a um grupo do DRE.
  --
  -- Em 28/08/2026 isso valia 445 das 603 categorias (73,8%), e o DRE tinha um
  -- atalho que varria tudo para dentro de Receita Bruta ou Despesas
  -- Operacionais conforme a natureza. O relatório parecia completo justamente
  -- onde estava mais incompleto. O atalho saiu; o buraco, sem esta verificação,
  -- voltaria em silêncio na próxima categoria cadastrada sem grupo.
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
  -- "Assinaturas De Portais De Licitações" e "Assinaturas de Portais de
  -- Licitações" são a mesma despesa escrita com maiúsculas diferentes, e as
  -- duas tinham lançamento: o DRE exibia R$ 947,48 e R$ 628,00 em linhas
  -- separadas em vez de R$ 1.575,48 numa só.
  --
  -- Nenhum total fica errado — o que se perde é a leitura. Duas linhas com o
  -- mesmo nome fazem quem confere procurar diferença onde não há.
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
  'Refaz as derivações do Financeiro e devolve o que não fecha: saldo que não '
  'corresponde aos lançamentos, conta negativa, transferência sem par ou acima '
  'do saldo, faturamento divergente, regime ausente, data implausível, '
  'lançamento sem categoria, categoria sem grupo de DRE e categoria repetida. '
  'Não corrige nada — corrigir dinheiro é decisão de gente. Ela só se recusa a '
  'ficar calada.';

GRANT EXECUTE ON FUNCTION public.financeiro_conferencia(uuid) TO authenticated;

-- Uso:
--   SELECT * FROM public.financeiro_conferencia(
--     (SELECT id FROM public.empresas WHERE razao_social ILIKE 'ETHOS%')
--   ) ORDER BY CASE severidade WHEN 'critico' THEN 1 WHEN 'atencao' THEN 2 ELSE 3 END;
