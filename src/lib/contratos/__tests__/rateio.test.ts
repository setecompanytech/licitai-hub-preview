import { describe, it, expect } from 'vitest';
import {
  disponivelParaRatear, faltaAoPedido, parteParaOPedido, podeRatear, sugerirRateio,
  type RecebimentoRateavel, type PedidoRateavel,
} from '../rateio';

/** Um TED, seis notas — o caso da SEDUC de 27/05 (valores reais do lote, sem dado de pessoa). */
const ted: RecebimentoRateavel = { id: 'ted', status: 'conciliado', valor: 1819739.36, contrato_pedido_id: null, rateado: 0 };
const pedido = (id: string, valor_total: number, over: Partial<PedidoRateavel> = {}): PedidoRateavel =>
  ({ id, valor_total, recebidoPorRateio: 0, temTituloProprio: false, ...over });
const seis = [
  pedido('725', 97090.99), pedido('726', 684.99), pedido('727', 373015.11),
  pedido('728', 1343620.57), pedido('729', 2537.00), pedido('730', 2790.70),
];

describe('rateio — as contas', () => {
  it('a parte é o menor entre o que o recebimento tem e o que falta ao pedido', () => {
    expect(parteParaOPedido(ted, pedido('728', 1343620.57))).toBe(1343620.57);
    expect(parteParaOPedido({ ...ted, rateado: 1819000 }, pedido('728', 1343620.57))).toBe(739.36);
    expect(parteParaOPedido(ted, pedido('x', 100, { recebidoPorRateio: 60 }))).toBe(40);
  });

  it('seis notas cobrem exatamente o TED, sem sobra e sem centavo perdido', () => {
    const partes = sugerirRateio(ted, seis);
    expect(partes).toHaveLength(6);
    expect(Math.round(partes.reduce((s, p) => s + p.valor, 0) * 100) / 100).toBe(1819739.36);
    expect(disponivelParaRatear({ ...ted, rateado: partes.reduce((s, p) => s + p.valor, 0) })).toBe(0);
  });

  it('recebimento menor que as notas: o último pedido atendido leva o que sobrou e o resto fica de fora', () => {
    // 100.000,00 − 97.090,99 (725) − 684,99 (726) = 2.224,02 para a 727; 728 a 730 ficam sem nada.
    const partes = sugerirRateio({ ...ted, valor: 100000 }, seis);
    expect(partes.map((p) => p.pedido_id)).toEqual(['725', '726', '727']);
    expect(partes[2].valor).toBe(2224.02);
    expect(Math.round(partes.reduce((s, p) => s + p.valor, 0) * 100) / 100).toBe(100000);
  });

  it('pedido com título próprio e recebimento preso a pedido não rateiam, com o motivo dito', () => {
    expect(podeRatear(ted, pedido('x', 10, { temTituloProprio: true }))).toEqual({ pode: false, motivo: 'o pedido já tem título próprio no Financeiro' });
    expect(podeRatear({ ...ted, contrato_pedido_id: 'outro' }, pedido('x', 10))).toEqual({ pode: false, motivo: 'o recebimento já pertence a um pedido' });
    expect(podeRatear({ ...ted, status: 'previsto' }, pedido('x', 10))).toEqual({ pode: false, motivo: 'o recebimento ainda não foi baixado' });
    expect(podeRatear({ ...ted, rateado: ted.valor }, pedido('x', 10))).toEqual({ pode: false, motivo: 'o recebimento já foi todo distribuído' });
    expect(podeRatear(ted, pedido('x', 10, { recebidoPorRateio: 10 }))).toEqual({ pode: false, motivo: 'o pedido já está coberto' });
    expect(podeRatear(ted, pedido('725', 97090.99))).toEqual({ pode: true, parte: 97090.99 });
  });

  it('falta ao pedido nunca é negativa', () => {
    expect(faltaAoPedido(pedido('x', 10, { recebidoPorRateio: 12 }))).toBe(0);
  });
});
