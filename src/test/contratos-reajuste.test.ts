import { describe, it, expect } from 'vitest';
import { situacaoDoReajuste, somarMeses, valorEstimadoDoReajuste } from '@/lib/contratos/reajuste';

describe('somarMeses', () => {
  it('soma 12 meses no dia certo', () => {
    expect(somarMeses('2025-03-15', 12)).toBe('2026-03-15');
  });

  it('prende o fim de mês ao mês certo (29/02 + 12m = 28/02)', () => {
    expect(somarMeses('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('31 + 12m num mês de 30 dias vira 30', () => {
    expect(somarMeses('2025-01-31', 3)).toBe('2025-04-30');
  });
});

describe('situacaoDoReajuste — interregno anual (Lei 10.192/2001, arts. 2º-3º)', () => {
  it('sem data-base não calcula: palpite de data é alerta no dia errado', () => {
    expect(situacaoDoReajuste({ dataBase: null, hoje: '2026-09-08' })).toBeNull();
    expect(situacaoDoReajuste({ dataBase: 'não sei', hoje: '2026-09-08' })).toBeNull();
  });

  it('antes do aniversário: não devido', () => {
    const s = situacaoDoReajuste({ dataBase: '2026-01-10', hoje: '2026-09-08' });
    expect(s).not.toBeNull();
    expect(s!.devido).toBe(false);
    expect(s!.aniversario).toBe('2027-01-10');
    expect(s!.mesesDesdeAniversario).toBe(0);
  });

  it('no aniversário e depois dele: devido, contando meses de atraso', () => {
    const s = situacaoDoReajuste({ dataBase: '2025-06-01', hoje: '2026-09-08' });
    expect(s!.devido).toBe(true);
    expect(s!.aniversario).toBe('2026-06-01');
    expect(s!.mesesDesdeAniversario).toBe(3);
  });

  it('reajuste registrado REINICIA a contagem — o marco anda', () => {
    const s = situacaoDoReajuste({
      dataBase: '2024-05-01',
      reajustesRegistrados: ['2025-05-10'],
      hoje: '2026-04-01',
    });
    expect(s!.marco).toBe('2025-05-10');
    expect(s!.marcoEhReajusteAnterior).toBe(true);
    expect(s!.devido).toBe(false); // aniversário do novo marco é 10/05/2026
  });

  it('vários reajustes: vale o mais recente', () => {
    const s = situacaoDoReajuste({
      dataBase: '2023-01-01',
      reajustesRegistrados: ['2024-01-15', '2025-02-20', null, ''],
      hoje: '2026-09-08',
    });
    expect(s!.marco).toBe('2025-02-20');
    expect(s!.devido).toBe(true);
    expect(s!.aniversario).toBe('2026-02-20');
  });

  it('reajuste anterior à data-base não anda o marco para trás', () => {
    const s = situacaoDoReajuste({
      dataBase: '2025-08-01',
      reajustesRegistrados: ['2024-01-01'],
      hoje: '2026-09-08',
    });
    expect(s!.marco).toBe('2025-08-01');
    expect(s!.marcoEhReajusteAnterior).toBe(false);
  });
});

describe('valorEstimadoDoReajuste', () => {
  it('acumulado de 12m sobre o valor', () => {
    expect(valorEstimadoDoReajuste(100_000, 4.5)).toBeCloseTo(4_500, 5);
  });

  it('sem acumulado ou valor inválido: null, nunca zero fingido', () => {
    expect(valorEstimadoDoReajuste(100_000, null)).toBeNull();
    expect(valorEstimadoDoReajuste(0, 4.5)).toBeNull();
    expect(valorEstimadoDoReajuste(NaN, 4.5)).toBeNull();
  });
});
