// Mapeamento contratação PNCP → linha do acervo (pncp_editais_cache).
// Vivia dentro de busca-licitacoes; a semeadura do acervo precisa do MESMO
// mapa, e duas cópias divergem no primeiro campo novo (princípio nº 1).

export const MODALIDADES: Record<number, string> = {
  1: 'Leilão - Eletrônico',
  2: 'Diálogo Competitivo',
  3: 'Concurso',
  4: 'Concorrência - Eletrônica',
  5: 'Concorrência - Presencial',
  6: 'Pregão - Eletrônico',
  7: 'Pregão - Presencial',
  8: 'Dispensa de Licitação',
  9: 'Inexigibilidade',
  10: 'Manifestação de Interesse',
  11: 'Pré-qualificação',
  12: 'Credenciamento',
  13: 'Leilão - Presencial',
};

export function mapRawParaCache(raw: Record<string, unknown>): Record<string, unknown> | null {
  const orgao = (raw.orgaoEntidade as Record<string, unknown>) || {};
  const unidade = (raw.unidadeOrgao as Record<string, unknown>) || {};
  const numeroControle = (raw.numeroControlePNCP as string) || null;
  if (!numeroControle) return null;
  return {
    pncp_id: numeroControle,
    fonte: 'PNCP',
    fonte_id: numeroControle,
    numero_controle_pncp: numeroControle,
    cnpj_orgao: (orgao.cnpj as string) || null,
    ano_compra: raw.anoCompra ? String(raw.anoCompra) : null,
    sequencial_compra: raw.sequencialCompra ? String(raw.sequencialCompra) : null,
    numero_compra: (raw.numeroCompra as string) || null,
    orgao: (orgao.razaoSocial as string) || null,
    unidade_orgao: (unidade.nomeUnidade as string) || null,
    objeto: (raw.objetoCompra as string) || null,
    modalidade_id: Number(raw.modalidadeId) || null,
    modalidade_nome: MODALIDADES[Number(raw.modalidadeId)] || null,
    situacao: (raw.situacaoCompraNome as string) || null,
    valor_total_estimado: raw.valorTotalEstimado ? Number(raw.valorTotalEstimado) : null,
    uf: (unidade.ufSigla as string) || (unidade.ufNome as string) || null,
    municipio: (unidade.municipioNome as string) || null,
    municipio_ibge: unidade.codigoIbge ? String(unidade.codigoIbge) : null,
    esfera_id: (orgao.esferaId as string) || null,
    data_publicacao_pncp: (raw.dataPublicacaoPncp as string) || (raw.dataInclusao as string) || null,
    data_abertura_proposta: (raw.dataAberturaProposta as string) || null,
    data_encerramento_proposta: (raw.dataEncerramentoProposta as string) || null,
    link_sistema_origem: (raw.linkSistemaOrigem as string) || null,
    url_pncp: `https://pncp.gov.br/app/editais/${orgao.cnpj}/${raw.anoCompra}/${raw.sequencialCompra}`,
    tipo_instrumento: (raw.tipoInstrumentoConvocatorioNome as string) || null,
    srp: Boolean(raw.srp),
    codigo_unidade: unidade.codigoUnidade ? String(unidade.codigoUnidade) : null,
    lei_base: (raw as { amparoLegal?: { descricao?: string } }).amparoLegal?.descricao || null,
    link_comprasnet: null,
  };
}
