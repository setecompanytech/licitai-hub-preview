/**
 * Nome de exibição de um membro da empresa — autoridade única.
 *
 * Contas nascem por dois caminhos, e eles gravam coisas diferentes:
 *
 *  - **Convite direto** (pessoa nominal): `nome` recebe o nome da pessoa.
 *  - **Convite de setor** (link compartilhado): `nome` recebe o rótulo do
 *    SETOR ("Setor Comercial") — igual para todos os que entram por ele.
 *    Quem identifica a pessoa são `nome_individual` e `login_individual`,
 *    preenchidos por ela no cadastro.
 *
 * Sem consultar esses dois campos, três colegas do mesmo setor apareciam como
 * "Setor Comercial" e o recém-cadastrado parecia ausente da lista.
 */

export type MembroExibivel = {
  nome?: string | null;
  email?: string | null;
  nome_individual?: string | null;
  login_individual?: string | null;
};

export function nomeExibido(m: MembroExibivel | null | undefined): string {
  if (!m) return 'Colaborador';
  const pessoa = m.nome_individual?.trim();
  const login = m.login_individual?.trim();
  // Quem se cadastra costuma repetir o login no campo de nome; "COMERCIAL01
  // (COMERCIAL01)" não informa nada e ainda esconde a diferença entre dois
  // colegas. Iguais, mostra uma vez só.
  if (pessoa && login && pessoa.toLowerCase() === login.toLowerCase()) return login;
  if (pessoa && login) return `${pessoa} (${login})`;
  return pessoa || login || m.nome?.trim() || m.email?.trim() || 'Colaborador';
}

/** Iniciais para o avatar, derivadas do mesmo nome que a tela mostra. */
export function iniciaisDe(m: MembroExibivel | null | undefined): string {
  return nomeExibido(m).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 2).toUpperCase() || '?';
}
