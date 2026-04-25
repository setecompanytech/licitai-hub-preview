-- Sprint G: DFC pelo método indireto (CPC 03)
-- 1) Adiciona classificação DFC no plano de contas
ALTER TABLE public.financeiro_categorias
  ADD COLUMN IF NOT EXISTS dfc_classe text
  CHECK (dfc_classe IN ('operacional','investimento','financiamento'));

COMMENT ON COLUMN public.financeiro_categorias.dfc_classe IS
  'Classificação DFC CPC 03: operacional (atividade-fim), investimento (ativo imobilizado/intangível), financiamento (capital próprio/terceiros).';

-- 2) Default: tudo que ainda é NULL é tratado como operacional
UPDATE public.financeiro_categorias
SET dfc_classe = 'operacional'
WHERE dfc_classe IS NULL;

-- 3) RPC: DFC mensal por classe (operacional/investimento/financiamento)
CREATE OR REPLACE FUNCTION public.financeiro_dfc_mensal(
  p_empresa_id uuid,
  p_meses integer DEFAULT 6
)
RETURNS TABLE (
  competencia date,
  classe text,
  entradas numeric,
  saidas numeric,
  liquido numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      date_trunc('month', l.data_competencia)::date AS competencia,
      COALESCE(c.dfc_classe, 'operacional') AS classe,
      l.natureza,
      l.valor::numeric AS valor
    FROM public.financeiro_lancamentos l
    LEFT JOIN public.financeiro_categorias c ON c.id = l.categoria_id
    WHERE l.empresa_id = p_empresa_id
      AND l.status IN ('realizado','conciliado')
      AND l.data_competencia >= (date_trunc('month', CURRENT_DATE) - ((p_meses - 1) || ' months')::interval)::date
  )
  SELECT
    competencia,
    classe,
    COALESCE(SUM(valor) FILTER (WHERE natureza = 'receita'), 0) AS entradas,
    COALESCE(SUM(valor) FILTER (WHERE natureza = 'despesa'), 0) AS saidas,
    COALESCE(SUM(valor) FILTER (WHERE natureza = 'receita'), 0)
      - COALESCE(SUM(valor) FILTER (WHERE natureza = 'despesa'), 0) AS liquido
  FROM base
  GROUP BY competencia, classe
  ORDER BY competencia, classe;
$$;