/**
 * A validação que IMPEDE a emissão — porque aqui ainda dá tempo.
 *
 * Política definida em 01/09, sobre o caso da NF-e emitida a R$ 22,50 num
 * contrato de R$ 22,55 que "seguiu sem intervenção humana": no lançamento
 * RETROATIVO o fato fiscal já existe e o sistema alerta sem barrar (a
 * auditoria da aba Pedidos). Na EMISSÃO é o contrário — a nota ainda não
 * existe, e barrar custa um clique; deixar passar custa uma nota errada no
 * mundo, um pagamento divergente e uma tarde de conferência contra o Portal.
 *
 * Prevenção antes, auditoria depois. Cada erro aponta o CAMPO, para a tela
 * pintar de vermelho onde está o problema — "não avança" sem dizer onde é
 * pior do que avançar.
 */

export type ErroDeFaturamento = {
  /**
   * Âncora do erro na tela: 'natureza', 'frete', 'geral',
   * 'pedido:<id>:quantidade' ou 'pedido:<id>:preco'.
   */
  campo: string;
  mensagem: string;
};

export type PedidoAFaturar = {
  id: string;
  numero_pedido: string;
  quantidade: number;
  valor_unitario: number;
  contrato_item_id: string | null;
  /** O que a pessoa digitou para faturar (parcial permitido). */
  quantidadeDigitada: string;
};

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function validarFaturamento(entrada: {
  natureza: string;
  pedidosSelecionados: PedidoAFaturar[];
  /** VU contratado por item, para conferir o preço contra o contrato. */
  vuPorItem: Record<string, number | null | undefined>;
  freteValor: string;
}): ErroDeFaturamento[] {
  const erros: ErroDeFaturamento[] = [];

  if (!entrada.natureza.trim()) {
    erros.push({ campo: 'natureza', mensagem: 'Falta a Natureza da Operação — a NF-e não existe sem ela.' });
  }

  if (entrada.pedidosSelecionados.length === 0) {
    erros.push({ campo: 'geral', mensagem: 'Selecione ao menos um pedido para faturar.' });
  }

  for (const p of entrada.pedidosSelecionados) {
    const qtd = Number(String(p.quantidadeDigitada).replace(',', '.'));

    if (!Number.isFinite(qtd) || qtd <= 0) {
      erros.push({
        campo: `pedido:${p.id}:quantidade`,
        mensagem: `Pedido ${p.numero_pedido}: quantidade inválida — informe um número maior que zero.`,
      });
    } else if (qtd > p.quantidade + 0.0001) {
      // Faturar mais do que o pedido registra é nota sem lastro: o pedido é o
      // teto do faturamento, e o contrato é o teto do pedido.
      erros.push({
        campo: `pedido:${p.id}:quantidade`,
        mensagem: `Pedido ${p.numero_pedido}: faturando ${qtd} de um pedido de ${p.quantidade} — `
          + `a nota não pode exceder o pedido.`,
      });
    }

    // O preço da emissão é conferido contra o CONTRATO. Divergiu, não emite:
    // se houve reajuste, ele se registra primeiro (e o VU do item acompanha);
    // se foi digitação, corrige-se o pedido. Emitir com preço errado é
    // exatamente o erro que passou "sem intervenção humana".
    const vuContratado = p.contrato_item_id
      ? Number(entrada.vuPorItem[p.contrato_item_id]) || 0
      : 0;
    if (vuContratado > 0 && Math.abs(p.valor_unitario - vuContratado) > 0.005) {
      erros.push({
        campo: `pedido:${p.id}:preco`,
        mensagem: `Pedido ${p.numero_pedido}: preço de ${brl(p.valor_unitario)}/un — o contrato prevê `
          + `${brl(vuContratado)}/un. Corrija o pedido, ou registre o reajuste no contrato antes de emitir.`,
      });
    }
  }

  const frete = Number(String(entrada.freteValor).replace(',', '.'));
  if (entrada.freteValor.trim() !== '' && (!Number.isFinite(frete) || frete < 0)) {
    erros.push({ campo: 'frete', mensagem: 'Valor de frete inválido — use um número maior ou igual a zero.' });
  }

  return erros;
}
