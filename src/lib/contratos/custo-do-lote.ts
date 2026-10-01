/**
 * Custo do lote (30/09/2026): o custo informado para a nota inteira é
 * repartido entre as partes na proporção do valor faturado de cada uma; a
 * última parte fecha o centavo. O lucro mostrado aqui é BRUTO — só a compra:
 * impostos, despesas administrativas, operacionais (logística, frete, mão de
 * obra indireta) e BDI entram em Financeiro › Custo por contrato. Puro.
 */
export type ParteParaCusto = { id: string; valor_total: number; quantidade: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function ratearCustoDoLote(partes: ParteParaCusto[], custoTotal: number): Array<{ id: string; custo_total: number; custo_unitario: number }> {
  const total = r2(Number(custoTotal) || 0);
  const base = partes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
  let restante = total;
  return partes.map((p, i) => {
    const ultima = i === partes.length - 1;
    const fatia = ultima ? restante : (base > 0 ? r2((total * (Number(p.valor_total) || 0)) / base) : r2(total / partes.length));
    restante = r2(restante - fatia);
    const qtd = Number(p.quantidade) || 0;
    return { id: p.id, custo_total: fatia, custo_unitario: qtd > 0 ? r4(fatia / qtd) : 0 };
  });
}

export type LucroDoLote = { faturado: number; custo: number; lucroBruto: number; margemPct: number | null; porUnidade: { faturado: number; custo: number; lucro: number } | null };

export function lucroDoLote(faturado: number, custo: number, unidades?: number | null): LucroDoLote {
  const f = r2(Number(faturado) || 0); const c = r2(Number(custo) || 0);
  const lucro = r2(f - c);
  const n = Number(unidades) || 0;
  return {
    faturado: f, custo: c, lucroBruto: lucro,
    margemPct: f > 0 ? r2((lucro / f) * 100) : null,
    porUnidade: n > 0 ? { faturado: r2(f / n), custo: r2(c / n), lucro: r2(lucro / n) } : null,
  };
}

/** O que ainda não está no lucro bruto — a frase discreta da caixa. */
export const AVISO_LUCRO_BRUTO = 'Lucro bruto: só o custo da compra. Impostos, despesas administrativas, operacionais (logística, frete, mão de obra indireta) e BDI entram em Financeiro › Custo por contrato.';

/** Os tipos de ajuste manual do custo por contrato (Financeiro). */
export const TIPOS_DE_AJUSTE = [
  { valor: 'imposto', rotulo: 'Imposto / tributo' },
  { valor: 'administrativa', rotulo: 'Despesa administrativa' },
  { valor: 'operacional', rotulo: 'Operacional — logística, frete, mão de obra indireta' },
  { valor: 'bdi', rotulo: 'BDI — benefícios e despesas indiretas' },
  { valor: 'outra', rotulo: 'Outra despesa' },
] as const;
export type TipoDeAjuste = (typeof TIPOS_DE_AJUSTE)[number]['valor'];
