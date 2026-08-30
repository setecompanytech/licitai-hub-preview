/**
 * O próximo número de pedido de um contrato.
 *
 * Havia duas numerações convivendo no mesmo contrato: os pedidos vindos do
 * Kanban chegam com número simples (5, 6, 7, 8) e o diálogo local gerava
 * `P-2026-001`. Duas sequências paralelas para a mesma coisa, e nenhuma
 * continuando a outra.
 *
 * Pior: o gerador antigo usava `count(*)` do contrato. Apagado um pedido, o
 * número seguinte repetia o de alguém — e o número do pedido é o que aparece
 * na descrição do lançamento financeiro, na NF e no ofício ao órgão. Número
 * repetido ali não é detalhe de tela.
 *
 * A regra agora é uma só: **continua de onde o maior parou**, com três dígitos.
 */

/**
 * O valor numérico de um número de pedido.
 *
 * Lê o ÚLTIMO grupo de dígitos, não todos. "P-2026-001" vale 1, não 2026001 —
 * senão o primeiro pedido gerado no formato antigo empurraria a sequência para
 * a casa dos milhões e nunca mais voltaria.
 */
export function sequencialDe(numero: string | null | undefined): number | null {
  const m = String(numero ?? '').trim().match(/(\d+)\s*$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * O próximo da sequência, com três dígitos.
 *
 * Continua a numeração que já existe em vez de abrir outra — num contrato que
 * vem do Kanban com 5, 6, 7 e 8, o próximo é 009, não 001. Quem lê a lista vê
 * uma sequência só.
 *
 * Passa de 999 sem quebrar: o preenchimento é mínimo, não teto.
 */
export function proximoNumeroDePedido(existentes: Array<string | null | undefined>): string {
  const maior = existentes.reduce<number>((m, n) => {
    const v = sequencialDe(n);
    return v !== null && v > m ? v : m;
  }, 0);
  return String(maior + 1).padStart(3, '0');
}
