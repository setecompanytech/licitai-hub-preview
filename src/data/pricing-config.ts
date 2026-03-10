/**
 * Configuração unificada de ciclos de faturamento e descontos.
 * Usada tanto na landing (PlanosSection) quanto nas configurações (PlanoAssinatura).
 */

export type BillingCycle = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export const cycleConfig: Record<BillingCycle, { label: string; months: number; discount: number; badge?: string }> = {
  mensal:     { label: 'Mensal',     months: 1,  discount: 0 },
  trimestral: { label: 'Trimestral', months: 3,  discount: 0.10, badge: '10% OFF' },
  semestral:  { label: 'Semestral',  months: 6,  discount: 0.15, badge: '15% OFF' },
  anual:      { label: 'Anual',      months: 12, discount: 0.20, badge: '20% OFF' },
};

export const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Calcula o valor total do ciclo com desconto aplicado.
 */
export function calcCycleTotal(precoMensal: number, cycle: BillingCycle): number {
  const cfg = cycleConfig[cycle];
  return precoMensal * cfg.months * (1 - cfg.discount);
}

/**
 * Calcula o valor mensal equivalente com desconto.
 */
export function calcMonthlyEquivalent(precoMensal: number, cycle: BillingCycle): number {
  const cfg = cycleConfig[cycle];
  return precoMensal * (1 - cfg.discount);
}
