import { describe, expect, it } from 'vitest';
import { buscarTodos } from './paginar';

/**
 * O contrato que as listas do Financeiro passaram a depender (21/09):
 * a consulta volta INTEIRA, sem teto silencioso, e para na primeira página
 * incompleta — não faz uma chamada a mais depois da última linha.
 */
function fonte(total: number, pagina: number) {
  const chamadas: Array<[number, number]> = [];
  const montar = async (de: number, ate: number) => {
    chamadas.push([de, ate]);
    const linhas = Array.from({ length: total }, (_, i) => ({ id: i })).slice(de, ate + 1);
    return { data: linhas, error: null };
  };
  return { montar, chamadas, pagina };
}

describe('buscarTodos — a lista inteira, página a página', () => {
  it('714 títulos com página de 500 voltam os 714, em duas páginas', async () => {
    // O caso da ETHOS: 714 títulos a pagar e um `.limit(500)` que omitia 214.
    const f = fonte(714, 500);
    const tudo = await buscarTodos<{ id: number }>(f.montar, { pagina: 500 });
    expect(tudo).toHaveLength(714);
    expect(tudo[713].id).toBe(713);
    expect(f.chamadas).toEqual([[0, 499], [500, 999]]);
  });

  it('página cheia exata pede uma página a mais, que volta vazia, e para', async () => {
    const f = fonte(1000, 1000);
    const tudo = await buscarTodos<{ id: number }>(f.montar, { pagina: 1000 });
    expect(tudo).toHaveLength(1000);
    expect(f.chamadas).toEqual([[0, 999], [1000, 1999]]);
  });

  it('lista vazia faz uma chamada só', async () => {
    const f = fonte(0, 1000);
    expect(await buscarTodos(f.montar)).toEqual([]);
    expect(f.chamadas).toEqual([[0, 999]]);
  });

  it('erro do banco não vira lista parcial: propaga', async () => {
    const montar = async () => ({ data: null, error: { message: 'permission denied' } });
    await expect(buscarTodos(montar)).rejects.toEqual({ message: 'permission denied' });
  });

  it('respeita o teto de páginas como última defesa contra laço infinito', async () => {
    const f = fonte(10_000, 100);
    const tudo = await buscarTodos<{ id: number }>(f.montar, { pagina: 100, maximoDePaginas: 3 });
    expect(tudo).toHaveLength(300);
    expect(f.chamadas).toHaveLength(3);
  });
});
