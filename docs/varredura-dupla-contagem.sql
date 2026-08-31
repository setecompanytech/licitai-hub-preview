-- ═══════════════════════════════════════════════════════════════════════════
-- FASE 2 — Varredura de dupla contagem de custo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SOMENTE LEITURA. Nenhum INSERT, UPDATE ou DELETE. Pode rodar à vontade.
--
-- Antes de ligar Contas a Pagar ao contrato, é preciso saber se algum custo já
-- está anotado nos DOIS livros. Se estiver, a ligação passaria a contá-lo duas
-- vezes, e a margem pioraria sem nada ter mudado no mundo real.
--
-- Rode as cinco e me mande os resultados. A 3 é a que decide.

-- ── 1. Existe custo digitado? ───────────────────────────────────────────────
-- Se voltar zero, não há o que duplicar e a Fase 3 começa limpa.
SELECT count(*) AS linhas,
       count(DISTINCT contrato_id) AS contratos,
       SUM(valor) AS total
  FROM public.contrato_custos;

-- ── 2. Alguma despesa já aponta para contrato? ──────────────────────────────
-- A coluna existe desde sempre e nenhuma tela a preenche — mas importação ou
-- SQL antigo podem ter preenchido.
SELECT count(*) AS lancamentos,
       count(DISTINCT contrato_id) AS contratos,
       SUM(valor) AS total
  FROM public.financeiro_lancamentos
 WHERE tipo = 'a_pagar'
   AND contrato_id IS NOT NULL;

-- ── 3. OS PARES SUSPEITOS ───────────────────────────────────────────────────
-- Mesmo contrato, mesmo valor ao centavo, datas a até 15 dias. Cada linha aqui
-- é um custo que corre o risco de ser contado duas vezes.
--
-- Zero linhas: caminho livre.
-- Alguma linha: cada uma é uma decisão sua, antes de qualquer migration.
SELECT ct.numero_contrato,
       c.descricao        AS custo_digitado,
       c.valor            AS valor_custo,
       c.data_lancamento,
       c.tipo             AS tipo_custo,
       l.descricao        AS lancamento_a_pagar,
       l.data_competencia,
       l.status
  FROM public.contrato_custos c
  JOIN public.contratos ct ON ct.id = c.contrato_id
  JOIN public.financeiro_lancamentos l
    ON l.contrato_id = c.contrato_id
   AND l.tipo = 'a_pagar'
   AND abs(l.valor - c.valor) < 0.01
   AND abs(l.data_competencia - c.data_lancamento) <= 15
 ORDER BY ct.numero_contrato, c.valor DESC;

-- ── 4. O mesmo, mas frouxo: pela NOTA FISCAL ────────────────────────────────
-- `contrato_custos.nota_fiscal` e `financeiro_lancamentos.numero_documento`
-- podem apontar o mesmo papel mesmo com valores diferentes (parcelamento,
-- retenção). Compara só os dígitos: "000123" e "123" são a mesma nota.
SELECT ct.numero_contrato,
       c.nota_fiscal, c.valor AS valor_custo,
       l.numero_documento, l.valor AS valor_lancamento, l.status
  FROM public.contrato_custos c
  JOIN public.contratos ct ON ct.id = c.contrato_id
  JOIN public.financeiro_lancamentos l
    ON l.tipo = 'a_pagar'
   AND l.numero_documento IS NOT NULL
   AND c.nota_fiscal IS NOT NULL
   AND ltrim(regexp_replace(l.numero_documento, '\D', '', 'g'), '0')
     = ltrim(regexp_replace(c.nota_fiscal,      '\D', '', 'g'), '0')
   AND ltrim(regexp_replace(c.nota_fiscal, '\D', '', 'g'), '0') <> ''
 ORDER BY ct.numero_contrato;

-- ── 5. O retrato por contrato ───────────────────────────────────────────────
-- Quanto cada livro diz que o contrato custou. Serve de linha de base: depois
-- da Fase 3, o total combinado não pode ter crescido sem explicação.
SELECT ct.numero_contrato,
       ct.valor_global,
       COALESCE(cc.total, 0)  AS custo_digitado,
       COALESCE(fl.total, 0)  AS a_pagar_ja_ligado,
       COALESCE(cc.total, 0) + COALESCE(fl.total, 0) AS soma_dos_dois
  FROM public.contratos ct
  LEFT JOIN (
    SELECT contrato_id, SUM(valor) AS total
      FROM public.contrato_custos GROUP BY 1
  ) cc ON cc.contrato_id = ct.id
  LEFT JOIN (
    SELECT contrato_id, SUM(valor) AS total
      FROM public.financeiro_lancamentos
     WHERE tipo = 'a_pagar' AND contrato_id IS NOT NULL
     GROUP BY 1
  ) fl ON fl.contrato_id = ct.id
 WHERE COALESCE(cc.total, 0) + COALESCE(fl.total, 0) > 0
 ORDER BY soma_dos_dois DESC;
