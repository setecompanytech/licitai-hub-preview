import { describe, it, expect } from 'vitest';
import { indicesMaisRecentes, ordemDoPeriodo } from '../mais-recentes';

describe('um índice por sigla', () => {
  it('ordena "mmm/aaaa" e fica com o mês mais novo de cada sigla', () => {
    expect(ordemDoPeriodo('ago/2026')).toBeGreaterThan(ordemDoPeriodo('jul/2026'));
    expect(ordemDoPeriodo('jan/2027')).toBeGreaterThan(ordemDoPeriodo('dez/2026'));
    expect(ordemDoPeriodo('sem data')).toBe(0);
    const r = indicesMaisRecentes([
      { sigla: 'INPC', periodo: 'jul/2026', v: 1 }, { sigla: 'INPC', periodo: 'ago/2026', v: 2 },
      { sigla: 'IPCA', periodo: 'ago/2026', v: 3 }, { sigla: 'SELIC', periodo: 'nov/2026', v: 4 }, { sigla: 'SELIC', periodo: 'set/2026', v: 5 },
    ]);
    expect(r.map((i) => `${i.sigla}:${i.v}`)).toEqual(['INPC:2', 'IPCA:3', 'SELIC:4']);
  });
});
