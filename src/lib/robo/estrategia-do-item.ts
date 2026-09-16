/**
 * O que a tela oferece para configurar a disputa de UM item, e como mostra o
 * limite de lances.
 *
 * A regra de cada estratégia mora no agente, em
 * `src/lib/agent-template/estrategia.ts` (`ESTRATEGIAS`), e é lá que ela é
 * testada. Esta lista só nomeia a escolha para quem cadastra — e tem de ter os
 * mesmos ids: um id que o agente não conhece faz o robô aguardar em vez de dar
 * lance, e o teste `estrategia.test.ts` confere que as duas listas batem.
 */

export type EstrategiaDoItem = 'melhor_preco' | 'iminencia' | 'desempatar_1o';

export const ESTRATEGIAS_DO_ITEM: ReadonlyArray<{ id: EstrategiaDoItem; nome: string; explicacao: string }> = [
  {
    id: 'melhor_preco',
    nome: 'Melhor preço',
    explicacao: 'Cobre o 1º lugar sempre que a empresa não estiver nele, sem passar do piso.',
  },
  {
    id: 'iminencia',
    nome: 'Iminência',
    explicacao: 'Só dá lance nos 2 minutos finais da etapa aberta, sem passar do piso.',
  },
  {
    id: 'desempatar_1o',
    nome: 'Desempatar no 1º lugar',
    explicacao:
      'Só cobre o 1º lugar quando ele está perto: a diferença até o lance da empresa cabe na margem em reais do item. Mais longe que isso, não persegue.',
  },
];

/** Nome da estratégia para leitura; item sem escolha é melhor preço. */
export function nomeDaEstrategia(id: string | null | undefined): string {
  return ESTRATEGIAS_DO_ITEM.find((e) => e.id === (id || 'melhor_preco'))?.nome ?? String(id);
}

/**
 * O limite de lances para leitura. Sem limite não é "0" nem "null" na tela: é
 * a decisão de disputar até o piso de cada item.
 */
export function textoDoLimiteDeLances(maxLances: number | null | undefined): string {
  return maxLances && maxLances > 0 ? String(maxLances) : 'Sem limite (até o piso)';
}
