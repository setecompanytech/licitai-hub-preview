/**
 * Movimentação patrimonial não é resultado.
 *
 * Transferência entre contas próprias, aplicação e resgate, aporte de sócio,
 * distribuição de lucro, compra de imobilizado: tudo isso mexe no CAIXA e não
 * é receita nem despesa. O DRE (`montarDRE`, dre.ts) e a margem sugerida já
 * excluem por esta régua; os painéis do Financeiro não — olhavam só a
 * `natureza` da LINHA, que nasce do tipo (`a_pagar` → despesa, `a_receber` →
 * receita), e em setembro/2026 (ETHOS) somaram R$ 133 mil de transferência
 * entre contas próprias como receita E como despesa: o resultado fechou por
 * coincidência (as duas pernas caíram no mesmo mês), mas a receita saiu 3,6×
 * maior, a margem −86% em vez de −308%, e o "Top 5 despesas" abriu com
 * "Transferências Recebidas Entre Contas" (R$ 7,26 mi).
 *
 * As marcações existem em três lugares e nem sempre concordam — por isso a
 * régua olha os três: o tipo do lançamento, a natureza da linha e a categoria
 * (natureza e grupo do DRE).
 */
export type ClassificavelPorCategoria = {
  tipo?: string | null;
  natureza?: string | null;
  categoria?: { natureza?: string | null; grupo_dre?: string | null } | null;
};

export function ehMovimentacao(l: ClassificavelPorCategoria): boolean {
  if (l.tipo === 'transferencia') return true;
  if (l.natureza === 'movimentacao') return true;
  const c = l.categoria;
  return c?.natureza === 'movimentacao' || c?.grupo_dre === 'movimentacao';
}

/** Sinal econômico da linha: receita soma, despesa subtrai, movimentação não conta. */
export function sinalEconomico(l: ClassificavelPorCategoria): 1 | -1 | 0 {
  if (ehMovimentacao(l)) return 0;
  if (l.natureza === 'receita') return 1;
  if (l.natureza === 'despesa') return -1;
  return 0;
}
