import { describe, it, expect } from 'vitest';
import { unidadeLegivel } from '../unidade';

describe('unidadeLegivel', () => {
  it('unidade de verdade passa como está', () => {
    expect(unidadeLegivel('kg')).toBe('kg');
    expect(unidadeLegivel(' UN ')).toBe('UN');
  });
  it('vazio, nulo e o texto "null" viram o padrão', () => {
    expect(unidadeLegivel(null)).toBe('');
    expect(unidadeLegivel(undefined, 'unidade')).toBe('unidade');
    expect(unidadeLegivel('null', 'unidade')).toBe('unidade');
    expect(unidadeLegivel('NULL')).toBe('');
    expect(unidadeLegivel('undefined')).toBe('');
    expect(unidadeLegivel('-')).toBe('');
  });
});
