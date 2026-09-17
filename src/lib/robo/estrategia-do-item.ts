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

/**
 * O campo "lance final (fechado)" aparece na grade?
 *
 * Só o modo **aberto e fechado** tem lance final fechado: um lance só, às
 * cegas, dado por quem o portal chamar. No "fechado e aberto" o sigilo é da
 * proposta, antes da etapa aberta, e não há lance final. Modo desconhecido
 * (cadastro manual, importação do Kanban) mostra o campo: esconder seria
 * decidir pela empresa que ele não existe.
 */
export function modoTemLanceFinalFechado(modoDisputa: string | null | undefined): boolean {
  const modo = String(modoDisputa ?? '').trim();
  if (!modo) return true;
  return /aberto\s*(e|-|\/)\s*fechado/i.test(modo);
}

/**
 * As estratégias marcadas no item — CUMULATIVAS desde 17/09/2026.
 *
 * O Rafael, dono do produto, na tela do cadastro: "são as 3 opções que o
 * usuário escolhe — ele pode escolher as 3 ou somente 2 ou somente 1", como no
 * ConLicitação. O robô cobre o 1º colocado quando qualquer marcada autoriza
 * (ver `estrategiasDoItem` em `lib/agent-template/estrategia.ts`).
 *
 * `estrategias` (lista) é o formato novo; `estrategia` (uma só) é o de antes,
 * e continua valendo para a disputa cadastrada antes. Nada escolhido = melhor
 * preço, como sempre foi. Lista vazia continua vazia: a grade não deixa salvar.
 *
 * ESPELHO: `supabase/functions/_shared/robo-estrategias.ts` e o agente.
 */
export function estrategiasDoItem(item: { estrategias?: readonly string[] | null; estrategia?: string | null } | null | undefined): EstrategiaDoItem[] {
  const ordem = ESTRATEGIAS_DO_ITEM.map((e) => e.id as string);
  const lista = item?.estrategias;
  if (Array.isArray(lista)) {
    return ordem.filter((id) => lista.includes(id)) as EstrategiaDoItem[];
  }
  const uma = String(item?.estrategia ?? '').trim();
  return (ordem.includes(uma) ? [uma] : ['melhor_preco']) as EstrategiaDoItem[];
}

/**
 * A estratégia única gravada junto da lista, para quem ainda lê só
 * `estrategia` (o agente antes da troca na VPS): a mais ampla marcada.
 */
export function estrategiaUnicaDe(lista: readonly EstrategiaDoItem[]): EstrategiaDoItem | undefined {
  if (lista.includes('melhor_preco')) return 'melhor_preco';
  if (lista.includes('iminencia')) return 'iminencia';
  return lista.includes('desempatar_1o') ? 'desempatar_1o' : undefined;
}

export interface AvisosDaGrade {
  /** Itens sem piso próprio, quando a disputa também não tem piso geral. */
  semPiso: number;
  /** Itens com todas as estratégias desmarcadas: impedem salvar. */
  semEstrategia: number;
  /** "Desempatar no 1º lugar" sem margem: aguardam. */
  semMargem: number;
  /**
   * "Iminência" sem "Melhor preço" no Compras.gov: o robô ainda não lê o
   * tempo restante da sala (só a sala logada mostra, e ela não foi mapeada),
   * então a iminência não dá lance. Achado na auditoria de 16/09/2026.
   */
  iminenciaSemTempo: number;
  /** Lance final fechado abaixo do piso do item: o robô não dá esse lance. */
  lanceFinalAbaixoDoPiso: number;
}

/** O que a grade de itens avisa antes de salvar — sem impedir o salvamento. */
export function avisosDaGrade(e: {
  itens: ReadonlyArray<{
    valorMinimo?: number | null;
    estrategias?: readonly string[] | null;
    estrategia?: string | null;
    margemDesempate?: number | null;
    lanceFinalFechado?: number | null;
  }>;
  pisoGeral: number | null | undefined;
  ehComprasGov: boolean;
}): AvisosDaGrade {
  const positivo = (v: unknown) => Number(v) > 0;
  const semPisoGeral = !positivo(e.pisoGeral);
  const marcadas = e.itens.map((i) => estrategiasDoItem(i));
  return {
    semPiso: semPisoGeral ? e.itens.filter((i) => !positivo(i.valorMinimo)).length : 0,
    semEstrategia: marcadas.filter((m) => m.length === 0).length,
    semMargem: e.itens.filter((i, idx) => marcadas[idx].includes('desempatar_1o') && !positivo(i.margemDesempate)).length,
    iminenciaSemTempo: e.ehComprasGov
      ? marcadas.filter((m) => m.includes('iminencia') && !m.includes('melhor_preco')).length
      : 0,
    lanceFinalAbaixoDoPiso: e.itens.filter((i) => {
      if (!positivo(i.lanceFinalFechado)) return false;
      const piso = positivo(i.valorMinimo) ? Number(i.valorMinimo) : positivo(e.pisoGeral) ? Number(e.pisoGeral) : null;
      return piso !== null && Number(i.lanceFinalFechado) < piso;
    }).length,
  };
}

/** Nome da estratégia para leitura; item sem escolha é melhor preço. */
export function nomeDaEstrategia(id: string | null | undefined): string {
  return ESTRATEGIAS_DO_ITEM.find((e) => e.id === (id || 'melhor_preco'))?.nome ?? String(id);
}

/** As marcadas, para leitura: "Melhor preço + Iminência". */
export function nomesDasEstrategias(lista: readonly string[]): string {
  return lista.length ? lista.map((id) => nomeDaEstrategia(id)).join(' + ') : 'Nenhuma estratégia';
}

/**
 * O limite de lances para leitura. Sem limite não é "0" nem "null" na tela: é
 * a decisão de disputar até o piso de cada item.
 */
export function textoDoLimiteDeLances(maxLances: number | null | undefined): string {
  return maxLances && maxLances > 0 ? String(maxLances) : 'Sem limite (até o piso)';
}
