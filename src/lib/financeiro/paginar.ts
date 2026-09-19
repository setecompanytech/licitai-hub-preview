/**
 * Busca TODAS as linhas de uma consulta, página a página.
 *
 * O PostgREST devolve no máximo `max-rows` linhas (padrão 1000) e um
 * `.limit(2000)` não passa disso — a consulta "termina" sem erro e sem aviso,
 * e o total da tela vira a soma de uma amostra. Foi assim que o "A receber"
 * saiu com dois valores diferentes em duas abas para a mesma carteira
 * (19/09/2026). `useIndicadoresCFO` já paginava; aqui a rotina vira uma só.
 *
 * `montar` recebe o intervalo (`de`, `ate`, inclusivo) e devolve a consulta já
 * com `.range(de, ate)`; a ordem estável é responsabilidade do chamador.
 */
export async function buscarTodos<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>,
  opcoes: { pagina?: number; maximoDePaginas?: number } = {},
): Promise<T[]> {
  const pagina = opcoes.pagina ?? 1000;
  const maximoDePaginas = opcoes.maximoDePaginas ?? 50;
  const tudo: T[] = [];
  for (let i = 0; i < maximoDePaginas; i++) {
    const de = i * pagina;
    const { data, error } = await montar(de, de + pagina - 1);
    if (error) throw error;
    const linhas = (data ?? []) as T[];
    tudo.push(...linhas);
    if (linhas.length < pagina) break;
  }
  return tudo;
}
