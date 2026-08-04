import { describe, it, expect } from 'vitest';
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';

/**
 * A máscara do MoneyInput trata dígito como centavo — certo para teclar,
 * errado para colar: "300000" de uma planilha viraria R$ 3.000,00 (100×
 * menor). Estes casos fixam o comportamento do interpretador de colagem.
 */
describe('interpretarValorColado', () => {
  it('inteiro cru é reais, não centavos', () => {
    expect(interpretarValorColado('300000')).toBe(300000);
    expect(interpretarValorColado('42')).toBe(42);
  });

  it('formato pt-BR completo', () => {
    expect(interpretarValorColado('R$ 300.000,00')).toBe(300000);
    expect(interpretarValorColado('1.234,56')).toBe(1234.56);
  });

  it('vírgula decimal sem milhar, mesmo com 1 casa só', () => {
    expect(interpretarValorColado('1234,5')).toBe(1234.5);
    expect(interpretarValorColado('300000,50')).toBe(300000.5);
  });

  it('ponto de milhar sem decimal', () => {
    expect(interpretarValorColado('1.234')).toBe(1234);
    expect(interpretarValorColado('1.234.567')).toBe(1234567);
  });

  it('ponto decimal estilo CSV/en-US', () => {
    expect(interpretarValorColado('1234.5')).toBe(1234.5);
    expect(interpretarValorColado('1,234.56')).toBe(1234.56);
    expect(interpretarValorColado('1,234,567')).toBe(1234567);
  });

  it('mais de duas casas decimais preserva o valor, não a máscara', () => {
    expect(interpretarValorColado('1.234,567')).toBe(1234.567);
  });

  it('negativo com formato brasileiro', () => {
    expect(interpretarValorColado('-1.234,56')).toBe(-1234.56);
  });

  it('texto sem número legível devolve null', () => {
    expect(interpretarValorColado('')).toBeNull();
    expect(interpretarValorColado('abc')).toBeNull();
    expect(interpretarValorColado('R$ ')).toBeNull();
  });

  it('ruído em volta do número não atrapalha', () => {
    expect(interpretarValorColado('  R$ 5.400,00  ')).toBe(5400);
    expect(interpretarValorColado('valor: 250,00 (aprovado)')).toBe(250);
  });
});
