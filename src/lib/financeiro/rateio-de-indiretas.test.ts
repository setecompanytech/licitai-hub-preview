import { describe, it, expect } from 'vitest';
import { categoriaEntraNoRateio } from './rateio-de-indiretas';

describe('base do rateio de indiretas: só despesa operacional', () => {
  it('operacional entra; CAPEX, financeira, CMV e movimentação ficam fora', () => {
    expect(categoriaEntraNoRateio({ grupo_dre: 'desp_operacional', natureza: 'despesa' })).toBe(true);
    expect(categoriaEntraNoRateio({ grupo_dre: 'movimentacao', natureza: 'despesa' })).toBe(false);   // Investimentos, Veículos
    expect(categoriaEntraNoRateio({ grupo_dre: 'desp_financeira', natureza: 'despesa' })).toBe(false);
    expect(categoriaEntraNoRateio({ grupo_dre: 'cmv_cps', natureza: 'despesa' })).toBe(false);
    expect(categoriaEntraNoRateio({ grupo_dre: 'deducoes', natureza: 'despesa' })).toBe(false);
  });
  it('sem categoria ou sem grupo (de natureza despesa) continua entrando, nomeado', () => {
    expect(categoriaEntraNoRateio(null)).toBe(true);
    expect(categoriaEntraNoRateio(undefined)).toBe(true);
    expect(categoriaEntraNoRateio({ grupo_dre: null, natureza: 'despesa' })).toBe(true);
    expect(categoriaEntraNoRateio({ grupo_dre: null, natureza: null })).toBe(true);
    expect(categoriaEntraNoRateio({ grupo_dre: null, natureza: 'movimentacao' })).toBe(false);
    expect(categoriaEntraNoRateio({ grupo_dre: null, natureza: 'receita' })).toBe(false);
  });
});
