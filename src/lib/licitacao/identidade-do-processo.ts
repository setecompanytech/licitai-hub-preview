/**
 * Como um processo licitatório se apresenta num card.
 *
 * "033" sozinho não identifica nada — quem trabalha licitação nomeia o
 * processo por MODALIDADE + NÚMERO: "PE 033", "DL 07/2026". O Kanban exibia
 * só o número interno, e a pergunta veio na hora certa: "não se sabe se é
 * pregão eletrônico, o número do pregão, e demais informações básicas".
 *
 * Os dados sempre estiveram na consulta (modalidade e órgão vêm do
 * monitoramento); faltava o padrão de apresentação. Este módulo é o padrão.
 */

/**
 * Siglas correntes do setor. Texto livre de modalidade → sigla curta.
 * Modalidade que não casa com nenhuma volta como veio — sigla inventada
 * confunde mais do que texto longo.
 */
const SIGLAS: Array<[RegExp, string]> = [
  [/preg[aã]o\s*eletr/i, 'PE'],
  [/preg[aã]o\s*presencial/i, 'PP'],
  [/preg[aã]o/i, 'PREGÃO'],
  [/concorr[êe]ncia/i, 'CONC'],
  [/dispensa/i, 'DL'],
  [/inexigibilidade/i, 'INEX'],
  [/credenciamento/i, 'CRED'],
  [/rdc/i, 'RDC'],
  [/leil[aã]o/i, 'LEILÃO'],
  [/concurso/i, 'CONCURSO'],
  [/di[aá]logo\s*competitivo/i, 'DC'],
];

export function siglaDaModalidade(modalidade: string | null | undefined): string | null {
  const m = String(modalidade ?? '').trim();
  if (!m) return null;
  for (const [re, sigla] of SIGLAS) {
    if (re.test(m)) return sigla;
  }
  return m;
}

/** Número que não é número: cadastros manuais gravam o rótulo no campo. */
const NAO_E_NUMERO = /^(processo\s*manual|manual|s\/n|sem\s*n[uú]mero)?$/i;

/**
 * A linha de identidade do card: "PE 033", "DL 07/2026/PMPA", "Processo
 * manual". Nunca devolve vazio — card sem identidade é o defeito de origem.
 */
export function identidadeDoProcesso(p: {
  numero?: string | null;
  modalidade?: string | null;
}): string {
  const sigla = siglaDaModalidade(p.modalidade);
  const numero = String(p.numero ?? '').trim();
  const temNumero = !NAO_E_NUMERO.test(numero);

  if (sigla && temNumero) return `${sigla} ${numero}`;
  if (temNumero) return numero;
  if (sigla) return `${sigla} · processo manual`;
  return 'Processo manual';
}

/**
 * O objeto do edital, em caixa de leitura.
 *
 * Cada órgão publica como quer: uns em CAIXA ALTA INTEIRA, outros em caixa
 * normal — e o quadro misturava os dois, sem padrão. A regra: texto GRITADO
 * (maioria esmagadora de maiúsculas) é rebaixado para caixa de sentença;
 * texto misto fica como veio, porque já foi escrito por gente.
 *
 * Siglas perdem o formato no rebaixamento ("PMPA" → "pmpa") — é o preço da
 * legibilidade num card informativo, e o texto original continua no title.
 */
export function objetoLegivel(texto: string | null | undefined): string {
  const t = String(texto ?? '').trim();
  if (!t) return '';

  const letras = t.replace(/[^a-záàâãéêíóôõúüç]/gi, '');
  if (letras.length < 8) return t;
  const maiusculas = (t.match(/[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/g) ?? []).length;
  if (maiusculas / letras.length < 0.7) return t;

  const baixo = t.toLowerCase();
  // Primeira letra da sentença, e depois de ponto final/exclamação/interrogação.
  return baixo.replace(/(^\s*[a-záàâãéêíóôõúüç])|([.!?]\s+[a-záàâãéêíóôõúüç])/g,
    (m) => m.toUpperCase());
}
