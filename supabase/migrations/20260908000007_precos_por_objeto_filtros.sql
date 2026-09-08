-- ═══════════════════════════════════════════════════════════════════════════
-- 20260908000007 · Preços por objeto: filtros de UF, município e ano (08/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A busca semântica devolvia os 30 mais similares do acervo INTEIRO — SP e MT
-- misturados com o PA, e vizinhos a 50% de similaridade poluindo a mediana.
-- O RPC ganha recortes opcionais: UF, município (parcial), data final (para
-- ano exato). O rigor (p_similaridade_min) já existia e passa a ser exposto
-- na tela. DROP antes do CREATE: assinatura nova com os mesmos nomes viraria
-- OVERLOAD e o PostgREST não saberia qual chamar.

DROP FUNCTION IF EXISTS public.historico_orgao_semantico(vector, text, date, integer, real);

CREATE OR REPLACE FUNCTION public.historico_orgao_semantico(
  p_embedding vector,
  p_cnpj text DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_limite integer DEFAULT 12,
  p_similaridade_min real DEFAULT 0.25,
  p_uf text DEFAULT NULL,
  p_municipio text DEFAULT NULL,
  p_ate date DEFAULT NULL
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
  SELECT
    e.id, e.pncp_id, e.numero_controle_pncp, e.cnpj_orgao, e.orgao, e.objeto,
    e.modalidade_nome, e.uf, e.municipio, e.valor_total_estimado,
    e.data_publicacao_pncp, e.numero_compra, e.ano_compra, e.sequencial_compra,
    e.url_pncp,
    (1 - (e.embedding <=> p_embedding))::real AS similaridade
  FROM public.pncp_editais_cache e
  WHERE e.embedding IS NOT NULL
    AND (p_cnpj IS NULL OR regexp_replace(COALESCE(e.cnpj_orgao, ''), '\D', '', 'g') = p_cnpj)
    AND (p_desde IS NULL OR e.data_publicacao_pncp >= p_desde)
    AND (p_ate IS NULL OR e.data_publicacao_pncp < (p_ate + 1))
    AND (p_uf IS NULL OR e.uf = upper(p_uf))
    AND (p_municipio IS NULL OR e.municipio ILIKE '%' || p_municipio || '%')
    AND (1 - (e.embedding <=> p_embedding)) >= p_similaridade_min
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_limite;
$function$;

GRANT EXECUTE ON FUNCTION public.historico_orgao_semantico(vector, text, date, integer, real, text, text, date)
  TO authenticated, service_role;
