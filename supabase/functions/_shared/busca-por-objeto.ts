/**
 * Palavras que contam numa busca por objeto (22/09/2026): três letras ou
 * mais, sem repetição, na ordem em que vieram. As palavras vazias ("de",
 * "para") o dicionário português do Postgres já descarta; aqui só se tira o
 * que nem palavra é. Espelho em `src/lib/mercado/busca-por-objeto.ts` —
 * mudou aqui, muda lá.
 */
export function palavrasDaBusca(texto: string): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const palavra of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (palavra.length < 3 || vistas.has(palavra)) continue;
    vistas.add(palavra);
    saida.push(palavra);
  }
  return saida;
}

/** A consulta "qualquer palavra" do `websearch_to_tsquery`: `carne OR moida OR patinho`. */
export function consultaQualquerPalavra(texto: string): string {
  return palavrasDaBusca(texto).join(" OR ");
}
