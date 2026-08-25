-- =============================================================================
-- A ponte entre o Financeiro e o comercial: os indicadores gerenciais
--
-- O sistema já sabia formar preço em cinco camadas (composicao-engine), já
-- derivava a RECEITA dos lançamentos (financeiro_receita_competencia) e já
-- classificava cada despesa no plano de contas (grupo_dre). O que faltava era
-- a travessa: ninguém computava QUANTO as despesas fixas representam da
-- receita — e esse percentual, digitado à mão na calculadora, é o que separa
-- um preço que cobre a estrutura de um preço que a ignora.
--
-- Aqui ele passa a nascer dos lançamentos conciliados.
--
-- DUAS DECISÕES DE DOUTRINA, ditas em voz alta:
--
-- 1. O CMV NÃO ENTRA no percentual. O custo da mercadoria já é o `custo
--    unitário` de cada item na cotação — somá-lo de novo como percentual
--    cobraria o produto duas vezes. Ele é devolvido só para conferência.
--
-- 2. COMPETÊNCIA, não caixa. O aluguel de agosto pesa em agosto, ainda que
--    pago em setembro — é a mesma régua da apuração tributária, e é a que
--    responde "quanto custa manter a empresa aberta por mês".
--
-- E uma obrigação: lançamento SEM categoria não tem grupo_dre e não entra em
-- conta nenhuma. A função devolve a COBERTURA (quanto do movimento está
-- classificado) — um percentual apurado sobre metade dos lançamentos é um
-- palpite com cara de número, e quem lê precisa saber disso.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.financeiro_indicadores_gerenciais(
  p_empresa_id uuid,
  p_referencia date DEFAULT CURRENT_DATE,
  p_meses int DEFAULT 12
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH faixa AS (
    SELECT
      (date_trunc('month', p_referencia) - make_interval(months => GREATEST(p_meses, 1) - 1))::date AS ini,
      (date_trunc('month', p_referencia) + interval '1 month - 1 day')::date AS fim,
      GREATEST(p_meses, 1)::numeric AS meses
  ),
  base AS (
    SELECT
      l.valor,
      l.natureza,
      c.grupo_dre,
      (l.categoria_id IS NOT NULL) AS classificado
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
    , faixa f
    WHERE l.empresa_id = p_empresa_id
      -- Realizado e conciliado: o que de fato aconteceu. Previsto entra na
      -- receita da apuração fiscal, mas indicador de estrutura se apura sobre
      -- fato consumado — despesa prevista que não veio inflaria o preço.
      AND l.status IN ('realizado','conciliado')
      AND l.tipo IN ('a_receber','a_pagar')
      AND l.data_competencia BETWEEN f.ini AND f.fim
  ),
  somas AS (
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE grupo_dre = 'receita_bruta'), 0)   AS receita,
      COALESCE(SUM(valor) FILTER (WHERE grupo_dre = 'deducoes'), 0)        AS deducoes,
      COALESCE(SUM(valor) FILTER (WHERE grupo_dre = 'cmv_cps'), 0)         AS cmv,
      COALESCE(SUM(valor) FILTER (WHERE grupo_dre = 'desp_operacional'), 0) AS desp_operacional,
      COALESCE(SUM(valor) FILTER (WHERE grupo_dre = 'desp_financeira'), 0)  AS desp_financeira,
      COALESCE(SUM(valor) FILTER (WHERE natureza = 'despesa'), 0)          AS despesa_total,
      COALESCE(SUM(valor) FILTER (WHERE natureza = 'despesa' AND classificado), 0) AS despesa_classificada,
      COALESCE(SUM(valor) FILTER (WHERE natureza = 'receita'), 0)          AS receita_total,
      COALESCE(SUM(valor) FILTER (WHERE natureza = 'receita' AND classificado), 0) AS receita_classificada
    FROM base
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object(
      'inicio', (SELECT ini FROM faixa),
      'fim', (SELECT fim FROM faixa),
      'meses', (SELECT meses FROM faixa)
    ),
    -- Os totais do período, para quem quiser conferir a conta
    'receita_bruta',      s.receita,
    'deducoes',           s.deducoes,
    'cmv',                s.cmv,
    'despesa_operacional', s.desp_operacional,
    'despesa_financeira', s.desp_financeira,
    -- A média mensal: "quanto custa manter a empresa aberta por mês"
    'media_mensal', jsonb_build_object(
      'receita', ROUND(s.receita / (SELECT meses FROM faixa), 2),
      'despesa_operacional', ROUND(s.desp_operacional / (SELECT meses FROM faixa), 2),
      'despesa_financeira', ROUND(s.desp_financeira / (SELECT meses FROM faixa), 2)
    ),
    -- Os percentuais que a calculadora consome. Convenção 0–100 (alíquota
    -- transcrita, não fração — ver CLAUDE.md).
    'pct_despesa_administrativa', CASE WHEN s.receita > 0
      THEN ROUND((s.desp_operacional / s.receita) * 100, 2) ELSE NULL END,
    'pct_despesa_financeira', CASE WHEN s.receita > 0
      THEN ROUND((s.desp_financeira / s.receita) * 100, 2) ELSE NULL END,
    'pct_cmv', CASE WHEN s.receita > 0
      THEN ROUND((s.cmv / s.receita) * 100, 2) ELSE NULL END,
    -- Cobertura: sem ela, o percentual é palpite com cara de número.
    'cobertura', jsonb_build_object(
      'despesa', CASE WHEN s.despesa_total > 0
        THEN ROUND((s.despesa_classificada / s.despesa_total) * 100, 2) ELSE NULL END,
      'receita', CASE WHEN s.receita_total > 0
        THEN ROUND((s.receita_classificada / s.receita_total) * 100, 2) ELSE NULL END,
      'despesa_sem_categoria', s.despesa_total - s.despesa_classificada,
      'receita_sem_categoria', s.receita_total - s.receita_classificada
    ),
    -- Confiável quando há receita e a classificação cobre ao menos 80% do
    -- movimento. Abaixo disso a tela avisa em vez de entregar o número calada.
    'confiavel', (
      s.receita > 0
      AND (s.despesa_total = 0 OR (s.despesa_classificada / NULLIF(s.despesa_total,0)) >= 0.8)
      AND (s.receita_total = 0 OR (s.receita_classificada / NULLIF(s.receita_total,0)) >= 0.8)
    )
  )
  FROM somas s;
$$;

COMMENT ON FUNCTION public.financeiro_indicadores_gerenciais(uuid, date, int) IS
  'Indicadores que ligam o Financeiro ao comercial: percentual das despesas '
  'operacionais e financeiras sobre a receita bruta, por competência, numa '
  'janela móvel de N meses. CMV fica FORA do percentual (já é o custo unitário '
  'do item na cotação) e vem só para conferência. Devolve a cobertura da '
  'classificação — percentual apurado sobre lançamento sem categoria é palpite.';

-- ── Registro do que a empresa ADOTOU, e quando ───────────────────────────────
-- O indicador é calculado; a decisão de usá-lo é de alguém. Congelar a versão
-- adotada dá defesa: "esta proposta usou 12,4%, apurados em 25/08 sobre 12
-- meses" — reprocessar o passado com o percentual de hoje reescreveria a
-- história de propostas já entregues.
CREATE TABLE IF NOT EXISTS public.financeiro_indicadores_adotados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  adotado_em timestamptz NOT NULL DEFAULT now(),
  adotado_por uuid,
  referencia date NOT NULL,
  meses int NOT NULL,
  pct_despesa_administrativa numeric,
  pct_despesa_financeira numeric,
  -- O retrato completo do cálculo, para auditoria: quem quiser conferir o
  -- número dois anos depois não depende de reprocessar nada.
  indicadores jsonb NOT NULL,
  observacao text
);

CREATE INDEX IF NOT EXISTS idx_indicadores_adotados_empresa
  ON public.financeiro_indicadores_adotados(empresa_id, adotado_em DESC);

ALTER TABLE public.financeiro_indicadores_adotados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membros leem indicadores adotados" ON public.financeiro_indicadores_adotados;
CREATE POLICY "membros leem indicadores adotados"
  ON public.financeiro_indicadores_adotados FOR SELECT TO authenticated
  USING (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "membros adotam indicadores" ON public.financeiro_indicadores_adotados;
CREATE POLICY "membros adotam indicadores"
  ON public.financeiro_indicadores_adotados FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_member(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "admin exclui indicadores adotados" ON public.financeiro_indicadores_adotados;
CREATE POLICY "admin exclui indicadores adotados"
  ON public.financeiro_indicadores_adotados FOR DELETE TO authenticated
  USING (public.is_empresa_admin(auth.uid(), empresa_id));

COMMENT ON TABLE public.financeiro_indicadores_adotados IS
  'Versões congeladas dos indicadores gerenciais que a empresa adotou para '
  'precificar. O cálculo é vivo; a adoção é um ato datado — proposta entregue '
  'não se reescreve com o percentual do mês seguinte.';
