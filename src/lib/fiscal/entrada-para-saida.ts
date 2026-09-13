import type { NFeItemData } from '@/lib/parseNFe';

/**
 * A fronteira entre o que a saída HERDA da entrada e o que ela não pode herdar.
 *
 * A regra é do dono do produto (13/09/2026) e está escrita por extenso em
 * `docs/nfe-entrada-e-produtos.md`. Em uma frase: o que descreve a MERCADORIA
 * atravessa a operação; o que descreve a OPERAÇÃO DO FORNECEDOR, não.
 *
 * O sistema fazia o contrário, e a cadeia inteira do erro cabe em duas linhas:
 *
 *   GestaoCompras   → grava `produtos.cfop` com o CFOP da nota de ENTRADA
 *   FinPedidosAFaturar → lê `produtos.cfop` para pré-preencher a SAÍDA
 *
 * Ou seja: comprava com 1.102 e vendia com 1.102. CFOP de entrada começa com 1
 * ou 2; o de saída, com 5 ou 6 — **nunca** são iguais, e a SEFAZ rejeita (733).
 * O mesmo valia para CST/CSOSN e alíquotas: são do regime de QUEM VENDEU para
 * a gente, e comprar de um Simples não torna a nossa saída Simples.
 *
 * Este módulo existe para que a fronteira tenha um dono. Antes ela estava
 * implícita em dois arquivos distantes, e nenhum dos dois a mencionava.
 */

/** O que a mercadoria é — atravessa a operação e vive na ficha do produto. */
export interface FichaDaMercadoria {
  /** 8 dígitos, idêntico na entrada e na saída. */
  ncm?: string;
  /** Só quando o produto está sujeito a substituição tributária. */
  cest?: string;
  /** Código de barras — não muda. */
  codigo_ean?: string;
  /** Primeiro dígito do CST/CSOSN: 0 nacional, 1 importado direto, 2 importado do mercado interno… */
  origem_mercadoria?: string;
  /** Unidade da COMPRA. Pode ser adaptada na venda (caixa → unidade). */
  unidade?: string;
}

/**
 * Extrai da linha da nota de entrada só o que pertence à mercadoria.
 *
 * O que fica de fora, deliberadamente: `cfop`, `cst_icms`, `csosn`, `cst_pis`,
 * `cst_cofins`, `p_icms`, `p_pis`, `p_cofins` — todos descrevem a operação do
 * fornecedor. E `c_prod`, que é o código do item no sistema DELE: usá-lo como
 * `produtos.codigo` quebra a numeração própria e colide entre fornecedores que
 * usem o mesmo código para coisas diferentes.
 */
export function fichaDaMercadoria(item: NFeItemData): FichaDaMercadoria {
  const limpo = (v?: string) => {
    const t = (v ?? '').trim();
    return t.length > 0 ? t : undefined;
  };
  return {
    ncm: limpo(item.ncm),
    cest: limpo(item.cest),
    // "SEM GTIN" é o preenchimento que a SEFAZ exige quando o item não tem
    // código de barras. Gravá-lo como se fosse um EAN faria a saída transmitir
    // a string literal no lugar do código.
    codigo_ean: limpo(item.c_ean)?.toUpperCase() === 'SEM GTIN' ? undefined : limpo(item.c_ean),
    origem_mercadoria: limpo(item.orig),
    unidade: limpo(item.u_com),
  };
}

/**
 * Campos da entrada que NÃO podem alimentar a saída. Existe para ser lido por
 * quem for mexer no fluxo, e para o teste apontar quando alguém reintroduzir
 * um deles.
 */
export const NAO_HERDA_DA_ENTRADA = [
  'cfop',
  'cst_icms',
  'csosn',
  'cst_pis',
  'cst_cofins',
  'p_icms',
  'p_pis',
  'p_cofins',
] as const;

/**
 * Completa a ficha sem sobrescrever o que já existe.
 *
 * Cadastro tem dono: quem digitou o NCM à mão conferiu numa tabela. Uma nota do
 * fornecedor não é autoridade maior que essa conferência — ela só preenche
 * lacuna. O retorno é `null` quando não há nada a preencher, para a chamada
 * poder pular o UPDATE em vez de gravar um objeto vazio.
 */
export function completarFicha(
  atual: Record<string, unknown>,
  daNota: FichaDaMercadoria,
): Partial<FichaDaMercadoria> | null {
  const falta: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(daNota)) {
    if (!valor) continue;
    const jaTem = atual[campo];
    if (jaTem === null || jaTem === undefined || String(jaTem).trim() === '') {
      falta[campo] = valor;
    }
  }
  return Object.keys(falta).length > 0 ? falta : null;
}
