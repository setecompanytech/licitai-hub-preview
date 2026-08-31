import { describe, it, expect } from 'vitest';
import { readequarComADisputa } from '@/lib/proposta/readequar';
import type { EditalItem } from '@/components/proposta/EditalUploader';
import type { DisputeItem } from '@/components/robo-lances/ConfigurarLanceDialog';

/**
 * A readequação troca o preço da proposta pelo que foi negociado no pregão.
 * O que se testa aqui é sobretudo o que ela NÃO faz: não acrescenta linha, não
 * inventa preço para item que não teve lance, e não usa o lance do concorrente.
 */

function itemProposta(over: Partial<EditalItem> = {}): EditalItem {
  return {
    item: '1',
    descricao: 'Caneta esferográfica azul',
    quantidade: '10',
    unidade: 'UN',
    marca: 'BIC',
    fabricante: '',
    modelo: '',
    valorUnitario: '5,00',
    valorUnitarioExtenso: 'cinco reais',
    valorTotal: '50,00',
    valorTotalExtenso: 'cinquenta reais',
    ...over,
  };
}

function itemDisputa(over: Partial<DisputeItem> = {}): DisputeItem {
  return {
    id: 'a',
    numero: 1,
    descricao: 'Caneta esferográfica azul',
    quantidade: 10,
    unidade: 'UN',
    valorReferencia: 5,
    valorMinimo: 3,
    lote: '',
    disputando: false,
    situacao: 'encerrado',
    melhorLance: null,
    seuUltimoLance: null,
    ...over,
  };
}

describe('readequarComADisputa', () => {
  it('troca o preço unitário pelo nosso lance final e recalcula o total', () => {
    const r = readequarComADisputa(
      [itemProposta()],
      [itemDisputa({ seuUltimoLance: 3.5 })],
    );

    expect(r.itens[0].valorUnitario).toBe('3,50');
    expect(r.itens[0].valorTotal).toBe('35,00'); // 3,50 × 10
    expect(r.readequados).toEqual(['1']);
    expect(r.semLance).toEqual([]);
    expect(r.semPar).toEqual([]);
  });

  it('recalcula também o valor por extenso das duas colunas', () => {
    const r = readequarComADisputa(
      [itemProposta()],
      [itemDisputa({ seuUltimoLance: 3.5 })],
    );

    expect(r.itens[0].valorUnitarioExtenso).not.toBe('cinco reais');
    expect(r.itens[0].valorUnitarioExtenso).toContain('três reais');
    expect(r.itens[0].valorTotalExtenso).toContain('trinta e cinco reais');
  });

  it('NUNCA usa melhorLance — ele pode ser o lance do concorrente', () => {
    const r = readequarComADisputa(
      [itemProposta()],
      [itemDisputa({ melhorLance: 2.1, seuUltimoLance: null })],
    );

    // O preço original permanece: sem lance NOSSO, não há o que readequar.
    expect(r.itens[0].valorUnitario).toBe('5,00');
    expect(r.readequados).toEqual([]);
    expect(r.semLance).toEqual(['1']);
  });

  it('mantém o item que casou mas não foi disputado, e o declara', () => {
    const r = readequarComADisputa(
      [itemProposta({ item: '2' })],
      [itemDisputa({ numero: 2, seuUltimoLance: null })],
    );

    expect(r.itens[0].valorUnitario).toBe('5,00');
    expect(r.semLance).toEqual(['2']);
  });

  it('trata lance zerado ou negativo como ausência de lance', () => {
    const zero = readequarComADisputa([itemProposta()], [itemDisputa({ seuUltimoLance: 0 })]);
    expect(zero.semLance).toEqual(['1']);

    const negativo = readequarComADisputa([itemProposta()], [itemDisputa({ seuUltimoLance: -1 })]);
    expect(negativo.semLance).toEqual(['1']);
  });

  it('não acrescenta linha: item da disputa sem par vira aviso, não item novo', () => {
    const r = readequarComADisputa(
      [itemProposta({ item: '1' })],
      [
        itemDisputa({ numero: 1, seuUltimoLance: 3 }),
        itemDisputa({ id: 'b', numero: 9, seuUltimoLance: 7 }),
      ],
    );

    expect(r.itens).toHaveLength(1);
    expect(r.semPar).toEqual(['9']);
  });

  it('casa "01" com 1 — os dois lados grafam o número de formas diferentes', () => {
    const r = readequarComADisputa(
      [itemProposta({ item: '01' })],
      [itemDisputa({ numero: 1, seuUltimoLance: 4 })],
    );

    expect(r.readequados).toEqual(['01']);
    expect(r.itens[0].valorUnitario).toBe('4,00');
  });

  it('lê quantidade escrita com vírgula ao calcular o total', () => {
    const r = readequarComADisputa(
      [itemProposta({ quantidade: '2,5' })],
      [itemDisputa({ seuUltimoLance: 4 })],
    );

    expect(r.itens[0].valorTotal).toBe('10,00'); // 4 × 2,5
  });

  it('deixa intacto o item da proposta que não está na disputa', () => {
    const r = readequarComADisputa(
      [itemProposta({ item: '1' }), itemProposta({ item: '2', valorUnitario: '9,00' })],
      [itemDisputa({ numero: 1, seuUltimoLance: 3 })],
    );

    expect(r.itens[1].valorUnitario).toBe('9,00');
    expect(r.readequados).toEqual(['1']);
    expect(r.semLance).toEqual([]);
  });

  it('não altera os itens recebidos — devolve cópias', () => {
    const original = itemProposta();
    const r = readequarComADisputa([original], [itemDisputa({ seuUltimoLance: 3.5 })]);

    expect(original.valorUnitario).toBe('5,00');
    expect(r.itens[0]).not.toBe(original);
  });
});
