/**
 * A unidade do item como texto de tela.
 *
 * Um item importado chegou com a unidade gravada como o texto "null" (print
 * de 22/09: "Saldo qtd: 403.200 null", "R$ por null"). Vazio, nulo, "null",
 * "undefined" e traço não são unidade: viram vazio, e quem monta a frase
 * decide o que pôr no lugar ("unidade", nada).
 */
export function unidadeLegivel(u: string | null | undefined, padrao = ''): string {
  const t = String(u ?? '').trim();
  if (!t || /^(null|undefined|nil|none|-|—)$/i.test(t)) return padrao;
  return t;
}
