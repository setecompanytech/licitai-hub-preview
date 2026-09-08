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

import { nomeExibido, type MembroExibivel } from '@/lib/equipe/nomeExibido';

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
 * Nome de exibição — delega à autoridade única (`nomeExibido`, da Equipe).
 *
 * Este arquivo tinha uma cópia própria que só olhava `nome`/`email` — e conta
 * criada por convite de setor grava o RÓTULO do setor em `nome` ("Setor
 * Comercial", igual para todos que entram pelo link). O seletor de relatórios
 * listava três "Setor Comercial" indistinguíveis (08/09); quem identifica a
 * pessoa são `nome_individual`/`login_individual`, que só a autoridade lê.
 */
export function nomeDoColaborador(membro: MembroExibivel): string {
  return nomeExibido(membro);
}
