/**
 * O que segura estoque — a definição, num lugar só.
 *
 * O estoque do sistema tem UMA coluna: `produtos.saldo_atual`. Não existe
 * `saldo_reservado` nem `saldo_disponivel` no banco. "Reservado" e
 * "disponível" são derivados, e a derivação é esta: pedido de contrato que
 * ainda não fechou segura a quantidade dele.
 *
 * A regra nasceu na aba Pedidos do contrato e, em 13/09, a aba Estoque de
 * Compras passou a mostrar as mesmas três colunas. As duas telas consultam de
 * formas diferentes — uma parte dos produtos que já tem em mão, a outra varre
 * a empresa inteira —, e tentar unificar as consultas só criaria um helper com
 * dois modos. O que NÃO pode divergir é o critério: se um dia `'separado'`
 * passar a segurar estoque e só uma das telas souber, o mesmo produto terá
 * dois saldos disponíveis no mesmo sistema, e nenhum dos dois estará errado do
 * ponto de vista de quem leu o código.
 *
 * É o mesmo raciocínio do princípio 1 do CLAUDE.md, aplicado a saldo em vez de
 * status: vocabulário único, consulta de cada um.
 */

/**
 * Situações de `contrato_pedidos` que seguram quantidade.
 *
 * `pendente` — o pedido existe e nada saiu.
 * `parcial`  — saiu parte; o resto continua comprometido.
 *
 * Fora daqui ficam `atendido` (já baixou) e `cancelado` (não vai baixar).
 */
export const STATUS_QUE_RESERVAM = ['pendente', 'parcial'] as const;

/**
 * O que sobra para vender ou empenhar.
 *
 * Devolve `null` quando a reserva não foi apurada — e `null` não é zero: zero
 * afirma que nada segura o produto, `null` diz que o sistema não conferiu. A
 * distinção é exigência escrita do comando de 13/09, e é a diferença entre
 * "pode vender 100" e "não sei quanto pode vender".
 */
export function disponivelDe(fisico: number, reservado: number | null): number | null {
  if (reservado === null) return null;
  return fisico - reservado;
}

/** Como a procedência do número é explicada na tela, sem repetir a frase. */
export const ORIGEM_DA_RESERVA =
  'Reservado = pedidos de contrato pendentes ou parciais · Disponível = físico − reservado. ' +
  'Não são colunas do estoque: o sistema guarda só o saldo físico.';
