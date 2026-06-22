-- Atualiza busca_editais_instantanea para incluir busca por número do edital
-- (numero_compra, pncp_id, numero_controle_pncp) além de objeto e orgao.
CREATE OR REPLACE FUNCTION public.busca_editais_instantanea(
  p_q text DEFAULT NULL::text,
  p_uf text DEFAULT NULL::text,
  p_municipio_ibge text DEFAULT NULL::text,
  p_esfera text DEFAULT NULL::text,
  p_modalidade_id integer DEFAULT NULL::integer,
  p_segmento text DEFAULT NULL::text,
  p_data_inicio date DEFAULT NULL::date,
  p_data_fim date DEFAULT NULL::date,
  p_ordenacao text DEFAULT 'data_publicacao'::text,
  p_direcao text DEFAULT 'desc'::text,
  p_pagina integer DEFAULT 1,
  p_tamanho integer DEFAULT 20,
  p_fonte_orcamentaria text DEFAULT NULL::text,
  p_margem_preferencia text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid, pncp_id text, numero_controle_pncp text, cnpj_orgao text,
  ano_compra text, sequencial_compra text, numero_compra text, orgao text,
  unidade_orgao text, objeto text, modalidade_id integer, modalidade_nome text,
  situacao text, valor_total_estimado numeric, uf text, municipio text,
  municipio_ibge text, esfera_id text, data_publicacao_pncp timestamp with time zone,
  data_abertura_proposta timestamp with time zone, data_encerramento_proposta timestamp with time zone,
  link_sistema_origem text, url_pncp text, tipo_instrumento text, srp boolean,
  fonte text, link_comprasnet text, lei_base text, total_count bigint, rank_busca real
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $function$
DECLARE
  v_offset INTEGER := (p_pagina - 1) * p_tamanho;
  v_modalidade_nome_pattern TEXT;
  v_is_numero BOOLEAN;
BEGIN
  v_modalidade_nome_pattern := CASE p_modalidade_id
    WHEN 1 THEN 'Leilão%Eletrônico%'
    WHEN 2 THEN 'Diálogo%Competitivo%'
    WHEN 3 THEN 'Concurso%'
    WHEN 4 THEN 'Concorrência%Eletrônica%'
    WHEN 5 THEN 'Concorrência%Presencial%'
    WHEN 6 THEN 'Pregão%Eletrônico%'
    WHEN 7 THEN 'Pregão%Presencial%'
    WHEN 8 THEN 'Dispensa%'
    WHEN 9 THEN 'Inexigibilidade%'
    WHEN 10 THEN 'Manifestação%Interesse%'
    WHEN 11 THEN 'Pré-qualificação%'
    WHEN 12 THEN 'Credenciamento%'
    WHEN 13 THEN 'Leilão%Presencial%'
    ELSE NULL
  END;

  -- Detecta se o termo parece ser um número de edital (só dígitos e separadores)
  v_is_numero := p_q IS NOT NULL AND p_q ~ '^[\d/\-\.]+$';

  RETURN QUERY
  WITH resultados AS (
    SELECT
      e.id, e.pncp_id, e.numero_controle_pncp, e.cnpj_orgao,
      e.ano_compra, e.sequencial_compra, e.numero_compra, e.orgao,
      e.unidade_orgao, e.objeto, e.modalidade_id, e.modalidade_nome,
      e.situacao, e.valor_total_estimado, e.uf, e.municipio,
      e.municipio_ibge, e.esfera_id, e.data_publicacao_pncp,
      e.data_abertura_proposta, e.data_encerramento_proposta,
      e.link_sistema_origem, e.url_pncp, e.tipo_instrumento,
      e.srp, e.fonte, e.link_comprasnet, e.lei_base,
      COUNT(*) OVER() AS total_count,
      CASE
        WHEN p_q IS NULL OR p_q = '' THEN 0.0
        WHEN v_is_numero THEN 1.0  -- busca por número sempre prioriza match exato
        ELSE ts_rank(e.objeto_tsv, plainto_tsquery('portuguese', p_q))
      END AS rank_busca
    FROM public.pncp_editais_cache e
    WHERE
      (p_q IS NULL OR p_q = ''
        -- Busca textual no objeto e órgão
        OR (NOT v_is_numero AND (
          e.objeto_tsv @@ plainto_tsquery('portuguese', p_q)
          OR e.orgao ILIKE '%' || p_q || '%'
        ))
        -- Busca por número: numero_compra, pncp_id, numero_controle_pncp, sequencial
        OR e.numero_compra ILIKE '%' || p_q || '%'
        OR e.pncp_id ILIKE '%' || p_q || '%'
        OR e.numero_controle_pncp ILIKE '%' || p_q || '%'
        OR e.sequencial_compra = p_q
      )
      AND (p_uf IS NULL OR p_uf = '' OR e.uf = p_uf)
      AND (p_municipio_ibge IS NULL OR p_municipio_ibge = ''
        OR e.municipio_ibge = p_municipio_ibge
        OR (e.municipio_ibge IS NULL AND e.municipio ILIKE '%' || p_municipio_ibge || '%'))
      AND (p_esfera IS NULL OR p_esfera = '' OR e.esfera_id = p_esfera)
      AND (p_modalidade_id IS NULL OR p_modalidade_id = 0
        OR e.modalidade_id = p_modalidade_id
        OR (e.modalidade_id IS NULL AND v_modalidade_nome_pattern IS NOT NULL AND e.modalidade_nome ILIKE v_modalidade_nome_pattern))
      AND (p_data_inicio IS NULL OR COALESCE(e.data_abertura_proposta, e.data_publicacao_pncp) >= p_data_inicio)
      AND (p_data_fim IS NULL OR COALESCE(e.data_abertura_proposta, e.data_publicacao_pncp) <= p_data_fim + INTERVAL '1 day')
      AND (p_fonte_orcamentaria IS NULL OR p_fonte_orcamentaria = '' OR e.fonte_orcamentaria ILIKE '%' || p_fonte_orcamentaria || '%')
      AND (p_margem_preferencia IS NULL OR p_margem_preferencia = '' OR e.margem_preferencia = p_margem_preferencia)
  )
  SELECT
    r.id, r.pncp_id, r.numero_controle_pncp, r.cnpj_orgao,
    r.ano_compra, r.sequencial_compra, r.numero_compra, r.orgao,
    r.unidade_orgao, r.objeto, r.modalidade_id, r.modalidade_nome,
    r.situacao, r.valor_total_estimado, r.uf, r.municipio,
    r.municipio_ibge, r.esfera_id, r.data_publicacao_pncp,
    r.data_abertura_proposta, r.data_encerramento_proposta,
    r.link_sistema_origem, r.url_pncp, r.tipo_instrumento,
    r.srp, r.fonte, r.link_comprasnet, r.lei_base,
    r.total_count, r.rank_busca::REAL
  FROM resultados r
  ORDER BY
    CASE WHEN p_q IS NOT NULL AND p_q != ''
      THEN r.rank_busca END DESC NULLS LAST,
    CASE WHEN p_ordenacao = 'data_publicacao' AND p_direcao = 'desc'
      THEN r.data_publicacao_pncp END DESC NULLS LAST,
    CASE WHEN p_ordenacao = 'data_publicacao' AND p_direcao = 'asc'
      THEN r.data_publicacao_pncp END ASC NULLS LAST,
    CASE WHEN p_ordenacao = 'data_abertura' AND p_direcao = 'desc'
      THEN r.data_abertura_proposta END DESC NULLS LAST,
    CASE WHEN p_ordenacao = 'data_abertura' AND p_direcao = 'asc'
      THEN r.data_abertura_proposta END ASC NULLS LAST,
    CASE WHEN p_ordenacao = 'valor' AND p_direcao = 'desc'
      THEN r.valor_total_estimado END DESC NULLS LAST,
    CASE WHEN p_ordenacao = 'valor' AND p_direcao = 'asc'
      THEN r.valor_total_estimado END ASC NULLS LAST,
    r.data_publicacao_pncp DESC NULLS LAST
  LIMIT p_tamanho
  OFFSET v_offset;
END;
$function$;
