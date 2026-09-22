import { describe, expect, it } from 'vitest';
import {
  condicaoDeAtrasoNoBanco, diasDeAtraso, diasParaVencer, estaEmAberto, estaEmAtraso, situacaoDoTitulo,
} from './atraso';

/**
 * A régua única do atraso (21/09/2026). Os casos são os da auditoria: o
 * título sem vencimento que o cartão ignorava e o Kanban chamava de vencido;
 * o `status = 'em_atraso'` que nunca é gravado; e o dia de hoje, que não é
 * atraso — só vira à meia-noite de quem olha, nunca em UTC.
 */
const HOJE = '2026-09-22';

describe('estaEmAtraso — em aberto, com vencimento, antes de hoje', () => {
  it('previsto vencido ontem está em atraso; hoje ainda não', () => {
    expect(estaEmAtraso({ status: 'previsto', data_vencimento: '2026-09-21' }, HOJE)).toBe(true);
    expect(estaEmAtraso({ status: 'previsto', data_vencimento: '2026-09-22' }, HOJE)).toBe(false);
    expect(estaEmAtraso({ status: 'previsto', data_vencimento: '2026-09-23' }, HOJE)).toBe(false);
  });

  it('o status gravado não decide: em_atraso com vencimento futuro não é atraso, previsto vencido é', () => {
    // `em_atraso` nunca é escrito pelo sistema; se alguém gravou à mão, a
    // data continua mandando.
    expect(estaEmAtraso({ status: 'em_atraso', data_vencimento: '2026-10-10' }, HOJE)).toBe(false);
    expect(estaEmAtraso({ status: 'em_atraso', data_vencimento: '2026-08-01' }, HOJE)).toBe(true);
  });

  it('pago e cancelado nunca estão em atraso, por mais velho que seja o vencimento', () => {
    expect(estaEmAtraso({ status: 'realizado', data_vencimento: '2025-01-01' }, HOJE)).toBe(false);
    expect(estaEmAtraso({ status: 'conciliado', data_vencimento: '2025-01-01' }, HOJE)).toBe(false);
    expect(estaEmAtraso({ status: 'cancelado', data_vencimento: '2025-01-01' }, HOJE)).toBe(false);
  });

  it('sem vencimento não é atraso: é outra situação, e a competência não entra no lugar', () => {
    // A NF 736 da ETHOS (R$ 2.145.439,42) nasceu sem vencimento pela RPC da
    // Extração: o cartão a ignorava e o Kanban a punha em "Vencido" pela
    // competência. Nem um nem outro.
    const t = { status: 'previsto', data_vencimento: null, data_competencia: '2026-05-01' };
    expect(estaEmAtraso(t, HOJE)).toBe(false);
    expect(situacaoDoTitulo(t, HOJE)).toBe('sem_vencimento');
    expect(diasParaVencer(t, HOJE)).toBeNull();
  });

  it('timestamp no vencimento é lido pela data, sem fuso', () => {
    expect(estaEmAtraso({ status: 'previsto', data_vencimento: '2026-09-21T00:00:00+00:00' }, HOJE)).toBe(true);
  });
});

describe('diasDeAtraso e diasParaVencer', () => {
  it('conta dias-calendário, atravessando o horário de verão sem perder um dia', () => {
    expect(diasDeAtraso({ status: 'previsto', data_vencimento: '2026-09-01' }, HOJE)).toBe(21);
    expect(diasParaVencer({ status: 'previsto', data_vencimento: '2026-09-29' }, HOJE)).toBe(7);
    expect(diasParaVencer({ status: 'previsto', data_vencimento: '2025-12-31' }, '2026-01-01')).toBe(-1);
  });

  it('título que não está em atraso tem zero dias de atraso', () => {
    expect(diasDeAtraso({ status: 'previsto', data_vencimento: '2026-12-01' }, HOJE)).toBe(0);
    expect(diasDeAtraso({ status: 'realizado', data_vencimento: '2026-01-01' }, HOJE)).toBe(0);
  });
});

describe('situacaoDoTitulo — o que as telas pintam', () => {
  it('as seis situações, pela ordem de precedência', () => {
    expect(situacaoDoTitulo({ status: 'realizado', data_vencimento: '2026-01-01' }, HOJE)).toBe('pago');
    expect(situacaoDoTitulo({ status: 'conciliado', data_vencimento: null }, HOJE)).toBe('pago');
    expect(situacaoDoTitulo({ status: 'cancelado', data_vencimento: '2026-01-01' }, HOJE)).toBe('cancelado');
    expect(situacaoDoTitulo({ status: 'previsto', data_vencimento: '2026-09-21' }, HOJE)).toBe('em_atraso');
    expect(situacaoDoTitulo({ status: 'previsto', data_vencimento: '2026-09-22' }, HOJE)).toBe('vence_em_7_dias');
    expect(situacaoDoTitulo({ status: 'previsto', data_vencimento: '2026-09-29' }, HOJE)).toBe('vence_em_7_dias');
    expect(situacaoDoTitulo({ status: 'previsto', data_vencimento: '2026-09-30' }, HOJE)).toBe('em_aberto');
    expect(situacaoDoTitulo({ status: 'previsto', data_vencimento: null }, HOJE)).toBe('sem_vencimento');
  });

  it('estaEmAberto: previsto e em_atraso sim; pago e cancelado não', () => {
    expect(estaEmAberto({ status: 'previsto' })).toBe(true);
    expect(estaEmAberto({ status: 'em_atraso' })).toBe(true);
    expect(estaEmAberto({ status: 'realizado' })).toBe(false);
    expect(estaEmAberto({ status: 'cancelado' })).toBe(false);
  });
});

describe('condicaoDeAtrasoNoBanco — o filtro diz o mesmo que a função', () => {
  it('a condição do banco e a função pura concordam em toda a carteira de exemplo', () => {
    const carteira = [
      { status: 'previsto', data_vencimento: '2026-09-21' },
      { status: 'previsto', data_vencimento: '2026-09-22' },
      { status: 'em_atraso', data_vencimento: '2026-09-01' },
      { status: 'em_atraso', data_vencimento: '2026-10-01' },
      { status: 'realizado', data_vencimento: '2026-09-01' },
      { status: 'cancelado', data_vencimento: '2026-09-01' },
      { status: 'previsto', data_vencimento: null },
    ];
    const c = condicaoDeAtrasoNoBanco(HOJE);
    // O que o `.in('status', …).lt('data_vencimento', …)` devolveria:
    const peloBanco = carteira.filter(
      (t) => (c.status as readonly string[]).includes(t.status) && !!t.data_vencimento && t.data_vencimento < c.vencimentoAntesDe,
    );
    const pelaFuncao = carteira.filter((t) => estaEmAtraso(t, HOJE));
    expect(peloBanco).toEqual(pelaFuncao);
    expect(pelaFuncao).toHaveLength(2);
  });
});
