/**
 * Taxonomia de documentos de habilitação — Fase 3 do prontuário integrado.
 *
 * PADRÃO: casar exigência do edital com documento do cofre por TIPO, nunca por
 * nome de arquivo ("CND_fed_v2.pdf" jamais casaria com "Certidão Negativa de
 * Débitos Federais" por string). A IA classifica a exigência e o cofre
 * (`agent_documentos.tipo`) fala o mesmo vocabulário.
 *
 * ESPELHO: `supabase/functions/_shared/habilitacao-tipos.ts` repete isto para
 * o Deno — as duas versões mudam juntas (mesma disciplina do status).
 */

export interface TipoHabilitacao {
  id: string;
  label: string;
  grupo: 'juridica' | 'fiscal' | 'economica' | 'tecnica' | 'declaracoes' | 'outro';
  /** Palavras que identificam este tipo no texto da exigência OU no nome/tipo do documento do cofre. */
  keywords: string[];
  /**
   * Palavras que apenas QUALIFICAM o documento, sem identificá-lo. "Estadual"
   * serve tanto à certidão de regularidade (art. 68, III) quanto à prova de
   * inscrição (art. 68, II) — sozinha, não diz de qual se trata.
   */
  fracas?: string[];
}

export const TIPOS_HABILITACAO: TipoHabilitacao[] = [
  // ── Habilitação jurídica ──────────────────────────────────────────────────
  { id: 'contrato_social',    label: 'Contrato social / Estatuto',        grupo: 'juridica',    keywords: ['contrato social', 'estatuto', 'ato constitutivo', 'requerimento de empresario', 'alteracao contratual', 'consolidacao contratual', 'registro comercial'] },
  // Documento AUXILIAR da Junta, não o ato constitutivo. A simplificada, a de
  // inteiro teor e a específica informam o que está arquivado; o teor jurídico
  // que habilita — objeto social, capital, poderes de representação — é o do
  // contrato social. Tratar uma como a outra fazia o sistema dar por atendida
  // uma exigência do art. 66 com um documento que não a atende.
  { id: 'certidao_junta',     label: 'Certidão da Junta Comercial (auxiliar)', grupo: 'juridica', keywords: ['certidao simplificada', 'inteiro teor', 'certidao especifica', 'certidao da junta comercial', 'ficha cadastral completa', 'breve relato'] },
  { id: 'cartao_cnpj',        label: 'Cartão CNPJ',                       grupo: 'fiscal',      keywords: ['cnpj', 'cadastro nacional de pessoa juridica', 'cartao cnpj'] },
  { id: 'doc_socios',         label: 'Documentos dos sócios (RG/CPF)',    grupo: 'juridica',    keywords: ['rg', 'cpf', 'documento de identidade', 'cedula de identidade', 'carteira de identidade', 'cnh', 'socio', 'administrador', 'representante legal'] },
  { id: 'procuracao',         label: 'Procuração / Credenciamento',       grupo: 'juridica',    keywords: ['procuracao', 'credenciamento', 'poderes'] },
  // ── Regularidade fiscal e trabalhista ─────────────────────────────────────
  // Art. 68, II — prova de INSCRIÇÃO no cadastro de contribuintes, que é coisa
  // diferente da certidão de REGULARIDADE do inciso III: uma diz que a empresa
  // está cadastrada e em que ramo; a outra, que não deve nada. O sistema só
  // conhecia a segunda, então a primeira nunca virava linha do checklist.
  //
  // O nome muda em cada ente federativo — no Pará, Ficha de Inscrição Cadastral
  // (FIC); em Belém, CISC. Por isso o tipo é nomeado pela função, que é
  // nacional, e as siglas locais entram como sinônimos. A lista abaixo é semente
  // e cresce conforme aparecerem outros entes; a frase canônica do art. 68, II
  // continua reconhecendo quem não estiver nela.
  { id: 'inscricao_estadual', label: 'Inscrição estadual (cadastro de contribuintes)',  grupo: 'fiscal', keywords: ['inscricao estadual', 'contribuinte estadual', 'contribuintes estadual', 'cadastro de contribuintes', 'ficha de inscricao cadastral', 'fic', 'sintegra', 'cad icms', 'cadastro icms'] },
  { id: 'inscricao_municipal', label: 'Inscrição municipal (cadastro de contribuintes)', grupo: 'fiscal', keywords: ['inscricao municipal', 'contribuinte municipal', 'contribuintes municipal', 'cadastro de contribuintes', 'cisc', 'cadastro mobiliario', 'inscricao mobiliaria'] },
  { id: 'cnd_federal',        label: 'CND Federal / União',               grupo: 'fiscal',      keywords: ['federal', 'federais', 'uniao', 'receita federal', 'divida ativa da uniao', 'tributos federais', 'pgfn', 'cnd federal', 'cpen', 'conjunta'] , fracas: ['federal', 'federais'] },
  { id: 'cnd_estadual',       label: 'CND Estadual',                      grupo: 'fiscal',      keywords: ['estadual', 'estaduais', 'fazenda estadual', 'sefa', 'sefaz', 'icms'] , fracas: ['estadual', 'estaduais'] },
  { id: 'cnd_municipal',      label: 'CND Municipal',                     grupo: 'fiscal',      keywords: ['municipal', 'municipais', 'fazenda municipal', 'iss', 'tributos municipais'] , fracas: ['municipal', 'municipais'] },
  { id: 'crf_fgts',           label: 'CRF / FGTS',                        grupo: 'fiscal',      keywords: ['fgts', 'crf', 'caixa economica', 'regularidade do fgts', 'fundo de garantia', 'fundo de garantia do tempo de servico'] },
  { id: 'cndt_trabalhista',   label: 'CNDT Trabalhista',                  grupo: 'fiscal',      keywords: ['trabalhista', 'cndt', 'debitos trabalhistas', 'justica do trabalho', 'tst'] },
  { id: 'inss_previdencia',   label: 'Regularidade previdenciária',       grupo: 'fiscal',      keywords: ['inss', 'previdencia', 'seguridade social'] },
  // ── Qualificação econômico-financeira ─────────────────────────────────────
  { id: 'balanco',            label: 'Balanço patrimonial',               grupo: 'economica',   keywords: ['balanco patrimonial', 'balanco', 'demonstracoes contabeis', 'dre', 'indices contabeis', 'liquidez', 'escrituracao contabil', 'ecd'] },
  { id: 'certidao_falencia',  label: 'Certidão de falência/concordata',   grupo: 'economica',   keywords: ['falencia', 'concordata', 'recuperacao judicial', 'distribuidor', 'insolvencia civil', 'certidao judicial'] },
  { id: 'capital_social',     label: 'Capital social mínimo',             grupo: 'economica',   keywords: ['capital social', 'patrimonio liquido'] },
  // ── Qualificação técnica ─────────────────────────────────────────────────
  { id: 'atestado_tecnico',   label: 'Atestado de capacidade técnica',    grupo: 'tecnica',     keywords: ['atestado', 'capacidade tecnica', 'aptidao', 'desempenho anterior', 'cat ', 'acervo tecnico', 'declaracao de fornecimento'] },
  { id: 'registro_conselho',  label: 'Registro em conselho de classe',    grupo: 'tecnica',     keywords: ['crea', 'cau', 'crc', 'crm', 'conselho regional', 'conselho de classe', 'registro profissional', 'quitacao anuidade'] },
  { id: 'alvara_licenca',     label: 'Alvará / Licença de funcionamento', grupo: 'tecnica',     keywords: ['alvara', 'licenca de funcionamento', 'licenca sanitaria', 'vigilancia sanitaria', 'anvisa', 'licenca ambiental'] },
  // ── Declarações ──────────────────────────────────────────────────────────
  { id: 'decl_menor',         label: 'Declaração — menor de idade',       grupo: 'declaracoes', keywords: ['menor', 'trabalho do menor', 'inciso xxxiii'] },
  { id: 'decl_idoneidade',    label: 'Declaração — idoneidade',           grupo: 'declaracoes', keywords: ['idoneidade', 'inidone', 'impedimento de licitar', 'suspensao', 'fato impeditivo', 'inexistencia de fato'] },
  { id: 'decl_me_epp',        label: 'Declaração — ME/EPP',               grupo: 'declaracoes', keywords: ['microempresa', 'me/epp', 'epp', 'lc 123', 'complementar 123', 'porte'] },
  { id: 'decl_requisitos',    label: 'Declaração — requisitos edital',    grupo: 'declaracoes', keywords: ['cumprimento dos requisitos', 'declaracao de habilitacao', 'pleno conhecimento'] },
];

/**
 * Confronto com a Lei 14.133/2021: cada grupo da taxonomia corresponde a um
 * artigo da lei — o mesmo mapeamento que o módulo Jurídico → Documentos usa
 * nas pastas do cofre. Exibido no checklist e usado no desdobramento de
 * exigências genéricas ("habilitação jurídica na forma da lei").
 */
export const ARTIGO_POR_GRUPO: Record<string, string> = {
  juridica: 'Art. 66',
  tecnica: 'Art. 67',
  fiscal: 'Art. 68',
  economica: 'Art. 69',
  declaracoes: 'Art. 63, §1º',
};

/**
 * Segmentos de atestado de capacidade técnica — MESMOS valores do cofre
 * (AtestadosCapacidadeTecnica). A Aurélia classifica o objeto licitado neste
 * vocabulário e o casamento prefere atestados do segmento do objeto.
 */
export const SEGMENTOS_OBJETO = [
  'alimentos', 'informatica', 'limpeza', 'escritorio', 'moveis',
  'vestuario', 'medicamentos', 'manutencao', 'outros',
] as const;

export const LABEL_SEGMENTO: Record<string, string> = {
  alimentos: 'Gêneros Alimentícios',
  informatica: 'Informática e Tecnologia',
  limpeza: 'Higiene e Limpeza',
  escritorio: 'Material de Escritório',
  moveis: 'Móveis e Equipamentos',
  vestuario: 'Vestuário e EPIs',
  medicamentos: 'Medicamentos e Saúde',
  manutencao: 'Manutenção e Serviços',
  outros: 'Outros Segmentos',
};

/** Classifica um texto (exigência do edital ou nome de documento do cofre) na taxonomia. */
const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const chaveTexto = (t: string) =>
  (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Palavra-chave casa como PALAVRA INTEIRA, com tolerância a plural regular.
 * Ver o espelho Deno: buscar pedaço de palavra fazia 'rg' casar dentro de
 * "órgão", e chaves curtas (cpf, crf, iss, epp, cat) são as mais expostas.
 */
export function casaPalavra(textoNormalizado: string, palavra: string): boolean {
  const k = chaveTexto(palavra);
  if (!k) return false;
  return new RegExp(`\\b${escaparRegex(k)}(s|es)?\\b`).test(textoNormalizado);
}

export function classificarTipo(texto: string | null | undefined): TipoHabilitacao | null {
  const t = chaveTexto(String(texto ?? ''));
  if (!t) return null;
  let melhor: { tipo: TipoHabilitacao; hits: number } | null = null;
  for (const tipo of TIPOS_HABILITACAO) {
    const hits = tipo.keywords.filter((k) => casaPalavra(t, k)).length;
    if (hits > 0 && (!melhor || hits > melhor.hits)) melhor = { tipo, hits };
  }
  return melhor?.tipo ?? null;
}

const LINGUAGEM_DE_INSCRICAO = /\b(inscricao|inscricoes|cadastro de contribuintes|contribuintes?)\b/;

/**
 * Todos os tipos que o texto menciona — para desdobrar a exigência que cobre
 * vários documentos.
 *
 * Um tipo identificado APENAS por palavra fraca ("estadual") não entra quando a
 * frase é de inscrição: senão o item que pede a FIC produziria também uma linha
 * de CND Estadual, misturando os incisos II e III do art. 68.
 */
export function tiposMencionados(texto: string | null | undefined): TipoHabilitacao[] {
  const t = chaveTexto(String(texto ?? ''));
  if (!t) return [];
  const deInscricao = LINGUAGEM_DE_INSCRICAO.test(t);
  return TIPOS_HABILITACAO.filter((tipo) => {
    const acertos = tipo.keywords.filter((k) => casaPalavra(t, k));
    if (!acertos.length) return false;
    const soFracas = acertos.every((k) => (tipo.fracas ?? []).includes(k));
    return !(soFracas && deInscricao);
  });
}
