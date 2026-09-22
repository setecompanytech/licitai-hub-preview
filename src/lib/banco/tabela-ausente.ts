/**
 * A tabela (ou função) ainda não existe no banco?
 *
 * As migrations deste repo são coladas à mão no SQL Editor, então o front
 * pode chegar ao ar antes do SQL. Nesse intervalo, "tabela ausente" não é
 * falha a denunciar em vermelho para toda empresa: é a funcionalidade nova
 * que ainda não ligou — a tela diz isso, discretamente, e segue de pé.
 *
 * 42P01 é o código do Postgres para relação inexistente; PGRST205 e PGRST202
 * são os do PostgREST quando a tabela ou a função não está no cache de
 * esquema. A mensagem cobre o caso em que o código não vem.
 *
 * Qualquer OUTRO erro continua sendo erro de verdade (princípio 3): mensagem
 * real na tela, com o caminho de volta.
 */
export interface ErroDoBanco {
  code?: string | null;
  message?: string | null;
}

export function tabelaAusente(erro: ErroDoBanco | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code === '42P01' || erro.code === 'PGRST205' || erro.code === 'PGRST202') return true;
  return /does not exist|could not find the (table|function)|schema cache/i.test(erro.message ?? '');
}
