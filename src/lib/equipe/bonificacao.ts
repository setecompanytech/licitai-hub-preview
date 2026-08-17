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

/**
 * Quando a bonificação se torna PAGÁVEL — política da empresa, não do sistema.
 *
 * Cada empresa remunera de um jeito: há quem pague ao ganhar o contrato, quem
 * pague ao faturar e quem só pague depois que o cliente quita a nota. Fixar um
 * desses no código transformaria a política comercial de um cliente em regra
 * de todos — foi o que uma primeira versão desta trava fez, exigindo quitação
 * de todo mundo.
 *
 * Distinto de `tipo_comissao`, que diz a BASE do cálculo. Uma empresa pode
 * calcular sobre o valor do contrato e só liberar o pagamento na quitação.
 */
export const EVENTOS_PAGAMENTO = {
  contrato_assinado: {
    label: 'Ao ganhar o contrato',
    desc: 'Bonificação liberada com o contrato assinado, antes do faturamento',
    exigencia: 'contrato assinado',
  },
  nota_emitida: {
    label: 'Ao faturar (nota emitida)',
    desc: 'Bonificação liberada quando a nota é emitida, mesmo antes de o cliente pagar',
    exigencia: 'nota emitida',
  },
  nf_quitada: {
    label: 'Ao receber (NF-e quitada)',
    desc: 'Bonificação liberada só depois que o cliente quita a nota',
    exigencia: 'NF-e quitada',
  },
} as const;

export type EventoPagamento = keyof typeof EVENTOS_PAGAMENTO;

/**
 * Evento padrão de um tipo de cálculo, para configuração antiga que nunca o
 * declarou: acompanha o marco que o próprio tipo já pressupõe.
 */
export const eventoPadraoDoTipo = (tipo: string | null | undefined): EventoPagamento => {
  const t = String(tipo ?? '');
  if (t === 'percentual_nf_quitada' || t === 'nota_fiscal') return 'nf_quitada';
  if (t === 'percentual_faturamento') return 'nota_emitida';
  return 'contrato_assinado';
};

export const eventoDaConfig = (cfg: { evento_pagamento?: string | null; tipo_comissao?: string | null } | null | undefined): EventoPagamento =>
  (cfg?.evento_pagamento as EventoPagamento) || eventoPadraoDoTipo(cfg?.tipo_comissao);
