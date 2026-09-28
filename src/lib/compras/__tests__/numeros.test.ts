import { describe, it, expect } from 'vitest';
import { formatarMoedaBr, formatarQuantidade, mascaraMoedaBr, parseMoedaBr, parseQuantidade } from '../numeros';

describe('números dos pedidos', () => {
  it('quantidade do campo numérico: "818.21" é 818,21 — não 81.821 (o defeito de 28/09)', () => {
    expect(parseQuantidade('818.21')).toBe(818.21);
    expect(parseQuantidade('818.21') * 38).toBeCloseTo(31091.98, 2);
    expect(parseQuantidade('1000')).toBe(1000);
    expect(parseQuantidade('0.5')).toBe(0.5);
  });
  it('quantidade digitada em pt-BR também vale', () => {
    expect(parseQuantidade('818,21')).toBe(818.21);
    expect(parseQuantidade('1.234,5')).toBe(1234.5);
    expect(parseQuantidade('')).toBe(0);
    expect(parseQuantidade('abc')).toBe(0);
    expect(parseQuantidade(7)).toBe(7);
  });
  it('dinheiro com máscara: ponto é milhar, vírgula é decimal', () => {
    expect(parseMoedaBr('3.109.198,00')).toBe(3109198);
    expect(parseMoedaBr('38,00')).toBe(38);
    expect(formatarMoedaBr(31091.98)).toBe('31.091,98');
    expect(mascaraMoedaBr('3800')).toBe('38,00');
    expect(mascaraMoedaBr('')).toBe('0,00');
    expect(formatarQuantidade(818.21)).toBe('818,21');
    expect(formatarQuantidade(1000)).toBe('1.000');
  });
});
