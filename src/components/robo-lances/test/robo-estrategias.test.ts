import { describe, it, expect } from 'vitest';
import {
  estrategiaParaAgenteAntigo,
  estrategiasDoItem,
} from '../../../../supabase/functions/_shared/robo-estrategias';

/**
 * As estratégias cumulativas no webhook (17/09/2026): a lista vai ao agente
 * novo, e a mais ampla marcada vai em `estrategia` para o agente que ainda não
 * lê a lista — a troca de versão na VPS não pode deixar disputa sem lance.
 */
describe('estrategiasDoItem (webhook)', () => {
  it('lista gravada: sem repetição, na ordem de sempre', () => {
    expect(estrategiasDoItem({ estrategias: ['desempatar_1o', 'melhor_preco', 'melhor_preco'] })).toEqual([
      'melhor_preco',
      'desempatar_1o',
    ]);
  });

  it('disputa de antes: a estratégia única vira lista, e nada escolhido é melhor preço', () => {
    expect(estrategiasDoItem({ estrategia: 'iminencia' })).toEqual(['iminencia']);
    expect(estrategiasDoItem({})).toEqual(['melhor_preco']);
    expect(estrategiasDoItem(null)).toEqual(['melhor_preco']);
  });

  it('lista vazia continua vazia — desmarcar tudo não é escolher melhor preço', () => {
    expect(estrategiasDoItem({ estrategias: [], estrategia: 'melhor_preco' })).toEqual([]);
  });
});

describe('estrategiaParaAgenteAntigo', () => {
  it('manda a mais ampla marcada', () => {
    expect(estrategiaParaAgenteAntigo(['iminencia', 'desempatar_1o'])).toBe('iminencia');
    expect(estrategiaParaAgenteAntigo(['melhor_preco', 'iminencia', 'desempatar_1o'])).toBe('melhor_preco');
    expect(estrategiaParaAgenteAntigo(['desempatar_1o'])).toBe('desempatar_1o');
    expect(estrategiaParaAgenteAntigo([])).toBeNull();
  });
});
