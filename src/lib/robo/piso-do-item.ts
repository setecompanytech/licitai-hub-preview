/**
 * O piso de um item quando a disputa tem UM item só.
 *
 * Decisão de 17/09: com um item, a coluna "Piso" da grade some — ela repetia,
 * por unidade, o mesmo número que o cartão "Valor mínimo (piso)" traz no
 * total. O piso do item passa a ser derivado do cartão: total ÷ quantidade,
 * em centavos. Com dois ou mais itens, cada um mantém o próprio piso (a
 * coluna continua), porque as margens diferem item a item.
 *
 * Sem total positivo ou sem quantidade, devolve `null`: piso ausente é
 * informação ("ninguém decidiu"), nunca zero.
 */
export function pisoUnitarioDoItemUnico(
  valorMinimoTotal: number | string | null | undefined,
  quantidade: number | string | null | undefined,
): number | null {
  const total = Number(valorMinimoTotal);
  const q = Number(quantidade);
  if (!(total > 0) || !(q > 0)) return null;
  return Math.round((total / q) * 100) / 100;
}
