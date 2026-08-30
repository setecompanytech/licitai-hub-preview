import { describe, it, expect } from 'vitest';
import { sequencialDe, proximoNumeroDePedido } from '@/lib/contratos/numero-do-pedido';

describe('sequencialDe', () => {
  it('lê número simples', () => {
    expect(sequencialDe('8')).toBe(8);
    expect(sequencialDe('008')).toBe(8);
  });

  it('lê o ÚLTIMO grupo de dígitos, não todos', () => {
    // "P-2026-001" vale 1. Somando todos os dígitos daria 2026001, e o
    // primeiro pedido no formato antigo empurraria a sequência para a casa
    // dos milhões sem volta.
    expect(sequencialDe('P-2026-001')).toBe(1);
    expect(sequencialDe('OF 2026/047')).toBe(47);
  });

  it('devolve null para o que não tem número', () => {
    expect(sequencialDe('sem número')).toBeNull();
    expect(sequencialDe('')).toBeNull();
    expect(sequencialDe(null)).toBeNull();
  });
});

describe('proximoNumeroDePedido', () => {
  it('continua a sequência que já existe', () => {
    // O caso real do contrato 008/2026: pedidos 5, 6, 7 e 8 vindos do Kanban.
    expect(proximoNumeroDePedido(['5', '6', '7', '8'])).toBe('009');
  });

  it('contrato vazio começa em 001', () => {
    expect(proximoNumeroDePedido([])).toBe('001');
  });

  it('não repete número quando um pedido foi apagado', () => {
    // O gerador antigo usava count(*): apagado o pedido 2, o próximo voltava a
    // ser 3 e colidia. Aqui o maior manda.
    expect(proximoNumeroDePedido(['001', '003'])).toBe('004');
  });

  it('convive com as duas numerações antigas sem explodir', () => {
    expect(proximoNumeroDePedido(['5', 'P-2026-001', '8'])).toBe('009');
  });

  it('ignora o que não tem número', () => {
    expect(proximoNumeroDePedido(['sem número', '', null, '2'])).toBe('003');
  });

  it('passa de 999 sem quebrar — o preenchimento é mínimo, não teto', () => {
    expect(proximoNumeroDePedido(['999'])).toBe('1000');
  });
});
