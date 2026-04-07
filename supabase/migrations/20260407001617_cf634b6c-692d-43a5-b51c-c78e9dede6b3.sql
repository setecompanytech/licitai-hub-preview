-- =============================================
-- BUSCA INSTANTÂNEA: TSVECTOR + ÍNDICES + RPC
-- =============================================

-- 1. Coluna TSVECTOR para FTS nativo em português
ALTER TABLE public.pncp_editais_cache
  ADD COLUMN IF NOT EXISTS objeto_tsv TSVECTOR;

-- 2. Trigger para atualizar objeto_tsv automaticamente
CREATE OR REPLACE FUNCTION public.atualizar_objeto_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.objeto_tsv := to_tsvector('portuguese',
    COALESCE(NEW.objeto, '') || ' ' ||
    COALESCE(NEW.orgao, '') || ' ' ||
    COALESCE(NEW.unidade_orgao, '') || ' ' ||
    COALESCE(NEW.numero_compra, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_objeto_tsv ON public.pncp_editais_cache;
CREATE TRIGGER trigger_objeto_tsv
  BEFORE INSERT OR UPDATE ON public.pncp_editais_cache
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_objeto_tsv();

-- 3. Preencher TSV nos registros existentes
UPDATE public.pncp_editais_cache
SET objeto_tsv = to_tsvector('portuguese',
  COALESCE(objeto, '') || ' ' ||
  COALESCE(orgao, '') || ' ' ||
  COALESCE(unidade_orgao, '') || ' ' ||
  COALESCE(numero_compra, '')
)
WHERE objeto_tsv IS NULL;

-- 4. Índices compostos para busca instantânea
CREATE INDEX IF NOT EXISTS idx_pncp_cache_fts
  ON public.pncp_editais_cache USING GIN(objeto_tsv);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_filtros_compostos
  ON public.pncp_editais_cache (uf, modalidade_id, data_publicacao_pncp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_esfera
  ON public.pncp_editais_cache (esfera_id, uf, data_publicacao_pncp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_municipio_ibge
  ON public.pncp_editais_cache (municipio_ibge, data_publicacao_pncp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_pncp_cache_abertura
  ON public.pncp_editais_cache (data_abertura_proposta DESC NULLS LAST);

-- 5. Função RPC: busca_editais_instantanea
CREATE OR REPLACE FUNCTION public.busca_editais_instantanea(
  p_q                  TEXT     DEFAULT NULL,
  p_uf                 TEXT     DEFAULT NULL,
  p_municipio_ibge     TEXT     DEFAULT NULL,
  p_esfera             TEXT     DEFAULT NULL,
  p_modalidade_id      INTEGER  DEFAULT NULL,
  p_segmento           TEXT     DEFAULT NULL,
  p_data_inicio        DATE     DEFAULT NULL,
  p_data_fim           DATE     DEFAULT NULL,
  p_ordenacao          TEXT     DEFAULT 'data_publicacao',
  p_direcao            TEXT     DEFAULT 'desc',
  p_pagina             INTEGER  DEFAULT 1,
  p_tamanho            INTEGER  DEFAULT 20
)
RETURNS TABLE (
  id                     UUID,
  pncp_id                TEXT,
  numero_controle_pncp   TEXT,
  cnpj_orgao             TEXT,
  ano_compra             TEXT,
  sequencial_compra      TEXT,
  numero_compra          TEXT,
  orgao                  TEXT,
  unidade_orgao          TEXT,
  objeto                 TEXT,
  modalidade_id          INTEGER,
  modalidade_nome        TEXT,
  situacao               TEXT,
  valor_total_estimado   NUMERIC,
  uf                     TEXT,
  municipio              TEXT,
  municipio_ibge         TEXT,
  esfera_id              TEXT,
  data_publicacao_pncp   TIMESTAMPTZ,
  data_abertura_proposta TIMESTAMPTZ,
  data_encerramento_proposta TIMESTAMPTZ,
  link_sistema_origem    TEXT,
  url_pncp               TEXT,
  tipo_instrumento       TEXT,
  srp                    BOOLEAN,
  fonte                  TEXT,
  link_comprasnet        TEXT,
  lei_base               TEXT,
  total_count            BIGINT,
  rank_busca             REAL
) AS $$
DECLARE
  v_offset INTEGER := (p_pagina - 1) * p_tamanho;
BEGIN
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
      CASE WHEN p_q IS NOT NULL AND p_q != ''
        THEN ts_rank(e.objeto_tsv, plainto_tsquery('portuguese', p_q))
        ELSE 0.0
      END AS rank_busca
    FROM public.pncp_editais_cache e
    WHERE
      (p_q IS NULL OR p_q = ''
        OR e.objeto_tsv @@ plainto_tsquery('portuguese', p_q)
        OR e.orgao ILIKE '%' || p_q || '%')
      AND (p_uf IS NULL OR p_uf = '' OR e.uf = p_uf)
      AND (p_municipio_ibge IS NULL OR p_municipio_ibge = '' OR e.municipio_ibge = p_municipio_ibge)
      AND (p_esfera IS NULL OR p_esfera = '' OR e.esfera_id = p_esfera)
      AND (p_modalidade_id IS NULL OR p_modalidade_id = 0 OR e.modalidade_id = p_modalidade_id)
      AND (p_data_inicio IS NULL OR e.data_publicacao_pncp >= p_data_inicio)
      AND (p_data_fim IS NULL OR e.data_publicacao_pncp <= p_data_fim + INTERVAL '1 day')
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
$$ LANGUAGE plpgsql STABLE;