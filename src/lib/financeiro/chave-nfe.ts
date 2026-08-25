/**
 * A chave de acesso da NF-e tem quarenta e quatro dígitos. Sempre.
 *
 * O banco sabe disso desde abril: `chk_fl_chave_nfe_44` exige
 * `^[0-9]{44}$` ou nulo. O aplicativo é que não sabia — mandava para lá o que
 * a extração devolvesse, e a extração de PDF é feita por IA lendo uma imagem.
 *
 * Quando a IA lê um DANFE e não acha a chave, ela às vezes devolve o que se
 * PARECE com uma: o número da nota ("000.000.692"), um pedaço da chave, o
 * protocolo de autorização. Nenhum tem 44 dígitos, e o INSERT era recusado
 * pelo banco — com a mensagem `violates check constraint "chk_fl_chave_nfe_44"`
 * caindo em cima de quem só queria lançar uma nota de carne moída.
 *
 * A restrição estava certa; quem estava errado era quem a desrespeitava. Aqui
 * a chave só passa se for chave: 44 dígitos depois de retirados pontos,
 * espaços e traços. Qualquer outra coisa vira nulo — porque uma chave errada
 * é pior do que nenhuma. Ela vai para o índice, casa com nota que não é
 * aquela, e a duplicidade que a chave existe para impedir passa a ser causada
 * por ela.
 */

/** A chave, se for uma. Nulo em qualquer outro caso. */
export function normalizarChaveNfe(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos.length === 44 ? digitos : null;
}

/**
 * A extração devolveu algo no lugar da chave, mas não era uma chave?
 *
 * Serve para a tela poder dizer "a IA leu 9 dígitos onde deveria haver 44" em
 * vez de descartar calada. Quem revisa o documento precisa saber que aquele
 * campo ficou vazio de propósito.
 */
export function chaveNfeSuspeita(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos.length > 0 && digitos.length !== 44;
}
