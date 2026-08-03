/**
 * Conversão entre o dinheiro do banco e o dinheiro do motor.
 *
 * O banco guarda `numeric(14,2)` em REAIS; o motor de projeção trabalha em
 * CENTAVOS INTEIROS (ver o cabeçalho de `projecao.ts`). A fronteira entre os
 * dois mundos é só aqui — nenhum outro arquivo deve multiplicar por 100 solto.
 */

/** Reais (como vêm do Supabase) → centavos inteiros. */
export function paraCentavos(reais: number | string | null | undefined): number {
  const n = typeof reais === 'string' ? parseFloat(reais) : reais;
  if (n === null || n === undefined || Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Centavos inteiros → reais, para entregar ao `formatBRL`. */
export function paraReais(centavos: number): number {
  return centavos / 100;
}

/**
 * Texto digitado no formato brasileiro → reais.
 * Aceita "300.000,00", "300000,50" e "300000".
 */
export function parseValorBRL(texto: string): number {
  const limpo = texto.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? 0 : n;
}
