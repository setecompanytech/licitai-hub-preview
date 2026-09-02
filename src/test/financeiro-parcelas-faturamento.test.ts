import { describe, it, expect } from 'vitest';

/**
 * A regra da última parcela e do dia grampeado — C5 da auditoria de 02/09.
 * A aritmética aqui espelha FinPedidosAFaturar.handleFaturar; se um dia ela
 * for extraída para lib, este teste muda de import e continua valendo.
 */
const serie = (total: number, n: number) => {
  const parcela = Math.round((total / n) * 100) / 100;
  const ultima = +(total - parcela * (n - 1)).toFixed(2);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? ultima : parcela));
};

describe('parcelas de faturamento', () => {
  it('10.000 em 3× fecha ao centavo (a última leva a sobra)', () => {
    const v = serie(10000, 3);
    expect(v).toEqual([3333.33, 3333.33, 3333.34]);
    expect(+v.reduce((s, x) => s + x, 0).toFixed(2)).toBe(10000);
  });
  it('100.000 em 7× fecha ao centavo', () => {
    const v = serie(100000, 7);
    expect(+v.reduce((s, x) => s + x, 0).toFixed(2)).toBe(100000);
  });
  it('dia 31 grampeia no fim de fevereiro em vez de estourar para março', () => {
    const hoje = new Date(2026, 0, 31, 12); // 31/jan
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1, 12);
    const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    alvo.setDate(Math.min(hoje.getDate(), ultimoDia));
    expect(alvo.getMonth()).toBe(1);   // fevereiro
    expect(alvo.getDate()).toBe(28);   // 2026 não é bissexto
  });
});

describe('rateio por centro de custo (A11)', () => {
  const ratear = (valorBase: number, percentuais: number[]) => {
    let acumulado = 0;
    return percentuais.map((p, i) => {
      const ultimo = i === percentuais.length - 1;
      const fatia = ultimo
        ? +(valorBase - acumulado).toFixed(2)
        : Math.round(((p / 100) * valorBase) * 100) / 100;
      acumulado += fatia;
      return fatia;
    });
  };
  it('R$ 0,05 em 3 fatias de ~33% fecha em 0,05 (não 0,06)', () => {
    const v = ratear(0.05, [33.33, 33.33, 33.34]);
    expect(+v.reduce((s, x) => s + x, 0).toFixed(2)).toBe(0.05);
  });
  it('R$ 1.000,00 em 3× iguais fecha ao centavo', () => {
    const v = ratear(1000, [33.33, 33.33, 33.34]);
    expect(+v.reduce((s, x) => s + x, 0).toFixed(2)).toBe(1000);
  });
});
