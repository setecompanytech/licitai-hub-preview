-- ═══════════════════════════════════════════════════════════════════════════
-- 20260908000006 · Análise de Mercado: janelas de dias (semana, mês) (08/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O período começava em "últimos 3 meses"; o dono pediu janelas curtas —
-- última semana, último mês. O RPC ganha p_dias (dias corridos), que quando
-- presente vence p_meses. A assinatura antiga sai para não deixar overload
-- ambíguo.

DROP FUNCTION IF EXISTS public.analise_mercado_acervo(text, int);

CREATE OR REPLACE FUNCTION public.analise_mercado_acervo(
  p_uf text DEFAULT NULL,
  p_meses int DEFAULT 12,
  p_dias int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT
    orgao, uf, municipio, modalidade_nome, objeto, url_pncp,
    data_publicacao_pncp::date AS pub,
    CASE WHEN valor_total_estimado > 0 AND valor_total_estimado < 1e10
         THEN valor_total_estimado END AS valor
  FROM pncp_editais_cache
  WHERE data_publicacao_pncp IS NOT NULL
    AND data_publicacao_pncp::date >= (
      current_date - COALESCE(
        make_interval(days => NULLIF(GREATEST(COALESCE(p_dias, 0), 0), 0)),
        make_interval(months => GREATEST(p_meses, 1))
      )
    )
    AND (p_uf IS NULL OR uf = upper(p_uf))
),
totais AS (
  SELECT count(*) AS editais,
         count(DISTINCT orgao) AS orgaos,
         sum(valor) AS volume,
         avg(valor) AS valor_medio,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY valor) AS valor_mediano,
         count(valor) AS com_valor
  FROM base
),
por_mes AS (
  SELECT jsonb_agg(jsonb_build_object(
           'mes', mes, 'editais', editais, 'volume', volume, 'valor_medio', valor_medio)
         ORDER BY mes) AS dados
  FROM (
    SELECT to_char(pub, 'YYYY-MM') AS mes,
           count(*) AS editais,
           round(sum(valor)::numeric, 2) AS volume,
           round(avg(valor)::numeric, 2) AS valor_medio
    FROM base GROUP BY 1
  ) m
),
por_modalidade AS (
  SELECT jsonb_agg(jsonb_build_object(
           'modalidade', modalidade, 'editais', editais, 'volume', volume)
         ORDER BY editais DESC) AS dados
  FROM (
    SELECT coalesce(modalidade_nome, 'Não informada') AS modalidade,
           count(*) AS editais,
           round(sum(valor)::numeric, 2) AS volume
    FROM base GROUP BY 1 ORDER BY count(*) DESC LIMIT 8
  ) m
),
top_orgaos AS (
  SELECT jsonb_agg(jsonb_build_object(
           'orgao', orgao, 'editais', editais, 'volume', volume)
         ORDER BY editais DESC) AS dados
  FROM (
    SELECT orgao, count(*) AS editais, round(sum(valor)::numeric, 2) AS volume
    FROM base WHERE orgao IS NOT NULL
    GROUP BY orgao ORDER BY count(*) DESC LIMIT 10
  ) o
),
maiores AS (
  SELECT jsonb_agg(jsonb_build_object(
           'objeto', left(objeto, 220), 'orgao', orgao, 'municipio', municipio,
           'uf', uf, 'valor', valor, 'data', pub, 'url', url_pncp)
         ORDER BY valor DESC) AS dados
  FROM (
    SELECT * FROM base WHERE valor IS NOT NULL ORDER BY valor DESC LIMIT 15
  ) g
)
SELECT jsonb_build_object(
  'totais', (SELECT to_jsonb(t) FROM totais t),
  'por_mes', coalesce((SELECT dados FROM por_mes), '[]'::jsonb),
  'por_modalidade', coalesce((SELECT dados FROM por_modalidade), '[]'::jsonb),
  'top_orgaos', coalesce((SELECT dados FROM top_orgaos), '[]'::jsonb),
  'maiores', coalesce((SELECT dados FROM maiores), '[]'::jsonb),
  'gerado_em', now()
);
$$;

GRANT EXECUTE ON FUNCTION public.analise_mercado_acervo(text, int, int) TO authenticated;
