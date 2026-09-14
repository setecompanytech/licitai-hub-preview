import { describe, expect, it } from 'vitest';
import { formatarCentavos, formatPercentual, lerNumero } from './formato';

/**
 * O que a pessoa digita vira custo e limite. Um separador lido errado é erro
 * de 100× ou 1000× com cara de número válido — por isso cada leitura aqui é
 * um caso que já aconteceu ou que a colagem de planilha produz.
 */
describe('lerNumero', () => {
  it('vírgula decimal e milhar pt-BR', () => {
    expect(lerNumero('12,5').valor).toBe(12.5);
    expect(lerNumero('1.234,56').valor).toBe(1234.56);
    expect(lerNumero('R$ 0,0035').valor).toBe(0.0035);
    expect(lerNumero('15%').valor).toBe(15);
  });

  it('"0.035" colado de planilha é custo fracionário, não 35', () => {
    expect(lerNumero('0.035').valor).toBe(0.035);
  });

  it('em branco é "não informado", nunca zero', () => {
    expect(lerNumero('  ')).toEqual({ vazio: true, valor: null, erro: null });
    expect(lerNumero('0').valor).toBe(0);
  });

  it('recusa texto, negativo e percentual acima de 100', () => {
    expect(lerNumero('doze').erro).not.toBeNull();
    expect(lerNumero('-3').erro).not.toBeNull();
    expect(lerNumero('101', { maximo: 100 }).erro).not.toBeNull();
  });
});

describe('formatação', () => {
  it('centavo inteiro em reais, e ausência como travessão', () => {
    expect(formatarCentavos(17_857)).toBe('R$ 178,57');
    expect(formatarCentavos(null)).toBe('—');
  });

  it('percentual 0–100 com vírgula', () => {
    expect(formatPercentual(15)).toBe('15,00%');
    expect(formatPercentual(78.57)).toBe('78,57%');
  });
});
