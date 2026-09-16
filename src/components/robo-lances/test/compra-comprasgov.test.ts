import { describe, it, expect, vi } from 'vitest';
import fixture from './fixtures/compra-comprasgov-7-2026.json';
import {
  compraDoComprasGov,
  idDaCompra,
  instanteDeBrasilia,
  lerNumeroEAno,
  uasgValida,
} from '../../../../supabase/functions/_shared/compra-comprasgov';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import {
  divergenciaDaSessao,
  itensDaCompraParaDisputa,
  podeBuscarCompra,
  resumoDaCompra,
  sessaoDaCompra,
  type CompraDoComprasGov,
} from '@/lib/robo/compra-comprasgov';

/**
 * Fase 6 — a compra do Compras.gov por UASG + número/ano. Fixture: a resposta
 * real dos dados abertos para o 7/2026 da SEDUC/PA (itens 1, 4, 5 e 6 de 75).
 */

const compra = (): CompraDoComprasGov =>
  compraDoComprasGov(
    fixture.compra as unknown as Record<string, unknown>,
    fixture.itens as unknown as Record<string, unknown>[],
  );

describe('identificação da compra', () => {
  it('lê número e ano do jeito que o operador escreve', () => {
    expect(lerNumeroEAno('07/2026')).toEqual({ numero: 7, ano: 2026 });
    expect(lerNumeroEAno('PE 90012 / 2025')).toEqual({ numero: 90012, ano: 2025 });
    expect(lerNumeroEAno('123456/2025')).toBeNull();
    expect(lerNumeroEAno('TESTE-COMPRASGOV')).toBeNull();
    expect(lerNumeroEAno(null)).toBeNull();
  });

  it('monta o idCompra que o Compras.gov usa — conferido com o 7/2026', () => {
    expect(idDaCompra('925315', '05', 7, 2026)).toBe('92531505000072026');
    expect(idDaCompra('925315', '05', 7, 2026)).toBe(fixture.compra.idCompra);
  });

  it('UASG só com 6 dígitos', () => {
    expect(uasgValida(' 925.315 ')).toBe('925315');
    expect(uasgValida('92531')).toBeNull();
  });

  it('data sem fuso é horário de Brasília — não vira 3 horas adiantada', () => {
    expect(instanteDeBrasilia('2026-09-14T08:59:00')).toBe('2026-09-14T08:59:00-03:00');
    expect(new Date(instanteDeBrasilia('2026-09-14T08:59:00')!).toISOString()).toBe('2026-09-14T11:59:00.000Z');
    expect(instanteDeBrasilia('2026-09-14T11:59:00Z')).toBe('2026-09-14T11:59:00Z');
    expect(instanteDeBrasilia('')).toBeNull();
  });
});

describe('a compra lida', () => {
  it('traz os dados da licitação para complementar a disputa', () => {
    const c = compra();
    expect(c.orgao).toBe('SECRETARIA DE ESTADO DE EDUCACAO');
    expect(c.unidade).toBe('SECRETARIA DE ESTADO DE EDUCACAO - PA');
    expect(c.srp).toBe(true);
    expect(c.modoDisputa).toBe('Aberto');
    expect(c.criterio).toBe('Menor preço');
    expect(c.numero).toBe(7);
    expect(c.ano).toBe(2026);
    expect(c.encerramentoPropostas).toBe('2026-09-14T08:59:00-03:00');
    expect(c.urlPncp).toBe('https://pncp.gov.br/app/editais/05054937000163/2026/56');
  });

  it('itens em ordem, orçamento sigiloso sem valor inventado', () => {
    const c = compra();
    expect(c.itens.map((i) => i.numero)).toEqual([1, 4, 5, 6]);
    expect(c.itens.every((i) => i.sigiloso && i.valorUnitarioEstimado === null)).toBe(true);
    expect(c.itens[0].unidade).toBe('Unidade');
    expect(c.itens[0].quantidade).toBe(34207);
    expect(c.itens[0].grupo).toBeNull();
  });
});

describe('na tela da disputa', () => {
  it('vira item da disputa com origem Compras.gov, sem piso e com a cota na descrição', () => {
    const itens = itensDaCompraParaDisputa(compra().itens);
    const item5 = itens.find((i) => i.numero === 5)!;
    expect(item5.descricao).toMatch(/\(Cota reservada para ME\/EPP\)$/);
    expect(item5.origem).toBe('comprasgov');
    expect(item5.valorMinimo).toBeNull();
    expect(item5.valorReferencia).toBe(0);
    expect(item5.valorEstimadoOrgao).toBeNull();
    expect(item5.lote).toBe('Único');
    expect(itens.find((i) => i.numero === 1)!.descricao).not.toMatch(/\(/);
  });

  it('item com valor publicado leva o estimado como referência e como teto', () => {
    const [item] = itensDaCompraParaDisputa([
      { ...compra().itens[0], sigiloso: false, valorUnitarioEstimado: 2500, grupo: 'Grupo 2' },
    ]);
    expect(item.valorReferencia).toBe(2500);
    expect(item.valorEstimadoOrgao).toBe(2500);
    expect(item.lote).toBe('Grupo 2');
  });

  it('data e horário da sessão saem do fim do prazo de propostas, em Brasília', () => {
    expect(sessaoDaCompra(compra())).toEqual({
      dataSessao: '2026-09-14',
      horario: '08:59',
      fonte: 'encerramento',
      horarioIncomum: false,
    });
  });

  it('resumo em texto', () => {
    const r = resumoDaCompra(compra());
    expect(r.titulo).toBe('Compra 7/2026');
    expect(r.linhas[0]).toBe('Pregão - Eletrônico · SRP · modo Aberto · Menor preço');
    expect(r.linhas[1]).toBe('SECRETARIA DE ESTADO DE EDUCACAO - PA (BELÉM/PA) · UASG 925315');
    expect(r.linhas).toContain('Propostas até 14/09/2026 às 08:59');
    expect(r.linhas.at(-1)).toBe('4 itens · orçamento sigiloso: o valor de cada item fica para a empresa preencher');
  });
});

describe('a disputa confere com a compra publicada', () => {
  const sessao = (iso: string) => Date.parse(iso);

  it('sessão logo depois do fim das propostas confere', () => {
    expect(divergenciaDaSessao(compra(), sessao('2026-09-14T09:00:00-03:00'))).toBeNull();
    expect(divergenciaDaSessao(compra(), sessao('2026-09-14T08:59:00-03:00'))).toBeNull();
  });

  it('outra data avisa com as duas, em Brasília', () => {
    expect(divergenciaDaSessao(compra(), sessao('2026-09-18T09:00:00-03:00'))).toBe(
      'O Compras.gov mostra propostas até 14/09/2026 às 08:59, e esta disputa está marcada para 18/09/2026 às 09:00. Confira se o pregão foi remarcado.',
    );
    // Antes do fim das propostas também não confere: o robô entraria cedo demais.
    expect(divergenciaDaSessao(compra(), sessao('2026-09-14T08:00:00-03:00'))).toMatch(/marcada para 14\/09\/2026 às 08:00/);
  });

  it('disputa sem data recebe a data publicada no aviso', () => {
    expect(divergenciaDaSessao(compra(), null)).toMatch(/propostas até 14\/09\/2026 às 08:59, e esta disputa está sem data/);
  });

  it('o botão de busca só acende com UASG e número/ano', () => {
    expect(podeBuscarCompra('925315', '07/2026')).toBe(true);
    expect(podeBuscarCompra('92531', '07/2026')).toBe(false);
    expect(podeBuscarCompra('925315', 'PE-007')).toBe(false);
    expect(podeBuscarCompra('925315', '123456/2026')).toBe(false);
  });
});
