/**
 * Rateio de um recebimento entre pedidos — as contas puras (22/09/2026).
 *
 * Órgão público paga várias notas num TED só. Um lançamento aponta para um
 * pedido, então o crédito grande fica sem dono, e cada pedido fica sem
 * recebimento. O rateio dá a cada pedido a sua parte do mesmo crédito, sem
 * dividir o lançamento (que continua conciliado ao movimento do banco).
 *
 * As regras que o banco impõe (migration 20260922000001) valem aqui, para a
 * tela mostrar o que vai acontecer antes de chamar a RPC: a parte é o menor
 * entre o que o recebimento ainda tem e o que falta ao pedido; recebimento
 * já preso a um pedido, ou pedido com título próprio, não entram.
 */

export type RecebimentoRateavel = {
  id: string;
  status: string;
  valor: number;
  contrato_pedido_id: string | null;
  /** Soma das partes já distribuídas a outros pedidos. */
  rateado: number;
};

export type PedidoRateavel = {
  id: string;
  valor_total: number;
  /** O que este pedido já recebe por rateio de outros recebimentos. */
  recebidoPorRateio: number;
  /** Tem título próprio no Financeiro (previsto ou pago)? Então não rateia. */
  temTituloProprio: boolean;
};

const arredonda = (v: number) => Math.round(v * 100) / 100;

/** O que o recebimento ainda pode distribuir. */
export function disponivelParaRatear(r: RecebimentoRateavel): number {
  return arredonda(Math.max(0, (Number(r.valor) || 0) - (Number(r.rateado) || 0)));
}

/** O que ainda falta ao pedido para ficar coberto. */
export function faltaAoPedido(p: PedidoRateavel): number {
  return arredonda(Math.max(0, (Number(p.valor_total) || 0) - (Number(p.recebidoPorRateio) || 0)));
}

/** A parte que este recebimento entrega a este pedido: o menor dos dois. */
export function parteParaOPedido(r: RecebimentoRateavel, p: PedidoRateavel): number {
  return arredonda(Math.min(disponivelParaRatear(r), faltaAoPedido(p)));
}

export type PodeRatear = { pode: true; parte: number } | { pode: false; motivo: string };

/**
 * Pode ratear? Diz por que não, quando não pode — a tela mostra o motivo em
 * vez de esconder o botão em silêncio.
 */
export function podeRatear(r: RecebimentoRateavel, p: PedidoRateavel): PodeRatear {
  if (r.status !== 'realizado' && r.status !== 'conciliado') {
    return { pode: false, motivo: 'o recebimento ainda não foi baixado' };
  }
  if (r.contrato_pedido_id) {
    return { pode: false, motivo: 'o recebimento já pertence a um pedido' };
  }
  if (p.temTituloProprio) {
    return { pode: false, motivo: 'o pedido já tem título próprio no Financeiro' };
  }
  const parte = parteParaOPedido(r, p);
  if (parte <= 0) {
    return {
      pode: false,
      motivo: disponivelParaRatear(r) <= 0 ? 'o recebimento já foi todo distribuído' : 'o pedido já está coberto',
    };
  }
  return { pode: true, parte };
}

/**
 * Distribui um recebimento entre vários pedidos, na ordem dada, até acabar:
 * cada pedido leva o que lhe falta, o último leva o que sobrou. Para o lote
 * "um TED, seis notas".
 */
export function sugerirRateio(r: RecebimentoRateavel, pedidos: PedidoRateavel[]): Array<{ pedido_id: string; valor: number }> {
  let sobra = disponivelParaRatear(r);
  const partes: Array<{ pedido_id: string; valor: number }> = [];
  for (const p of pedidos) {
    if (sobra <= 0) break;
    if (p.temTituloProprio) continue;
    const parte = arredonda(Math.min(sobra, faltaAoPedido(p)));
    if (parte <= 0) continue;
    partes.push({ pedido_id: p.id, valor: parte });
    sobra = arredonda(sobra - parte);
  }
  return partes;
}
