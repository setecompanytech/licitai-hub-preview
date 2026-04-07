export interface PNCPCompraParams {
  cnpj: string;
  ano: number;
  sequencial: number;
  numeroCompra: string;
}

/**
 * Parses a PNCP numero_controle string.
 * Format: {CNPJ_14_DIGITS}-{SEQUENCIAL}-{NUMERO_COMPRA}/{ANO}
 * Example: 04892407000134-1-000099017/2026
 */
export function parsePNCPNumeroControle(numeroControle: string): PNCPCompraParams | null {
  if (!numeroControle) return null;

  const cleaned = numeroControle.replace(/\s/g, '');
  const regex = /^(\d{14})-(\d+)-(\d+)\/(\d{4})$/;
  const match = cleaned.match(regex);

  if (!match) return null;

  return {
    cnpj: match[1],
    sequencial: parseInt(match[2]),
    numeroCompra: match[3],
    ano: parseInt(match[4]),
  };
}

export function buildPNCPItensUrl(params: PNCPCompraParams, pagina = 1): string {
  return `https://pncp.gov.br/api/consulta/v1/orgaos/${params.cnpj}/compras/${params.ano}/${params.sequencial}/itens?pagina=${pagina}&tamanhoPagina=500`;
}

export function buildPNCPArquivosUrl(params: PNCPCompraParams): string {
  return `https://pncp.gov.br/api/consulta/v1/orgaos/${params.cnpj}/compras/${params.ano}/${params.sequencial}/arquivos?pagina=1&tamanhoPagina=20`;
}
