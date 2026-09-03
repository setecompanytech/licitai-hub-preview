-- ═══════════════════════════════════════════════════════════════════════════
-- Histórico do órgão — a consulta da recorrência (Fase 1 do estudo de 03/09)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "Este órgão já licitou objeto similar?" — a pergunta que nenhuma tela fazia.
-- A busca semântica existente (busca_editais_semantica) não filtra por CNPJ
-- nem por período, e ignora processos encerrados — que são exatamente o que a
-- recorrência procura: o ciclo do ano anterior.
--
-- O casamento é pela DESCRIÇÃO DO OBJETO (embedding), nunca por marca: o PNCP
-- em regra não registra marca na listagem, e a descrição é o campo fiel —
-- decisão do dono, 03/09/2026.

CREATE OR REPLACE FUNCTION public.historico_orgao_semantico(
  p_embedding extensions.vector(1536),
  p_cnpj text DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_limite integer DEFAULT 12,
  p_similaridade_min real DEFAULT 0.25
)
RETURNS TABLE (
  id uuid,
  pncp_id text,
  numero_controle_pncp text,
  cnpj_orgao text,
  orgao text,
  objeto text,
  modalidade_nome text,
  uf text,
  municipio text,
  valor_total_estimado numeric,
  data_publicacao_pncp timestamptz,
  numero_compra text,
  ano_compra text,
  sequencial_compra text,
  url_pncp text,
  similaridade real
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
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
    AND (1 - (e.embedding <=> p_embedding)) >= p_similaridade_min
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_limite;
$$;
