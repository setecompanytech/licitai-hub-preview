/**
 * "Isto é meu?" — autoridade única sobre o escopo de trabalho do colaborador.
 *
 * A tela de Contratos abria mostrando tudo o que a empresa tinha, e o operador
 * do comercial via a carteira inteira dos colegas para achar a sua. O incômodo
 * é de organização, não de sigilo: financeiro emite nota, jurídico faz aditivo
 * e o administrador precisa do saldo total — todos legitimamente enxergam o
 * contrato alheio. Por isso o recorte vive aqui, na leitura da tela, e NÃO no
 * RLS: a versão de junho/2026 restringia por criador no banco
 * (`20260622000001_fix-contratos-rls-empresa.sql` desfez) e o efeito colateral
 * foi colega sem acesso ao que precisava para trabalhar.
 *
 * Regra de propriedade, na ordem:
 *   1. vendedor atribuído  — quem responde pelo contrato nas metas e na bonificação
 *   2. criador, se ninguém foi atribuído — senão o registro antigo (sem vendedor)
 *      sumiria para todo mundo, inclusive para quem o cadastrou
 */

export type RegistroAtribuivel = {
  vendedor_user_id?: string | null;
  user_id?: string | null;
};

export type EscopoResponsavel = 'meus' | 'todos' | (string & {});

export function ehMeu(r: RegistroAtribuivel, userId: string | null | undefined): boolean {
  if (!userId) return false;
  const vendedor = r.vendedor_user_id?.trim();
  return vendedor ? vendedor === userId : r.user_id === userId;
}

/** Responsável efetivo — o vendedor, ou o criador enquanto ninguém for atribuído. */
export function responsavelDe(r: RegistroAtribuivel): string | null {
  return r.vendedor_user_id?.trim() || r.user_id || null;
}

/**
 * Aplica o escopo escolhido. `todos` não filtra; `meus` usa a regra acima;
 * qualquer outro valor é o id de um colaborador (visão de gestão do admin).
 */
export function noEscopo<T extends RegistroAtribuivel>(
  registros: T[],
  escopo: EscopoResponsavel,
  userId: string | null | undefined,
): T[] {
  if (escopo === 'todos') return registros;
  if (escopo === 'meus') return registros.filter((r) => ehMeu(r, userId));
  return registros.filter((r) => responsavelDe(r) === escopo);
}
