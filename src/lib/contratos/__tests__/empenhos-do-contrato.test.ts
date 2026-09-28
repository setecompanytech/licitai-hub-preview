import { describe, it, expect } from 'vitest';
import { detalheDosEmpenhos, resumoDosEmpenhos } from '../empenhos-do-contrato';

describe('soma dos empenhos do contrato', () => {
  it('soma o vigente dos não cancelados e mede a cobertura do valor global', () => {
    const r = resumoDosEmpenhos([{ vigente: 17283, cancelado: false }, { vigente: 17283, cancelado: false }, { vigente: 72036, cancelado: false }, { vigente: 5000, cancelado: true }], 1736787.96);
    expect(r).toMatchObject({ quantidade: 4, ativos: 3, cancelados: 1, empenhado: 106602, cobertura: 6.1, excesso: 0 });
    expect(r.aEmpenhar).toBeCloseTo(1630185.96, 2);
    expect(detalheDosEmpenhos(r)).toBe('3 empenho(s) vigente(s), 1 cancelado(s) · 6,1% do valor global · a empenhar R$ 1.630.185,96');
  });
  it('sem valor global não inventa cobertura; empenhado acima do global vira excesso', () => {
    expect(resumoDosEmpenhos([{ vigente: 100, cancelado: false }], null)).toMatchObject({ empenhado: 100, cobertura: null, aEmpenhar: null, excesso: 0 });
    const r = resumoDosEmpenhos([{ vigente: 1200, cancelado: false }], 1000);
    expect(r).toMatchObject({ cobertura: 120, aEmpenhar: 0, excesso: 200 });
    expect(detalheDosEmpenhos(r)).toContain('R$ 200,00 ACIMA do valor global');
    expect(resumoDosEmpenhos([], 1000)).toMatchObject({ quantidade: 0, empenhado: 0, cobertura: 0, aEmpenhar: 1000 });
  });
});
