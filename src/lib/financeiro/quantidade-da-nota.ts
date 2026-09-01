/**
 * A quantidade lida da nota só vale se fizer sentido aritmético.
 *
 * O caso (01/09): DANFE com QTDE. 1.300,00 × R$ 22,55 = R$ 29.315,00. A IA
 * leu "quantidade_total" como "quantidade de ITENS da nota" — uma linha de
 * produto — e devolveu 1. O seletor obedeceu: quantidade 1, VU R$ 29.315,00.
 * Aritmética perfeita sobre leitura absurda.
 *
 * A defesa não é confiar mais na IA — é conferir a leitura contra o que já se
 * sabe: se o VU implícito (valor ÷ quantidade lida) está a mais de 5× ou
 * menos de ⅕ do preço de referência do contrato, a quantidade lida é lixo e
 * volta-se à derivação. O fator 5 é largo de propósito: reajuste, desconto e
 * troca de embalagem cabem; um erro de 1.300× não.
 */
export function quantidadeConfiavel(fontes: {
  /** O que a leitura devolveu como quantidade total da nota. */
  qtdLida: number | null | undefined;
  /** O valor total do documento. */
  valorTotal: number | null | undefined;
  /** O preço unitário de referência (item do contrato), quando existe. */
  vuReferencia: number | null | undefined;
}): number | null {
  const qtd = Number(fontes.qtdLida) || 0;
  const valor = Number(fontes.valorTotal) || 0;
  const vuRef = Number(fontes.vuReferencia) || 0;

  if (qtd <= 0) return null;
  // Sem valor ou sem referência não há contra o que conferir — a leitura vale
  // como veio. Melhor uma quantidade possivelmente errada e VISÍVEL no campo
  // do que descartar leitura sem motivo.
  if (valor <= 0 || vuRef <= 0) return qtd;

  const vuImplicito = valor / qtd;
  const razao = vuImplicito / vuRef;
  if (razao > 5 || razao < 0.2) return null;

  return qtd;
}
