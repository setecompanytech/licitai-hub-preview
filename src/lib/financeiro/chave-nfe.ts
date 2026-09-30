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

// ─────────────────────────────────────────────────────────────────────────────
// A chave por dentro — o que ela já diz sem ler mais nada (30/09/2026)
// ─────────────────────────────────────────────────────────────────────────────

/** Dígito verificador (módulo 11, pesos 2 a 9 da direita para a esquerda) dos 43 primeiros dígitos. */
export function dvDaChaveNfe(base43: string): number | null {
  const d = base43.replace(/\D/g, '');
  if (d.length !== 43) return null;
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(d[42 - i]) * (2 + (i % 8));
  const resto = 11 - (soma % 11);
  return resto >= 10 ? 0 : resto;
}

/** 44 dígitos, modelo 55 ou 65 e dígito verificador correto. */
export function chaveNfeValida(valor: unknown): boolean {
  const chave = normalizarChaveNfe(valor);
  if (!chave) return false;
  const modelo = chave.slice(20, 22);
  if (modelo !== '55' && modelo !== '65') return false;
  return dvDaChaveNfe(chave.slice(0, 43)) === Number(chave[43]);
}

/**
 * A chave dentro de um texto (o texto do DANFE, por exemplo). No DANFE ela
 * vem em grupos de quatro separados por espaço; às vezes a leitura do PDF
 * troca o espaço por nada ou por quebra de linha. Só devolve chave VÁLIDA.
 */
export function chaveNfeDoTexto(texto: string): string | null {
  const re = /(?:\d[\s.-]{0,2}){44}/g;
  for (const m of texto.matchAll(re)) {
    const chave = m[0].replace(/\D/g, '');
    if (chaveNfeValida(chave)) return chave;
  }
  // O texto de um PDF sai na ordem das caixas, não da leitura: os grupos de
  // quatro da chave podem vir intercalados com rótulos de caixas vizinhas.
  // Onze grupos de quatro dígitos, com até 40 caracteres sem dígito entre
  // eles, ainda são a chave — o dígito verificador diz se são.
  const grupos = /(?:\b\d{4}\b[^\d]{0,40}){10}\b\d{4}\b/g;
  for (const m of texto.matchAll(grupos)) {
    const chave = m[0].replace(/\D/g, '');
    if (chaveNfeValida(chave)) return chave;
  }
  return null;
}

export type DadosDaChave = {
  uf: string; ano: string; mes: string; competencia: string;
  cnpj_emitente: string; modelo: string; serie: number; numero: number; tp_emis: string; codigo: string; dv: string;
};

/** cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) DV(1). */
export function dadosDaChaveNfe(valor: unknown): DadosDaChave | null {
  const c = normalizarChaveNfe(valor);
  if (!c) return null;
  const ano = `20${c.slice(2, 4)}`; const mes = c.slice(4, 6);
  return {
    uf: c.slice(0, 2), ano, mes, competencia: `${ano}-${mes}`,
    cnpj_emitente: c.slice(6, 20), modelo: c.slice(20, 22), serie: Number(c.slice(22, 25)), numero: Number(c.slice(25, 34)),
    tp_emis: c.slice(34, 35), codigo: c.slice(35, 43), dv: c.slice(43, 44),
  };
}
