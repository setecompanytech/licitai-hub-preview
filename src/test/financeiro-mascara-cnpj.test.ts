import { describe, it, expect } from 'vitest';
import { mascaraCNPJ, formatCNPJ } from '@/lib/financeiro/formatters';

// A máscara PROGRESSIVA nasceu para o campo de digitação (consulta federal,
// 08/09): o formatCNPJ só veste número completo, e o campo parecia sem
// máscara enquanto a pessoa digitava.
describe('mascaraCNPJ — máscara progressiva de digitação', () => {
  it('formata conforme digita, sem separador pendurado', () => {
    expect(mascaraCNPJ('2')).toBe('2');
    expect(mascaraCNPJ('24')).toBe('24');
    expect(mascaraCNPJ('246')).toBe('24.6');
    expect(mascaraCNPJ('24687')).toBe('24.687');
    expect(mascaraCNPJ('246871')).toBe('24.687.1');
    expect(mascaraCNPJ('24687187')).toBe('24.687.187');
    expect(mascaraCNPJ('246871870001')).toBe('24.687.187/0001');
    expect(mascaraCNPJ('24687187000101')).toBe('24.687.187/0001-01');
  });

  it('aceita colar já formatado e reaplica a máscara', () => {
    expect(mascaraCNPJ('24.687.187/0001-01')).toBe('24.687.187/0001-01');
  });

  it('corta no 14º dígito — colar texto maior não estoura', () => {
    expect(mascaraCNPJ('24687187000101999')).toBe('24.687.187/0001-01');
  });

  it('vazio continua vazio', () => {
    expect(mascaraCNPJ('')).toBe('');
    expect(mascaraCNPJ('abc')).toBe('');
  });

  it('coerente com o formatCNPJ do número completo', () => {
    expect(mascaraCNPJ('24687187000101')).toBe(formatCNPJ('24687187000101'));
  });
});
