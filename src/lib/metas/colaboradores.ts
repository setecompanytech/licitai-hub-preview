/**
 * Quem entra no painel de Metas do Comercial.
 *
 * O `useColaboradores` devolve TODOS os membros da empresa, porque outras telas
 * precisam da lista inteira. Sem um recorte, o painel listava cada membro —
 * inclusive contas administrativas sem nome, que apareciam como cards vazios,
 * sem meta e com projeção zerada, e poluíam o seletor dos relatórios.
 *
 * Regra: é do painel quem pertence ao setor comercial **ou** quem tem meta
 * definida no período. A segunda parte existe para o gestor que recebe meta
 * sem estar no setor continuar aparecendo — e para a lista se autocorrigir:
 * definiu meta, entra; não tem meta nem é do comercial, some.
 */

export const SETOR_COMERCIAL = 'comercial';

export type MembroFiltravel = {
  user_id: string;
  equipe: string | null;
};

export function filtrarColaboradoresDoPainel<T extends MembroFiltravel>(
  membros: T[],
  userIdsComMeta: Iterable<string> = [],
): T[] {
  const comMeta = userIdsComMeta instanceof Set ? userIdsComMeta : new Set(userIdsComMeta);

  return membros.filter(
    (m) => m.equipe === SETOR_COMERCIAL || comMeta.has(m.user_id),
  );
}

/**
 * Nome de exibição. Cai no e-mail e, na falta dele, num rótulo explícito —
 * "Sem nome" é melhor que uma linha em branco que ninguém sabe identificar.
 */
export function nomeDoColaborador(
  membro: { nome?: string | null; email?: string | null },
): string {
  return membro.nome?.trim() || membro.email?.trim() || 'Sem nome';
}
