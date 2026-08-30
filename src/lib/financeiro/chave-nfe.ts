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

// ─────────────────────────────────────────────────────────────────────────────
// O NÚMERO da nota — que não é a chave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Os dígitos do número, tirando o ano quando ele vem depois da barra.
 *
 * "125/2026" é como se escreve "nota 125 do ano 2026" — e concatenar tudo
 * daria 1252026, uma nota que não existe. A regra é estreita de propósito:
 * só descarta 19xx ou 20xx NO FIM, depois de barra. "1252026" escrito sem
 * barra continua intacto, porque aí é mesmo o número.
 */
function digitosDoNumero(valor: unknown): string {
  const texto = String(valor ?? '').trim().replace(/\/\s*(19|20)\d{2}\s*$/, '');
  return texto.replace(/\D+/g, '');
}

/**
 * O número da NF-e no formato do DANFE: `000.000.001`.
 *
 * O campo é texto livre e recebe de tudo — "125", "NF 000000125", "nfe
 * 000.000.125", "Nota 125/2026". Três grafias do mesmo número na mesma
 * coluna fazem quem confere procurar diferença onde não há, e impedem
 * ordenar a lista pela sequência.
 *
 * A NF-e tem número de até 9 dígitos (campo `nNF` do layout), e o DANFE o
 * imprime em três grupos de três. É esse o formato que a pessoa vê no papel
 * que está na mão dela.
 *
 * Devolve `null` quando não há dígito nenhum: exibir "000.000.000" para um
 * campo vazio seria inventar uma nota que não existe.
 */
export function formatarNumeroNfe(valor: unknown): string | null {
  const digitos = digitosDoNumero(valor);
  if (!digitos) return null;
  // Mais de 9 dígitos é a CHAVE de acesso (44) ou um erro de digitação. Não
  // se formata como número — devolve limpo, para quem olha perceber.
  if (digitos.length > 9) return digitos;
  const cheio = digitos.padStart(9, '0');
  return `${cheio.slice(0, 3)}.${cheio.slice(3, 6)}.${cheio.slice(6)}`;
}

/**
 * O número da nota como número, para ordenar e comparar.
 *
 * "000.000.125" e "125" são a mesma nota; comparar como texto os separa.
 */
export function numeroNfeComoInteiro(valor: unknown): number | null {
  const digitos = digitosDoNumero(valor);
  if (!digitos || digitos.length > 9) return null;
  const n = parseInt(digitos, 10);
  return Number.isFinite(n) ? n : null;
}
