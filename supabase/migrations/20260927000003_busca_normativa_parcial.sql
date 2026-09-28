-- ============================================================================
-- Busca na base normativa: correspondência parcial, trecho marcado, por fonte
-- ============================================================================
--
-- "ATESTADO DE CAPACIDADE TÉCNICA" devolvia 2 linhas do Planalto e nada do
-- TCU (27/09): a busca exigia TODAS as palavras no mesmo registro, e o texto
-- inteiro da lei entrava como resultado (é ruído — os artigos já estão lá).
-- Agora: primeiro quem tem todas as palavras, depois quem tem alguma
-- (`correspondencia` = 'todas' | 'parcial'); o trecho vem com as palavras
-- marcadas entre « »; dá para restringir por fonte; o documento inteiro das
-- leis do Planalto fica fora (acórdão e ato do DOU seguem, são registros únicos).
--
-- Colar no SQL Editor do projeto uwtyuwktxalnpgrcbbgk.

DROP FUNCTION IF EXISTS public.buscar_base_normativa(text, integer);

CREATE OR REPLACE FUNCTION public.buscar_base_normativa(p_termo text, p_limite integer DEFAULT 10, p_fonte text DEFAULT NULL)
RETURNS TABLE (
  id uuid, fonte text, tipo text, identificador text, dispositivo text, titulo text, ementa text,
  trecho text, url text, data_publicacao date, atualizado_em timestamptz, relevancia real, correspondencia text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('portuguese', p_termo) AS todas,
           (SELECT to_tsquery('portuguese', string_agg(l, ' | '))
              FROM unnest(tsvector_to_array(to_tsvector('portuguese', p_termo))) AS l) AS qualquer
  )
  SELECT b.id, b.fonte, b.tipo, b.identificador, b.dispositivo, b.titulo, b.ementa,
         -- O trecho marca QUALQUER das palavras: com só a consulta exata, a linha
         -- parcial vinha sem marca e mostrava o começo do artigo.
         ts_headline('portuguese', left(b.texto, 20000), q.qualquer,
                     'StartSel=«, StopSel=», MaxFragments=2, MaxWords=35, MinWords=12, FragmentDelimiter= … ') AS trecho,
         b.url, b.data_publicacao, b.atualizado_em,
         ts_rank_cd(b.busca, q.qualquer) AS relevancia,
         CASE WHEN b.busca @@ q.todas THEN 'todas' ELSE 'parcial' END AS correspondencia
    FROM public.base_normativa b, q
   WHERE b.ativo
     AND q.qualquer IS NOT NULL
     AND b.busca @@ q.qualquer
     AND NOT (b.fonte = 'planalto' AND b.dispositivo IS NULL)
     AND (p_fonte IS NULL OR b.fonte = p_fonte)
   ORDER BY (b.busca @@ q.todas) DESC, relevancia DESC, b.atualizado_em DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50);
$$;

-- Quantos cada fonte tem para o termo (a tela diz "DOU: 0" em vez de sumir com o DOU).
CREATE OR REPLACE FUNCTION public.contar_base_normativa(p_termo text)
RETURNS TABLE (fonte text, todas bigint, parcial bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (
    SELECT websearch_to_tsquery('portuguese', p_termo) AS todas,
           (SELECT to_tsquery('portuguese', string_agg(l, ' | '))
              FROM unnest(tsvector_to_array(to_tsvector('portuguese', p_termo))) AS l) AS qualquer
  )
  SELECT b.fonte,
         count(*) FILTER (WHERE b.busca @@ q.todas) AS todas,
         count(*) FILTER (WHERE NOT (b.busca @@ q.todas)) AS parcial
    FROM public.base_normativa b, q
   WHERE b.ativo AND q.qualquer IS NOT NULL AND b.busca @@ q.qualquer
     AND NOT (b.fonte = 'planalto' AND b.dispositivo IS NULL)
   GROUP BY b.fonte;
$$;

-- ── Conferência ─────────────────────────────────────────────────────────────
--   SELECT fonte, identificador, dispositivo, correspondencia, left(trecho, 80)
--     FROM public.buscar_base_normativa('atestado de capacidade técnica', 20);
--   -- Esperado: art. 67 com 'todas' primeiro; depois acórdãos e artigos 'parcial'.
--   SELECT * FROM public.contar_base_normativa('atestado de capacidade técnica');
