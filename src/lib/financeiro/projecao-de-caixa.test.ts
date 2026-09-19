import { describe, expect, it } from 'vitest';
import { acumularProjecao, type LinhaDoFluxo } from './projecao-de-caixa';

/**
 * O caso de 19/09/2026 (ETHOS): saldo R$ 46.264,95, realizados de agosto na
 * janela, e a tela dizendo "fica negativo em 32 dias — primeiro dia crítico
 * 04/08/2026" (46 dias no passado). A fórmula única não pode deixar isso
 * acontecer de novo.
 */

const HOJE = '2026-09-19';
const linha = (data: string, over: Partial<LinhaDoFluxo> = {}): LinhaDoFluxo => ({
  data, entradas_previstas: 0, saidas_previstas: 0, entradas_realizadas: 0, saidas_realizadas: 0, ...over,
});

describe('acumularProjecao', () => {
  it('não re-soma o passado: realizados de agosto já estão no saldo das contas', () => {
    const p = acumularProjecao({
      saldoInicial: 46_264.95,
      hoje: HOJE,
      linhas: [
        linha('2026-08-01', { saidas_realizadas: 300_000 }),
        linha('2026-08-04', { saidas_realizadas: 118_943.05 }),
        linha('2026-09-10', { entradas_realizadas: 51_302 }),
      ],
    });
    expect(p.dias.every((d) => d.passado)).toBe(true);
    expect(p.dias.map((d) => d.saldo_acumulado)).toEqual([46_264.95, 46_264.95, 46_264.95]);
    expect(p.saldoFinal).toBe(46_264.95);
    expect(p.primeiroNegativo).toBeNull();
    expect(p.diasNegativos).toBe(0);
  });

  it('realizado com data futura (pago antecipado) também não entra — só previsto anda o acumulado', () => {
    const p = acumularProjecao({
      saldoInicial: 1_000,
      hoje: HOJE,
      linhas: [linha('2026-10-01', { saidas_realizadas: 900, saidas_previstas: 100 })],
    });
    expect(p.saldoFinal).toBe(900);
  });

  it('o primeiro dia negativo é de hoje em diante, e "em dias" é calendário a partir de hoje', () => {
    const p = acumularProjecao({
      saldoInicial: 1_000,
      hoje: HOJE,
      linhas: [
        linha('2026-09-25', { saidas_previstas: 500 }),
        linha('2026-10-21', { saidas_previstas: 800 }), // aqui fica −300
        linha('2026-11-05', { entradas_previstas: 2_000 }), // volta a positivo
      ],
    });
    expect(p.primeiroNegativo).toEqual({ data: '2026-10-21', saldo: -300, emDias: 32 });
    expect(p.menorSaldo).toBe(-300);
    expect(p.saldoFinal).toBe(1_700);
    // Negativo de 21/10 até 21/10 (a próxima linha já é positiva): 1 dia.
    expect(p.diasNegativos).toBe(1);
  });

  it('previsto vencido e não baixado não some: entra no primeiro dia projetado e é declarado', () => {
    const p = acumularProjecao({
      saldoInicial: 10_000,
      hoje: HOJE,
      linhas: [
        linha('2026-09-10', { saidas_previstas: 19_816.7 }), // as 4 contas vencidas da ETHOS
        linha('2026-09-30', { entradas_previstas: 5_000 }),
      ],
    });
    expect(p.atrasados).toEqual({ entradas: 0, saidas: 19_816.7, total: -19_816.7 });
    expect(p.dias[0].saldo_acumulado).toBe(10_000); // passado: linha parada
    expect(p.dias[1].saldo_acumulado).toBeCloseTo(10_000 - 19_816.7 + 5_000, 2);
    expect(p.primeiroNegativo?.data).toBe('2026-09-30');
  });

  it('sem linha futura, os atrasados pesam no saldo de hoje', () => {
    const p = acumularProjecao({
      saldoInicial: 100,
      hoje: HOJE,
      linhas: [linha('2026-09-01', { saidas_previstas: 500 })],
    });
    expect(p.saldoFinal).toBe(-400);
    expect(p.primeiroNegativo).toEqual({ data: HOJE, saldo: -400, emDias: 0 });
  });

  it('o cenário multiplica só os previstos, e só de hoje em diante', () => {
    const p = acumularProjecao({
      saldoInicial: 0,
      hoje: HOJE,
      entradaMul: 0.85,
      saidaMul: 1.1,
      linhas: [
        linha('2026-09-01', { entradas_realizadas: 1_000 }),
        linha('2026-10-01', { entradas_previstas: 1_000, saidas_previstas: 1_000 }),
      ],
    });
    expect(p.dias[1].entradas_previstas).toBe(850);
    expect(p.dias[1].saidas_previstas).toBeCloseTo(1_100, 6);
    expect(p.saldoFinal).toBeCloseTo(-250, 6);
    expect(p.dias[0].entradas_realizadas).toBe(1_000);
  });
});
