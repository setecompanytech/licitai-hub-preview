import { describe, it, expect } from 'vitest';
import { lucroDoLote, ratearCustoDoLote } from '../custo-do-lote';

describe('custo do lote', () => {
  it('reparte na proporção do valor faturado e fecha o centavo na última parte', () => {
    const partes = [{ id: 'a', valor_total: 1008, quantidade: 200 }, { id: 'b', valor_total: 525, quantidade: 100 }, { id: 'c', valor_total: 220, quantidade: 100 }];
    const r = ratearCustoDoLote(partes, 1000);
    expect(r.reduce((s, x) => s + x.custo_total, 0)).toBeCloseTo(1000, 2);
    expect(r[0].custo_total).toBe(575.01); // 1000 × 1008/1753
    expect(r[0].custo_unitario).toBe(2.8751);
    expect(r[1].custo_total).toBe(299.49);
    expect(r[2].custo_total).toBe(125.5);
  });
  it('lucro bruto, margem e por cesta', () => {
    const l = lucroDoLote(17283, 12000, 100);
    expect(l).toEqual({ faturado: 17283, custo: 12000, lucroBruto: 5283, margemPct: 30.57, porUnidade: { faturado: 172.83, custo: 120, lucro: 52.83 } });
    expect(lucroDoLote(0, 0).margemPct).toBeNull();
  });
});
