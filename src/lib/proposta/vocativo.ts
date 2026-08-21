/**
 * Vocativo e referência da proposta — norma culta e o formato do próprio edital.
 *
 * Duas coisas que a proposta escrevia errado, e que quem recebe nota:
 *
 *  - **"A TRIBUNAL SUPERIOR ELEITORAL".** O correto é "Ao": a preposição
 *    concorda com o gênero do órgão. "À Prefeitura", "Ao Tribunal", "Aos
 *    Correios". Um "A" solto diante de nome masculino é erro de concordância na
 *    primeira linha do documento — antes mesmo de o pregoeiro ler o preço.
 *  - **"Ref.: 87 - Pregão - Eletrônico".** O edital se identifica como
 *    "PREGÃO ELETRÔNICO Nº 87/2026", e a proposta deve citá-lo como ele se
 *    nomeia. O hífen no meio da modalidade é como o dado é guardado aqui, não
 *    como o certame se chama.
 *
 * A regra vive num lugar só porque três telas a repetiam: o preview em tempo
 * real, o PDF e a exportação em HTML.
 */

/** Substantivos que abrem nome de órgão, com o gênero que regem. */
const FEMININOS = [
  'prefeitura', 'secretaria', 'fundacao', 'universidade', 'camara', 'agencia',
  'superintendencia', 'comissao', 'companhia', 'empresa', 'assembleia',
  'defensoria', 'procuradoria', 'justica', 'policia', 'diretoria',
  'coordenadoria', 'escola', 'faculdade', 'autarquia', 'associacao',
  'cooperativa', 'caixa', 'ordem', 'junta', 'delegacia', 'guarda', 'casa',
  'fundacaoo', 'reitoria', 'controladoria', 'ouvidoria', 'central', 'unidade',
];

const MASCULINOS = [
  'tribunal', 'ministerio', 'instituto', 'estado', 'municipio', 'departamento',
  'conselho', 'servico', 'fundo', 'governo', 'comando', 'corpo', 'centro',
  'hospital', 'banco', 'senado', 'gabinete', 'nucleo', 'orgao', 'consorcio',
  'batalhao', 'colegio', 'exercito', 'comite', 'poder', 'grupamento',
];

/** Plurais que aparecem em nome de órgão ("Correios", "Departamentos"). */
const PLURAIS_MASC = ['correios'];

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Genero = { feminino: boolean; plural: boolean };

/**
 * Deduz gênero e número pela primeira palavra significativa do nome.
 *
 * Não reconhecendo, assume masculino singular — que é a forma neutra do
 * português e a mais comum entre órgãos ("Ao Tribunal", "Ao Instituto"). O
 * risco de errar existe e é preferível ao de inventar concordância: "Ao" diante
 * de nome feminino soa estranho, mas "A" diante de masculino é erro claro.
 */
export function generoDoOrgao(nome: string): Genero {
  const palavras = semAcento(nome).split(/[^a-z]+/).filter(Boolean);
  for (const p of palavras) {
    if (PLURAIS_MASC.includes(p)) return { feminino: false, plural: true };
    if (FEMININOS.includes(p)) return { feminino: true, plural: false };
    if (MASCULINOS.includes(p)) return { feminino: false, plural: false };
    // Plural regular do que a lista conhece no singular.
    if (p.endsWith('s')) {
      const sing = p.slice(0, -1);
      if (FEMININOS.includes(sing)) return { feminino: true, plural: true };
      if (MASCULINOS.includes(sing)) return { feminino: false, plural: true };
    }
  }
  return { feminino: false, plural: false };
}

/** "Ao", "À", "Aos" ou "Às", conforme o órgão destinatário. */
export function vocativoDoOrgao(nome: string | null | undefined): string {
  if (!nome || !nome.trim()) return 'Ao';
  const { feminino, plural } = generoDoOrgao(nome);
  if (feminino) return plural ? 'Às' : 'À';
  return plural ? 'Aos' : 'Ao';
}

/** "PREGÃO ELETRÔNICO" — como o certame se chama, sem o hífen do cadastro. */
export function modalidadePorExtenso(modalidade: string | null | undefined): string {
  return String(modalidade ?? '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Linha de referência no formato do edital: "PREGÃO ELETRÔNICO Nº 87/2026".
 *
 * O ano vem da data de encerramento, que é o que o sistema tem de mais próximo
 * do exercício do certame. Sem ela, a referência sai sem o ano em vez de
 * arriscar um errado — número de edital com ano trocado é vício de forma.
 */
export function referenciaDoCertame(params: {
  numero: string | null | undefined;
  modalidade?: string | null;
  ano?: number | string | null;
}): string {
  const modalidade = modalidadePorExtenso(params.modalidade);
  const numero = String(params.numero ?? '').trim();
  if (!numero) return modalidade;

  // Número que já vem com ano ("87/2026") não recebe outro.
  const comAno = /\/\d{4}\s*$/.test(numero)
    ? numero
    : params.ano ? `${numero}/${params.ano}` : numero;

  return modalidade ? `${modalidade} Nº ${comAno}` : `Nº ${comAno}`;
}

/** "(Processo Administrativo SEI n.º 0002914-89.2026.6.14.8000)" */
export function linhaDoProcessoAdministrativo(processo: string | null | undefined): string {
  const p = String(processo ?? '').trim();
  if (!p) return '';
  return /processo/i.test(p) ? `(${p})` : `(Processo Administrativo n.º ${p})`;
}
