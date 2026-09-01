/**
 * A auditoria dos lançamentos: o alerta que fica.
 *
 * O caso que a definiu (149/2024, 01/09/2026): uma NF-e emitida com valor
 * unitário errado — R$ 22,50 num contrato de R$ 22,55 — seguiu sem intervenção
 * humana, e a entrega acabou lançada DUAS vezes: a nota errada e a versão
 * paga. Dois pares assim somaram R$ 33.750 de consumo fantasma, e ninguém viu
 * até a soma não fechar com o Portal da Transparência.
 *
 * A política, definida pelo dono do produto:
 *
 *   NÃO BARRAR    erro humano é exceção legítima; o lançamento entra.
 *   ALERTAR       persistentemente, pedindo revisão — não um toast que morre
 *                 com o modal, mas um aviso que fica no contrato enquanto a
 *                 suspeita existir.
 *   MOSTRAR O     cada alerta diz quanto a suspeita representa em reais — sem
 *   IMPACTO       o número, "confira" é burocracia; com ele, é prioridade.
 *
 * E a matemática do sistema permanece exata: isto aqui é DERIVADO dos pedidos
 * a cada render, nunca gravado. Suspeita não é fato — é leitura sobre fatos —
 * e o dia em que os dados mudam, o alerta morre sozinho.
 */

export type PedidoParaAuditar = {
  id: string;
  numero_pedido: string;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  data_pedido: string | null;
  contrato_item_id: string | null;
  status?: string | null;
};

export type SuspeitaDePedido = {
  tipo: 'dupla_versao' | 'preco_divergente';
  /** Números dos pedidos envolvidos, para a frase apontar as linhas. */
  pedidos: string[];
  frase: string;
  /** O que a suspeita representa em reais — positivo = consumo a mais. */
  impacto: number;
  providencia: string;
};

/** Duas datas a até N dias uma da outra. */
const JANELA_DIAS = 45;

const brl = (n: number) =>
  Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dias = (a: string, b: string): number =>
  Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/**
 * Audita os pedidos de um contrato. Puro e derivado — chame a cada render.
 *
 * @param vuContratado o valor unitário do item do contrato, quando houver um
 *                     preço de referência (contrato de item único ou o VU do
 *                     item vinculado).
 */
export function auditarPedidos(
  pedidos: PedidoParaAuditar[],
  vuContratado?: number | null,
): SuspeitaDePedido[] {
  const suspeitas: SuspeitaDePedido[] = [];
  const ativos = pedidos.filter(
    (p) => p.status !== 'cancelado' && (Number(p.valor_total) || 0) > 0,
  );

  // ── Dupla versão da mesma entrega ─────────────────────────────────────────
  //
  // Mesmo item, MESMA quantidade, datas próximas, valores quase iguais e
  // números de pedido diferentes. É a assinatura da nota reemitida com preço
  // corrigido em que as DUAS versões entraram: o 002/003 e o 004/005 do
  // 149/2024, ao molde. Quantidades iguais são a chave — entregas distintas
  // do mesmo produto em dias próximos existem, mas com a mesma quantidade
  // exata e ~mesmo valor, a chance de ser a mesma entrega domina.
  for (let i = 0; i < ativos.length; i++) {
    for (let j = i + 1; j < ativos.length; j++) {
      const a = ativos[i];
      const b = ativos[j];
      if (!a.quantidade || a.quantidade !== b.quantidade) continue;
      if ((a.contrato_item_id ?? null) !== (b.contrato_item_id ?? null)) continue;
      if (!a.data_pedido || !b.data_pedido || dias(a.data_pedido, b.data_pedido) > JANELA_DIAS) continue;
      const va = Number(a.valor_total) || 0;
      const vb = Number(b.valor_total) || 0;
      const maior = Math.max(va, vb);
      if (maior <= 0 || Math.abs(va - vb) / maior > 0.02) continue;

      const duplicado = Math.min(va, vb);
      suspeitas.push({
        tipo: 'dupla_versao',
        pedidos: [a.numero_pedido, b.numero_pedido],
        frase: `Os pedidos ${a.numero_pedido} e ${b.numero_pedido} têm a MESMA quantidade `
          + `(${a.quantidade}) em datas próximas, com valores quase iguais — assinatura de `
          + `nota reemitida em que as duas versões entraram.`,
        impacto: duplicado,
        providencia: `Se for a mesma entrega, exclua a versão que não corresponde ao pagamento `
          + `recebido: o consumo do contrato cai ${brl(duplicado)}.`,
      });
    }
  }

  // ── Preço divergente do contratado ────────────────────────────────────────
  //
  // O VU do pedido difere do preço do contrato. Não barra — reajuste, desconto
  // e erro do emissor são todos possíveis — mas fica dito, com o impacto:
  // foi exatamente uma nota a R$ 22,50 num contrato de R$ 22,55 que passou
  // despercebida "sem intervenção humana".
  const vuRef = Number(vuContratado) || 0;
  if (vuRef > 0) {
    for (const p of ativos) {
      const vu = Number(p.valor_unitario) || 0;
      if (vu <= 0 || Math.abs(vu - vuRef) <= 0.005) continue;
      const impacto = (vu - vuRef) * (Number(p.quantidade) || 0);
      suspeitas.push({
        tipo: 'preco_divergente',
        pedidos: [p.numero_pedido],
        frase: `O pedido ${p.numero_pedido} saiu a ${brl(vu)}/un — o contrato prevê ${brl(vuRef)}/un.`,
        impacto,
        providencia: impacto >= 0
          ? `Faturado ${brl(impacto)} ACIMA do contratado. Confira se há reajuste registrado; sem ele, é cobrança indevida.`
          : `Faturado ${brl(impacto)} ABAIXO do contratado. Confira se foi desconto intencional ou erro de emissão da nota.`,
      });
    }
  }

  return suspeitas;
}
