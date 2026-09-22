import { describe, expect, it } from 'vitest';
import * as front from './ancora-do-extrato';
import * as espelho from '../../../supabase/functions/_shared/ofx-ancora';

/**
 * A âncora do saldo declarado (21/09/2026, defeito 5): o Banpará informa o
 * saldo ANTERIOR ao período com DTASOF = início; o Itaú, na data de geração.
 * Uma semântica só (`em` = fim do dia), e o saldo após cada movimento
 * acumulado a partir dela. O espelho Deno tem de dizer o mesmo que o front —
 * os casos rodam nos dois.
 */
const implementacoes = [
  ['front (src/lib/financeiro)', front],
  ['espelho (_shared/ofx-ancora)', espelho],
] as const;

// O extrato de agosto do Banpará: três movimentos, saldo anterior de R$ 1.000.
const AGOSTO = [
  { data: '2026-08-01', valor: -200 },
  { data: '2026-08-10', valor: 1500.55 },
  { data: '2026-08-31', valor: -0.55 },
];

describe.each(implementacoes)('âncora do extrato — %s', (_nome, lib) => {
  it('Banpará: DTASOF = DTSTART é o saldo ANTERIOR, e vale no fim do dia anterior', () => {
    const a = lib.ancoraDoExtrato({ saldo: 1000, dtasof: '2026-08-01', dtstart: '2026-08-01', dtend: '2026-08-31' });
    expect(a).toEqual({ valor: 1000, em: '2026-07-31', posicao: 'abertura', dtasof: '2026-08-01', dtasofAssumido: false });
    // O primeiro movimento parte da âncora; o último fecha em 1000 − 200 + 1500,55 − 0,55.
    expect(lib.saldosApos(AGOSTO, a!)).toEqual([800, 2300.55, 2300]);
  });

  it('Itaú: DTASOF na data de geração (≥ DTEND) é o saldo ao FIM, e o último movimento termina nele', () => {
    const a = lib.ancoraDoExtrato({ saldo: 2300, dtasof: '2026-09-02', dtstart: '2026-08-01', dtend: '2026-08-31' });
    expect(a).toMatchObject({ valor: 2300, em: '2026-09-02', posicao: 'fechamento' });
    // Mesmos movimentos, mesma história: os saldos após cada um coincidem
    // com os do Banpará — as duas leituras descrevem a mesma conta.
    expect(lib.saldosApos(AGOSTO, a!)).toEqual([800, 2300.55, 2300]);
  });

  it('DTASOF um dia antes do início já é o fim daquele dia — não desloca de novo', () => {
    const a = lib.ancoraDoExtrato({ saldo: 1000, dtasof: '2026-07-31', dtstart: '2026-08-01', dtend: '2026-08-31' });
    expect(a).toMatchObject({ em: '2026-07-31', posicao: 'abertura' });
  });

  it('DTASOF no meio do período: vale no fim daquele dia; antes dele desconta, depois soma', () => {
    const a = lib.ancoraDoExtrato({ saldo: 800, dtasof: '2026-08-05', dtstart: '2026-08-01', dtend: '2026-08-31' });
    expect(a).toMatchObject({ em: '2026-08-05', posicao: 'intermediaria' });
    expect(lib.saldosApos(AGOSTO, a!)).toEqual([800, 2300.55, 2300]);
  });

  it('a ordem do arquivo não muda o saldo de cada movimento; dentro do dia, a ordem do arquivo desempata', () => {
    const a = lib.ancoraDoExtrato({ saldo: 2300, dtasof: '2026-08-31', dtstart: '2026-08-01', dtend: '2026-08-31' });
    const invertido = [...AGOSTO].reverse();
    expect(lib.saldosApos(invertido, a!)).toEqual([2300, 2300.55, 800]);
    const mesmoDia = [{ data: '2026-08-31', valor: 100 }, { data: '2026-08-31', valor: -50 }];
    expect(lib.saldosApos(mesmoDia, { valor: 1050, em: '2026-08-31' })).toEqual([1100, 1050]);
  });

  it('sem DTASOF, o fim do período é assumido e fica dito; sem período, não há âncora', () => {
    expect(lib.ancoraDoExtrato({ saldo: 10, dtasof: '', dtstart: '2026-08-01', dtend: '2026-08-31' }))
      .toMatchObject({ em: '2026-08-31', posicao: 'fechamento', dtasofAssumido: true });
    expect(lib.ancoraDoExtrato({ saldo: 10, dtasof: '', dtstart: '', dtend: '' })).toBeNull();
  });

  it('sem LEDGERBAL não há âncora — nulo, nunca zero', () => {
    expect(lib.ancoraDoExtrato({ saldo: null, dtasof: '2026-08-31', dtstart: '2026-08-01', dtend: '2026-08-31' })).toBeNull();
    expect(lib.ancoraDoExtrato({ saldo: Number.NaN, dtasof: '2026-08-31', dtstart: '2026-08-01', dtend: '2026-08-31' })).toBeNull();
  });

  it('extrato de um dia só: pela especificação, o saldo é o do fim do dia', () => {
    const a = lib.ancoraDoExtrato({ saldo: 5, dtasof: '2026-08-31', dtstart: '2026-08-31', dtend: '2026-08-31' });
    expect(a).toMatchObject({ em: '2026-08-31', posicao: 'fechamento' });
  });

  it('centavos não derivam em soma corrida', () => {
    // Mil PIX de dez centavos no mesmo dia: 0,1 somado mil vezes em ponto
    // flutuante dá 99,9999…; cada saldo é arredondado ao centavo.
    const muitos = Array.from({ length: 1000 }, () => ({ data: '2026-08-01', valor: 0.1 }));
    const saldos = lib.saldosApos(muitos, { valor: 0, em: '2026-07-31' });
    expect(saldos[999]).toBe(100);
    expect(saldos.every((s) => Math.abs(s * 100 - Math.round(s * 100)) < 1e-9)).toBe(true);
  });
});

describe('valorDeclarado (espelho) — BALAMT na gramática brasileira', () => {
  it('vírgula decimal e milhar com ponto não perdem os centavos; vazio é nulo, não zero', () => {
    expect(espelho.valorDeclarado('1.234,56')).toBe(1234.56);
    expect(espelho.valorDeclarado('1234,56')).toBe(1234.56);
    expect(espelho.valorDeclarado('1234.56')).toBe(1234.56);
    expect(espelho.valorDeclarado('-0.55')).toBe(-0.55);
    expect(espelho.valorDeclarado('')).toBeNull();
    expect(espelho.valorDeclarado(null)).toBeNull();
    expect(espelho.valorDeclarado('abc')).toBeNull();
  });
});

describe('descricaoDaAncora — o que a tela diz', () => {
  it('sem âncora, diz que o arquivo não trouxe e o que fica sem preenchimento', () => {
    expect(front.descricaoDaAncora(null)).toMatch(/não traz o saldo declarado/);
    expect(front.descricaoDaAncora(null)).toMatch(/saldo após cada movimento/);
  });

  it('com âncora, diz o valor, o dia e a posição', () => {
    const banpara = front.ancoraDoExtrato({ saldo: 1000, dtasof: '2026-08-01', dtstart: '2026-08-01', dtend: '2026-08-31' })!;
    expect(front.descricaoDaAncora(banpara)).toMatch(/31\/07\/2026/);
    expect(front.descricaoDaAncora(banpara)).toMatch(/saldo anterior ao período/);
    const itau = front.ancoraDoExtrato({ saldo: 2300, dtasof: '2026-09-02', dtstart: '2026-08-01', dtend: '2026-08-31' })!;
    expect(front.descricaoDaAncora(itau)).toMatch(/saldo ao fim do período/);
  });
});
