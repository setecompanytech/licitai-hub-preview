import { describe, it, expect } from 'vitest';
import { apurarTickets, type ContratoHistorico } from '@/lib/metas/tickets';

const contrato = (modalidade: string | null, reais: number): ContratoHistorico => ({
  modalidade,
  valorGlobalCent: Math.round(reais * 100),
});

describe('apurarTickets', () => {
  it('sem contratos, devolve lista vazia', () => {
    expect(apurarTickets([])).toEqual([]);
  });

  it('agrupa grafias diferentes da mesma modalidade', () => {
    const tickets = apurarTickets([
      contrato('Pregão Eletrônico', 100_000),
      contrato('PREGAO ELETRONICO', 200_000),
      contrato('Pregão - Eletrônico', 300_000),
    ]);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].modalidade).toBe('pregao_eletronico');
    expect(tickets[0].amostra).toBe(3);
    expect(tickets[0].ticketCent).toBe(200_000_00);
    expect(tickets[0].mix).toBe(1);
  });

  it('calcula mix por número de contratos e soma 1', () => {
    const tickets = apurarTickets([
      contrato('Pregão Eletrônico', 100_000),
      contrato('Pregão Eletrônico', 100_000),
      contrato('Pregão Eletrônico', 100_000),
      contrato('Dispensa', 50_000),
    ]);

    const pregao = tickets.find((t) => t.modalidade === 'pregao_eletronico')!;
    const dispensa = tickets.find((t) => t.modalidade === 'dispensa')!;

    expect(pregao.mix).toBeCloseTo(0.75, 10);
    expect(dispensa.mix).toBeCloseTo(0.25, 10);
    expect(tickets.reduce((s, t) => s + t.mix, 0)).toBeCloseTo(1, 10);
  });

  it('ignora contrato de valor não positivo, inclusive no mix', () => {
    const tickets = apurarTickets([
      contrato('Dispensa', 80_000),
      contrato('Dispensa', 0),
      contrato('Dispensa', -5_000),
    ]);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].amostra).toBe(1);
    expect(tickets[0].ticketCent).toBe(80_000_00);
    expect(tickets[0].mix).toBe(1);
  });

  it('modalidade vazia ou desconhecida cai em "outra"', () => {
    const tickets = apurarTickets([contrato(null, 10_000), contrato('Coisa Nova', 20_000)]);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].modalidade).toBe('outra');
    expect(tickets[0].ticketCent).toBe(15_000_00);
  });

  it('ordena da maior para a menor fatia da carteira', () => {
    const tickets = apurarTickets([
      contrato('Dispensa', 10_000),
      contrato('Pregão Eletrônico', 10_000),
      contrato('Pregão Eletrônico', 10_000),
    ]);
    expect(tickets.map((t) => t.modalidade)).toEqual(['pregao_eletronico', 'dispensa']);
  });

  it('arredonda o ticket para centavo inteiro', () => {
    // 3 contratos de 10.000,00 / 3 não divide exato em centavos
    const tickets = apurarTickets([
      contrato('Dispensa', 1),
      contrato('Dispensa', 1),
      contrato('Dispensa', 1.01),
    ]);
    expect(Number.isInteger(tickets[0].ticketCent)).toBe(true);
    expect(tickets[0].ticketCent).toBe(100);
  });
});
