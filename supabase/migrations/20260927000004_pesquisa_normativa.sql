-- ============================================================================
-- Pesquisa normativa: filtros de fonte, período, diploma e tipo; total; páginas
-- ============================================================================
--
-- O dono (27/09, 21h35): "a pesquisa continua vaga e limitada — mistura
-- Planalto com TCU, não traz datas, períodos, filtros". Uma pesquisa jurídica
-- precisa de: fonte, período, diploma (qual lei), tipo de ato ou colegiado,
-- ordem por relevância ou data, total e páginas, e os metadados de cada
-- registro (relator, sessão, situação, órgão, edição, página). Esta migration:
--   1) `detalhe jsonb` em base_normativa — os metadados estruturados que a
--      ingestão passa a gravar (TCU: relator, colegiado, situacao, numero_ata,
--      data_sessao; DOU: orgao, tipo_ato, edicao, pagina, secao; Planalto: lei,
--      artigo);
--   2) `pesquisar_base_normativa(...)`: termo OPCIONAL (sem termo, navega por
--      período), fonte, diploma, tipo, período, ordem, página; devolve o total;
--   3) `facetas_base_normativa(...)`: quantos por fonte, por diploma/tipo e
--      por ano, para os filtros mostrarem o que existe.
-- A `buscar_base_normativa` continua (a redação por IA a usa).
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

ALTER TABLE public.base_normativa ADD COLUMN IF NOT EXISTS detalhe jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS base_normativa_data ON public.base_normativa (fonte, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS base_normativa_tipo ON public.base_normativa (fonte, tipo);

-- ── 2) A pesquisa ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pesquisar_base_normativa(
  p_termo text DEFAULT NULL,
  p_fonte text DEFAULT NULL,
  p_identificador text DEFAULT NULL,   -- diploma exato ("Lei 14.133/2021") ou parte ("14.133")
  p_tipo text DEFAULT NULL,            -- tipo do registro (lei, acordao, portaria…) ou, no TCU, o colegiado
  p_data_de date DEFAULT NULL,
  p_data_ate date DEFAULT NULL,
  p_ordem text DEFAULT 'relevancia',   -- 'relevancia' | 'data'
  p_limite integer DEFAULT 20,
  p_deslocamento integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, fonte text, tipo text, identificador text, dispositivo text, titulo text, ementa text,
  trecho text, url text, data_publicacao date, atualizado_em timestamptz, detalhe jsonb,
  relevancia real, correspondencia text, total bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (
    SELECT NULLIF(btrim(COALESCE(p_termo, '')), '') AS termo,
           websearch_to_tsquery('portuguese', COALESCE(p_termo, '')) AS todas,
           (SELECT to_tsquery('portuguese', string_agg(l, ' | '))
              FROM unnest(tsvector_to_array(to_tsvector('portuguese', COALESCE(p_termo, '')))) AS l) AS qualquer
  ),
  base AS (
    SELECT b.*, q.termo, q.todas, q.qualquer,
           CASE WHEN q.termo IS NULL THEN 0 ELSE ts_rank_cd(b.busca, q.qualquer) END AS relevancia_calc,
           CASE WHEN q.termo IS NULL THEN 'todas' WHEN b.busca @@ q.todas THEN 'todas' ELSE 'parcial' END AS correspondencia_calc
      FROM public.base_normativa b, q
     WHERE b.ativo
       AND NOT (b.fonte = 'planalto' AND b.dispositivo IS NULL)
       AND (q.termo IS NULL OR (q.qualquer IS NOT NULL AND b.busca @@ q.qualquer))
       AND (p_fonte IS NULL OR b.fonte = p_fonte)
       AND (p_identificador IS NULL OR b.identificador ILIKE '%' || p_identificador || '%')
       AND (p_tipo IS NULL OR b.tipo = lower(p_tipo) OR b.detalhe->>'colegiado' ILIKE p_tipo)
       AND (p_data_de IS NULL OR b.data_publicacao >= p_data_de)
       AND (p_data_ate IS NULL OR b.data_publicacao <= p_data_ate)
  )
  SELECT b.id, b.fonte, b.tipo, b.identificador, b.dispositivo, b.titulo, b.ementa,
         CASE WHEN b.termo IS NULL THEN left(b.texto, 600)
              ELSE ts_headline('portuguese', left(b.texto, 20000), b.qualquer,
                               'StartSel=«, StopSel=», MaxFragments=2, MaxWords=35, MinWords=12, FragmentDelimiter= … ')
         END AS trecho,
         b.url, b.data_publicacao, b.atualizado_em, b.detalhe,
         b.relevancia_calc AS relevancia, b.correspondencia_calc AS correspondencia,
         count(*) OVER () AS total
    FROM base b
   ORDER BY
     CASE WHEN p_ordem = 'data' THEN 0 ELSE 1 END,
     CASE WHEN p_ordem = 'data' THEN b.data_publicacao END DESC NULLS LAST,
     (b.correspondencia_calc = 'todas') DESC, b.relevancia_calc DESC, b.data_publicacao DESC NULLS LAST, b.identificador, b.dispositivo
   LIMIT LEAST(GREATEST(COALESCE(p_limite, 20), 1), 100)
  OFFSET GREATEST(COALESCE(p_deslocamento, 0), 0);
$$;

-- ── 3) As facetas: o que existe para os filtros mostrarem ──────────────────
CREATE OR REPLACE FUNCTION public.facetas_base_normativa(p_termo text DEFAULT NULL, p_fonte text DEFAULT NULL)
RETURNS TABLE (faceta text, valor text, quantidade bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (
    SELECT NULLIF(btrim(COALESCE(p_termo, '')), '') AS termo,
           (SELECT to_tsquery('portuguese', string_agg(l, ' | '))
              FROM unnest(tsvector_to_array(to_tsvector('portuguese', COALESCE(p_termo, '')))) AS l) AS qualquer
  ),
  base AS (
    SELECT b.fonte, b.tipo, b.identificador, b.data_publicacao, b.detalhe
      FROM public.base_normativa b, q
     WHERE b.ativo
       AND NOT (b.fonte = 'planalto' AND b.dispositivo IS NULL)
       AND (q.termo IS NULL OR (q.qualquer IS NOT NULL AND b.busca @@ q.qualquer))
       AND (p_fonte IS NULL OR b.fonte = p_fonte)
  )
  SELECT 'fonte', fonte, count(*) FROM base GROUP BY fonte
  UNION ALL
  SELECT 'diploma', identificador, count(*) FROM base WHERE fonte = 'planalto' GROUP BY identificador
  UNION ALL
  SELECT 'colegiado', detalhe->>'colegiado', count(*) FROM base WHERE fonte = 'tcu' AND detalhe ? 'colegiado' GROUP BY detalhe->>'colegiado'
  UNION ALL
  SELECT 'tipo', tipo, count(*) FROM base WHERE fonte = 'dou' GROUP BY tipo
  UNION ALL
  SELECT 'ano', extract(year FROM data_publicacao)::int::text, count(*) FROM base WHERE data_publicacao IS NOT NULL GROUP BY 2
  ORDER BY 1, 3 DESC;
$$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT fonte, identificador, dispositivo, data_publicacao, correspondencia, total
--     FROM public.pesquisar_base_normativa('atestado de capacidade técnica', 'tcu', NULL, NULL, '2025-01-01', NULL, 'data', 10, 0);
--   SELECT * FROM public.facetas_base_normativa(NULL, NULL);
--   -- Sem termo, TCU por período: SELECT identificador, data_publicacao, total FROM public.pesquisar_base_normativa(NULL, 'tcu', NULL, NULL, '2026-09-01', '2026-09-30', 'data', 20, 0);
