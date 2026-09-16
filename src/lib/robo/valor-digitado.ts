/**
 * Valor em reais digitado na grade de itens da disputa → número.
 *
 * Existe por um defeito achado em 16/09/2026: piso e margem eram campos
 * controlados pelo NÚMERO, e cada tecla fazia a volta texto → número → texto.
 * "4999," virava 4999 e voltava à tela como "4999" — a vírgula sumia e o
 * próximo dígito entrava na parte inteira ("4999,70" virava 499970). O campo
 * agora guarda o texto enquanto a pessoa digita, e só o número vai ao estado.
 *
 * Vazio ou ilegível = `null` ("ninguém decidiu"), nunca zero.
 */
export function lerValorDigitado(texto: string): number | null {
  let limpo = texto.replace(/[^\d,.]/g, '');
  if (!limpo) return null;
  // Com vírgula, é o jeito brasileiro: ponto é milhar. Sem vírgula, ponto é decimal.
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

/** O número de volta para o campo, no jeito brasileiro ("4999,7"). */
export function valorParaDigitar(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}
