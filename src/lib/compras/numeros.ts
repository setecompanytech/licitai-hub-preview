/**
 * Números dos pedidos (28/09/2026): dinheiro digitado com máscara pt-BR e
 * quantidade vinda de campo numérico do navegador.
 *
 * O defeito que motivou o arquivo: a quantidade era lida com o mesmo parser
 * do dinheiro, que apaga pontos de milhar. O campo `type="number"` entrega
 * "818.21" (ponto decimal, sempre, seja qual for o idioma da tela); o parser
 * apagava o ponto e lia 81.821 — e o total saía 3.109.198,00 em vez de
 * 31.091,98. Puro: a tela só chama.
 */

/** "1.234,56" → 1234.56 (máscara pt-BR de dinheiro: ponto é milhar, vírgula é decimal). */
export function parseMoedaBr(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Quantidade: aceita "818.21" (campo numérico do navegador), "818,21" e
 * "1.234,5" (digitação pt-BR). Regra: com vírgula, o ponto é milhar; sem
 * vírgula, o ponto é decimal — o campo numérico nunca manda milhar.
 */
export function parseQuantidade(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** 1234.5 → "1.234,50" */
export function formatarMoedaBr(v: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0);
}

/** Máscara de dinheiro enquanto digita: só dígitos, os dois últimos são centavos. */
export function mascaraMoedaBr(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!d) return '0,00';
  return formatarMoedaBr(parseInt(d, 10) / 100);
}

/** Quantidade na tela: até 3 casas, sem zeros à toa ("818,21", "1.000", "0,5"). */
export function formatarQuantidade(v: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number.isFinite(v) ? v : 0);
}
