import { describe, it, expect } from 'vitest';
import * as tela from './alteracoes-da-licitacao';
import * as webhook from '../../../supabase/functions/_shared/robo-alteracoes-da-licitacao';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';

/**
 * Pregão remarcado (Rafael, 17/09/2026): "na maioria dos casos, muda tudo, não
 * só a data, mas a quantidade, unidade, descrição". A regra roda na tela e no
 * webhook — as duas cópias respondem igual em todos os casos daqui.
 */
const AGORA = new Date('2026-09-17T14:00:00Z');
const SESSAO_ANTIGA = Date.parse('2026-07-30T12:30:00Z'); // 30/07 09:30 em Brasília

const publicado = (numero: number, extra: Record<string, unknown> = {}) => ({
  numero,
  descricao: 'Microcomputador desktop completo',
  quantidade: 100,
  unidade: 'Unidade',
  situacao: 'Em andamento',
  ...extra,
});
const cadastrado = (numero: number, extra: Record<string, unknown> = {}) => ({
  numero,
  descricao: 'Microcomputador desktop completo',
  quantidade: 100,
  unidade: 'Unidade',
  origem: 'comprasgov',
  ...extra,
});
const licitacao = (extra: Record<string, unknown> = {}) => ({
  situacao: 'Divulgada no PNCP',
  encerramentoPropostas: '2026-07-30T12:30:00Z',
  itens: [publicado(1), publicado(2)],
  ...extra,
});

const nasDuas = (e: Parameters<typeof tela.alteracoesDaLicitacao>[0]) => {
  const a = tela.alteracoesDaLicitacao(e);
  expect(webhook.alteracoesDaLicitacao(e as never)).toEqual(a);
  expect(webhook.linhasDasAlteracoes(a as never)).toEqual(tela.linhasDasAlteracoes(a));
  expect(webhook.alteracoesTravamLances(a as never)).toBe(tela.alteracoesTravamLances(a));
  return a;
};

describe('alteracoesDaLicitacao — tela e webhook', () => {
  it('nada mudou e a sessão continua no passado: "sem-mudanca", sem travar', () => {
    const a = nasDuas({ itens: [cadastrado(1)], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao(), agora: AGORA });
    expect(a.resultado).toBe('sem-mudanca');
    expect(a.sessaoPublicadaPassou).toBe(true);
    expect(a.foraDaDisputa).toBe(1); // escolher 1 de 2 é decisão, não mudança
    expect(tela.alteracoesTravamLances(a)).toBe(false);
  });

  it('só a data mudou (remarcada para o futuro): "so-data"', () => {
    const a = nasDuas({
      itens: [cadastrado(1), cadastrado(2)],
      inicioSessaoMs: SESSAO_ANTIGA,
      licitacao: licitacao({ encerramentoPropostas: '2026-09-25T12:30:00Z' }),
      agora: AGORA,
    });
    expect(a.resultado).toBe('so-data');
    expect(a.dataMudou).toBe(true);
    expect(tela.alteracoesTravamLances(a)).toBe(false);
  });

  it('o caso do Rafael: remarcada com quantidade, unidade e descrição novas — "itens-mudaram" e trava', () => {
    const a = nasDuas({
      itens: [cadastrado(1), cadastrado(2), cadastrado(3)],
      inicioSessaoMs: SESSAO_ANTIGA,
      licitacao: licitacao({
        encerramentoPropostas: '2026-09-25T12:30:00Z',
        itens: [
          publicado(1, { quantidade: 50 }),
          publicado(2, { descricao: 'Notebook 14 polegadas', unidade: 'Caixa' }),
        ],
      }),
      agora: AGORA,
    });
    expect(a.resultado).toBe('itens-mudaram');
    expect(tela.linhasDasAlteracoes(a)).toEqual([
      'Item 1: quantidade 100 → 50',
      'Item 2: descrição mudou; unidade Unidade → Caixa',
      'Item 3: não existe mais na licitação',
    ]);
    expect(tela.alteracoesTravamLances(a)).toBe(true);
    expect(tela.resumoDasAlteracoes(a)).toBe('Item 1: quantidade 100 → 50 · Item 2: descrição mudou; unidade Unidade → Caixa · Item 3: não existe mais na licitação');
  });

  it('item do Kanban ("UN", descrição resumida): só a quantidade conta', () => {
    const doKanban = { numero: 1, descricao: 'Microcomputador', quantidade: 100, unidade: 'UN', origem: 'licitacao' };
    expect(nasDuas({ itens: [doKanban], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao(), agora: AGORA }).resultado).toBe('sem-mudanca');
    const menos = nasDuas({ itens: [{ ...doKanban, quantidade: '80' }], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao(), agora: AGORA });
    expect(tela.linhasDasAlteracoes(menos)).toEqual(['Item 1: quantidade 80 → 100']);
  });

  it('o "(Cota reservada…)" que o cadastro acrescenta não é mudança de descrição', () => {
    const a = nasDuas({
      itens: [cadastrado(1, { descricao: 'Microcomputador desktop completo (Cota reservada para ME/EPP)' })],
      inicioSessaoMs: SESSAO_ANTIGA,
      licitacao: licitacao(),
      agora: AGORA,
    });
    expect(a.itens).toEqual([]);
  });

  it('licitação revogada ou anulada vem antes de tudo; suspensa também trava', () => {
    expect(nasDuas({ itens: [cadastrado(1)], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao({ situacao: 'Revogada' }), agora: AGORA }).resultado).toBe('revogada');
    expect(nasDuas({ itens: [cadastrado(1)], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao({ situacao: 'Anulada' }), agora: AGORA }).resultado).toBe('revogada');
    const suspensa = nasDuas({ itens: [cadastrado(1)], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao({ situacao: 'Suspensa' }), agora: AGORA });
    expect(suspensa.resultado).toBe('suspensa');
    expect(tela.alteracoesTravamLances(suspensa)).toBe(true);
  });

  it('item cancelado, deserto ou suspenso na licitação é mudança', () => {
    const a = nasDuas({
      itens: [cadastrado(1), cadastrado(2)],
      inicioSessaoMs: SESSAO_ANTIGA,
      licitacao: licitacao({ itens: [publicado(1, { situacao: 'Cancelado' }), publicado(2, { situacao: 'Suspenso' })] }),
      agora: AGORA,
    });
    expect(a.itens.map((i) => [i.numero, i.tipo])).toEqual([[1, 'cancelado'], [2, 'suspenso']]);
    expect(a.resultado).toBe('itens-mudaram');
  });

  it('licitação sem itens publicados não acusa "sumiu" em todos', () => {
    const a = nasDuas({ itens: [cadastrado(1)], inicioSessaoMs: SESSAO_ANTIGA, licitacao: licitacao({ itens: [] }), agora: AGORA });
    expect(a.itens).toEqual([]);
  });
});

describe('atualizarDisputaComALicitacao', () => {
  const lance = {
    id: 'd1', edital: '90029/2026', portal: 'Compras.gov.br', uasg: '925448', valorReferencia: 0, valorInicial: 900,
    valorMinimo: 700, decrementoMin: 0, decrementoPercentual: 0, intervaloSegundos: 30, maxLances: null,
    modoAutomatico: true, status: 'aguardando', horario: '09:30', dataSessao: '2026-07-30', meuLance: 0, valorAtual: 0,
    tipoDisputa: 'item',
    itens: [
      { id: 'a', numero: 1, descricao: 'Microcomputador desktop completo', quantidade: 100, unidade: 'Unidade', valorReferencia: 10, valorMinimo: 8, estrategias: ['iminencia'], marca: 'X', origem: 'comprasgov' },
      { id: 'b', numero: 2, descricao: 'Microcomputador desktop completo', quantidade: 100, unidade: 'Unidade', valorReferencia: 10, valorMinimo: 9, estrategias: ['melhor_preco', 'iminencia'], origem: 'comprasgov' },
      { id: 'c', numero: 3, descricao: 'Mouse', quantidade: 5, unidade: 'Unidade', valorReferencia: 1, valorMinimo: 1, origem: 'comprasgov' },
    ],
  } as unknown as LanceConfig;

  it('itens iguais ficam; alterados perdem piso e estratégias; sumidos saem; data nova; Modo Automático desliga', () => {
    const publicada = licitacao({
      encerramentoPropostas: '2026-09-25T12:30:00Z',
      itens: [publicado(1, { quantidade: 50, valorUnitarioEstimado: 12 }), publicado(2)],
    });
    const a = tela.alteracoesDaLicitacao({ itens: lance.itens, inicioSessaoMs: SESSAO_ANTIGA, licitacao: publicada, agora: AGORA });
    const novo = tela.atualizarDisputaComALicitacao(lance, publicada, a, { dataSessao: '2026-09-25', horario: '09:30' });

    expect(novo.itens.map((i) => i.numero)).toEqual([1, 2]);
    expect(novo.itens[0]).toMatchObject({ quantidade: 50, valorReferencia: 12, valorMinimo: null, estrategias: undefined, marca: undefined });
    expect(novo.itens[1]).toMatchObject({ valorMinimo: 9, estrategias: ['melhor_preco', 'iminencia'] });
    expect(novo.dataSessao).toBe('2026-09-25');
    expect(novo.modoAutomatico).toBe(false);
    expect(novo.valorMinimo).toBe(0);
    expect(novo.valorReferencia).toBe(12 * 50 + 10 * 100);
  });

  it('só a data: mantém itens, pisos, Modo Automático e valor mínimo', () => {
    const publicada = licitacao({ encerramentoPropostas: '2026-09-25T12:30:00Z', itens: [publicado(1), publicado(2), { ...publicado(3), descricao: 'Mouse', quantidade: 5 }] });
    const a = tela.alteracoesDaLicitacao({ itens: lance.itens, inicioSessaoMs: SESSAO_ANTIGA, licitacao: publicada, agora: AGORA });
    expect(a.resultado).toBe('so-data');
    const novo = tela.atualizarDisputaComALicitacao(lance, publicada, a, { dataSessao: '2026-09-25', horario: '09:30' });
    expect(novo.itens).toEqual(lance.itens);
    expect(novo.dataSessao).toBe('2026-09-25');
    expect(novo.modoAutomatico).toBe(true);
    expect(novo.valorMinimo).toBe(700);
  });
});
