-- ═══════════════════════════════════════════════════════════════════════════
-- Preço por objeto: palavras E significado (22/09/2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "CARNE MOIDA PATINHO" no Pará voltava "nenhum edital similar" com 3 editais
-- de carne moída e 78 de carne no acervo (65.496 editais em 3 anos, 65.463
-- com vetor): a busca era só por vetor, com piso absoluto de 45%, e a busca
-- por palavras só rodava quando o vetor FALHAVA — nunca quando ele achava
-- zero. Um produto de três palavras contra a descrição de um edital de
-- trinta raramente passa de 45% de similaridade.
--
-- Esta função junta as duas réguas: o texto (`objeto_tsv`, com radical em
-- português, índice GIN `idx_pncp_cache_fts`) decide QUEM entra; o vetor,
-- quando vem, decide a ORDEM — sem piso absoluto. Sem vetor, a ordem é a
-- relevância do texto e a data.
--   p_modo   'todas'    → todas as palavras presentes (plainto_tsquery);
--            'qualquer' → ao menos uma (websearch_to_tsquery com OR, montado
--                         pela função de borda em p_texto_ou).
-- "Só significado" continua na `historico_orgao_semantico`, com piso 0.25.
-- Quem chama: edge `historico-orgao-pncp` (corpo com `modo`), pela aba
-- Preços de Análise de mercado. Serviço, não anon.

CREATE OR REPLACE FUNCTION public.precos_por_objeto_no_acervo(
  p_texto text,
  p_texto_ou text DEFAULT NULL,
  p_modo text DEFAULT 'qualquer',
  p_embedding vector DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_limite integer DEFAULT 30
)
RETURNS TABLE(
  id uuid, pncp_id text, numero_controle_pncp text, cnpj_orgao text, orgao text,
  objeto text, modalidade_nome text, uf text, municipio text,
  valor_total_estimado numeric, data_publicacao_pncp timestamp with time zone,
  numero_compra text, ano_compra text, sequencial_compra text, url_pncp text,
  similaridade real
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  WITH c AS (
    SELECT
      plainto_tsquery('portuguese', p_texto) AS todas,
      websearch_to_tsquery('portuguese', COALESCE(NULLIF(p_texto_ou, ''), p_texto)) AS qualquer
  )
  SELECT
    e.id, e.pncp_id, e.numero_controle_pncp, e.cnpj_orgao, e.orgao, e.objeto,
    e.modalidade_nome, e.uf, e.municipio, e.valor_total_estimado,
    e.data_publicacao_pncp, e.numero_compra, e.ano_compra, e.sequencial_compra,
    e.url_pncp,
    CASE WHEN p_embedding IS NULL OR e.embedding IS NULL THEN NULL
         ELSE (1 - (e.embedding <=> p_embedding))::real END AS similaridade
  FROM public.pncp_editais_cache e, c
  WHERE e.objeto_tsv @@ (CASE WHEN p_modo = 'todas' THEN c.todas ELSE c.qualquer END)
    AND (p_cnpj IS NULL OR regexp_replace(COALESCE(e.cnpj_orgao, ''), '\D', '', 'g') = p_cnpj)
    AND (p_desde IS NULL OR e.data_publicacao_pncp >= p_desde)
    AND (p_ate IS NULL OR e.data_publicacao_pncp < (p_ate + 1))
    AND (p_uf IS NULL OR e.uf = upper(p_uf))
    AND (p_municipio IS NULL OR e.municipio ILIKE '%' || p_municipio || '%')
  ORDER BY 16 DESC NULLS LAST,
           ts_rank(e.objeto_tsv, CASE WHEN p_modo = 'todas' THEN c.todas ELSE c.qualquer END) DESC,
           e.data_publicacao_pncp DESC
  LIMIT p_limite;
$function$;

COMMENT ON FUNCTION public.precos_por_objeto_no_acervo(text, text, text, vector, date, date, text, text, text, integer) IS
  'Preço por objeto (22/09/2026): filtra o acervo pelas palavras (objeto_tsv, todas ou qualquer) e ordena pela similaridade do vetor quando ele vem; sem piso absoluto. Chamada pela edge historico-orgao-pncp com modo.';

REVOKE ALL ON FUNCTION public.precos_por_objeto_no_acervo(text, text, text, vector, date, date, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.precos_por_objeto_no_acervo(text, text, text, vector, date, date, text, text, text, integer) TO authenticated, service_role;

-- Conferência (a colar depois; só leitura): três editais de carne moída no
-- Pará, os de carne por perto, nenhum "Carneiro".
-- SELECT orgao, left(objeto, 90), valor_total_estimado, similaridade
--   FROM public.precos_por_objeto_no_acervo('carne moída patinho', 'carne OR moída OR patinho', 'qualquer', NULL, (now() - interval '3 years')::date, NULL, 'PA', NULL, NULL, 10);
