import { describe, it, expect } from 'vitest';
import { lerValorDigitado, valorParaDigitar } from '@/lib/robo/valor-digitado';

/** O campo de valor da grade de itens não pode comer a vírgula (16/09/2026). */
describe('valor digitado na grade de itens', () => {
  it('vírgula decimal, do jeito brasileiro, inclusive no meio da digitação', () => {
    expect(lerValorDigitado('4999,70')).toBe(4999.7);
    expect(lerValorDigitado('4999,')).toBe(4999);
    expect(lerValorDigitado('0,5')).toBe(0.5);
    expect(lerValorDigitado('R$ 4.999,70')).toBe(4999.7);
  });

  it('sem vírgula, ponto é decimal', () => {
    expect(lerValorDigitado('4999.70')).toBe(4999.7);
  });

  it('vazio é "ninguém decidiu", nunca zero', () => {
    expect(lerValorDigitado('')).toBeNull();
    expect(lerValorDigitado('abc')).toBeNull();
    expect(lerValorDigitado('0')).toBe(0);
  });

  it('volta para o campo com vírgula', () => {
    expect(valorParaDigitar(4999.7)).toBe('4999,7');
    expect(valorParaDigitar(null)).toBe('');
    expect(valorParaDigitar(0)).toBe('0');
  });
});
