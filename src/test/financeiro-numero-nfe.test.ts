import { describe, it, expect } from 'vitest';
import { formatarNumeroNfe, numeroNfeComoInteiro } from '@/lib/financeiro/chave-nfe';

describe('formatarNumeroNfe', () => {
  it('põe no formato do DANFE, três grupos de três', () => {
    expect(formatarNumeroNfe('125')).toBe('000.000.125');
    expect(formatarNumeroNfe(125)).toBe('000.000.125');
    expect(formatarNumeroNfe('000000125')).toBe('000.000.125');
  });

  it('aceita as grafias que o campo livre recebe hoje', () => {
    // Todas são a mesma nota. Sem normalizar, viram três linhas diferentes.
    for (const v of ['NF 000000125', 'nfe 000.000.125', 'Nota 125/2026', 'NF-e nº 125']) {
      expect(formatarNumeroNfe(v)).toBe('000.000.125');
    }
  });

  it('campo vazio devolve null, não uma nota inventada', () => {
    expect(formatarNumeroNfe('')).toBeNull();
    expect(formatarNumeroNfe(null)).toBeNull();
    expect(formatarNumeroNfe('sem número')).toBeNull();
  });

  it('mais de 9 dígitos não é número de nota — devolve limpo para dar na vista', () => {
    // 44 dígitos é a CHAVE de acesso, colada no campo errado.
    const chave = '3'.repeat(44);
    expect(formatarNumeroNfe(chave)).toBe(chave);
  });

  it('nove dígitos cheios continuam legíveis', () => {
    expect(formatarNumeroNfe('123456789')).toBe('123.456.789');
  });
});

describe('numeroNfeComoInteiro', () => {
  it('as duas grafias dão o mesmo número', () => {
    expect(numeroNfeComoInteiro('000.000.125')).toBe(125);
    expect(numeroNfeComoInteiro('125')).toBe(125);
  });

  it('permite ordenar pela sequência, não pelo texto', () => {
    const notas = ['000.000.099', '125', 'NF 7'];
    const ordenado = [...notas].sort(
      (a, b) => (numeroNfeComoInteiro(a) ?? 0) - (numeroNfeComoInteiro(b) ?? 0),
    );
    expect(ordenado).toEqual(['NF 7', '000.000.099', '125']);
  });

  it('chave de acesso não vira número', () => {
    expect(numeroNfeComoInteiro('3'.repeat(44))).toBeNull();
  });
});
