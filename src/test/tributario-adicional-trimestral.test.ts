import { describe, it, expect } from 'vitest';
import { calcularPresumido, type ParametrosPresumido } from '@/lib/financeiro/simples-nacional-2026';

/**
 * C1 da auditoria: o adicional de IRPJ do Presumido é TRIMESTRAL (Lei
 * 9.430/96, arts. 1º e 25) — 10% sobre o que exceder R$ 60.000 no trimestre.
 * A forma incremental garante: a soma dos 3 meses fecha exatamente o valor
 * trimestral, em qualquer distribuição de receita.
 */
const base = (receitaServico: number, pos: number, baseAnterior: number): ParametrosPresumido => ({
  receitaComercio: 0,
  receitaServico,
  presuncaoIrpjComercio: 8,
  presuncaoIrpjServico: 32,
  presuncaoCsllComercio: 12,
  presuncaoCsllServico: 32,
  aliquotaIrpj: 15,
  adicionalIrpj: 10,
  limiteAdicionalIrpj: 20000,
  aliquotaCsll: 9,
  aliquotaPis: 0.65,
  aliquotaCofins: 3,
  aliquotaIss: 5,
  aliquotaIcms: 0,
  posicaoNoTrimestre: pos,
  baseIrpjMesesAnterioresTrimestre: baseAnterior,
});

/** Roda o trimestre mês a mês e devolve os adicionais e a soma. */
const trimestre = (receitas: [number, number, number]) => {
  let acumBase = 0;
  const adicionais: number[] = [];
  receitas.forEach((r, i) => {
    const res = calcularPresumido(base(r, i + 1, acumBase));
    adicionais.push(res.adicionalIrpj);
    acumBase += res.baseIrpj;
  });
  const soma = +adicionais.reduce((s, x) => s + x, 0).toFixed(2);
  return { adicionais, soma };
};

describe('adicional de IRPJ trimestral (Presumido, serviços 32%)', () => {
  it('o exemplo da auditoria: bases 0/0/60k de IRPJ → adicional zero', () => {
    // receita de serviços 187.500 → base 60.000 no 3º mês
    const { soma } = trimestre([0, 0, 187500]);
    expect(soma).toBe(0);
  });
  it('receita concentrada no 1º mês compensa nos seguintes e fecha exato', () => {
    const { adicionais, soma } = trimestre([187500, 0, 0]);
    expect(adicionais[0]).toBeCloseTo(4000, 2);   // estimativa do mês 1
    expect(soma).toBe(0);                          // trimestre fecha na lei
  });
  it('receita uniforme acima do limite: 10% sobre o excedente trimestral', () => {
    // 93.750/mês → base 30.000/mês → trimestre 90.000 → adicional 3.000
    const { adicionais, soma } = trimestre([93750, 93750, 93750]);
    adicionais.forEach((a) => expect(a).toBeCloseTo(1000, 2));
    expect(soma).toBeCloseTo(3000, 2);
  });
  it('sem contexto de trimestre, comporta-se como mês isolado (retrocompatível)', () => {
    const r = calcularPresumido({ ...base(187500, 1, 0), posicaoNoTrimestre: undefined, baseIrpjMesesAnterioresTrimestre: undefined });
    expect(r.adicionalIrpj).toBeCloseTo(4000, 2);
  });
});
