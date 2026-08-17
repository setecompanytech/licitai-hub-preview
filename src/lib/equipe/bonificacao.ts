/**
 * Vocabulário dos tipos de bonificação — autoridade única.
 *
 * Cada tela decidia por conta se um tipo era percentual ou valor fixo, com
 * comparações soltas: uma checava `=== 'percentual'` (string que não existe em
 * nenhum registro, então TODA bonificação automática caía no valor fixo), outra
 * checava `=== 'valor_fixo'` e tratava "por nota fiscal" — que é fixo — como
 * percentual. Mesma disciplina do vocabulário de status.
 */

export const TIPOS_BONIFICACAO = {
  percentual_contrato: { label: '% sobre Contrato', desc: 'Percentual sobre o valor total do contrato' },
  percentual_lucro: { label: '% sobre Lucro', desc: 'Percentual sobre o lucro líquido' },
  percentual_faturamento: { label: '% sobre Faturamento', desc: 'Percentual sobre o valor faturado (nota emitida)' },
  percentual_nf_quitada: { label: '% sobre NF-e quitada', desc: 'Percentual sobre o valor efetivamente recebido' },
  valor_fixo: { label: 'Valor Fixo', desc: 'Valor fixo por licitação ganha' },
  nota_fiscal: { label: 'Valor fixo por Nota Fiscal', desc: 'Valor fixo a cada nota fiscal quitada' },
} as const;

export type TipoBonificacao = keyof typeof TIPOS_BONIFICACAO;

/** Percentual sobre uma base, em oposição a um valor fixo por evento. */
export const ehPercentual = (tipo: string | null | undefined): boolean =>
  String(tipo ?? '').startsWith('percentual');

/** Rótulo do valor configurado, para as telas exibirem sem repetir a regra. */
export const rotuloDoValor = (
  tipo: string | null | undefined,
  percentual: number,
  valorFixo: number,
  formatarMoeda: (v: number) => string,
): string => (ehPercentual(tipo) ? `${percentual}%` : formatarMoeda(valorFixo));
