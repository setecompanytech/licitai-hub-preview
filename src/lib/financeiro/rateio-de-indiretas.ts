/**
 * A base do rateio de despesas indiretas — a mesma régua de
 * `public.despesas_indiretas_da_empresa` (migration 20260923000002).
 *
 * Decisão do dono (22/09/2026, auditoria do 068/2025): só despesa OPERACIONAL
 * rateia entre contratos. CAPEX é ativo, despesa financeira é resultado
 * financeiro, CMV sem vínculo é custo direto que falta atribuir, movimentação
 * não é despesa. Categoria sem grupo de natureza despesa continua entrando
 * (classificação que falta, não dinheiro que sobra); lançamento sem
 * categoria também. Os dois aparecem nomeados no detalhe do contrato.
 */
export type CategoriaParaRateio = { grupo_dre?: string | null; natureza?: string | null } | null | undefined;

export function categoriaEntraNoRateio(c: CategoriaParaRateio): boolean {
  if (!c) return true;
  if (c.grupo_dre === 'desp_operacional') return true;
  return c.grupo_dre == null && (c.natureza ?? 'despesa') === 'despesa';
}

export const ROTULO_BASE_DO_RATEIO = 'despesas operacionais sem vínculo de contrato';
