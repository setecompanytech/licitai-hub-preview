/**
 * Taxonomia de documentos de habilitação — Fase 3 do prontuário integrado.
 *
 * PADRÃO: casar exigência do edital com documento do cofre por TIPO, nunca por
 * nome de arquivo ("CND_fed_v2.pdf" jamais casaria com "Certidão Negativa de
 * Débitos Federais" por string). A IA classifica a exigência e o cofre
 * (`agent_documentos.tipo`) fala o mesmo vocabulário.
 *
 * ESPELHO: `src/lib/habilitacao/tipos.ts` repete isto para o front — as duas
 * versões mudam juntas (mesma disciplina do vocabulário de status).
 */

export interface TipoHabilitacao {
  id: string;
  label: string;
  grupo: 'juridica' | 'fiscal' | 'economica' | 'tecnica' | 'declaracoes' | 'outro';
  /** Palavras que identificam este tipo no texto da exigência OU no nome/tipo do documento do cofre. */
  keywords: string[];
}

export const TIPOS_HABILITACAO: TipoHabilitacao[] = [
  // ── Habilitação jurídica ──────────────────────────────────────────────────
  { id: 'contrato_social',    label: 'Contrato social / Estatuto',        grupo: 'juridica',    keywords: ['contrato social', 'estatuto', 'ato constitutivo', 'requerimento de empresario'] },
  { id: 'cartao_cnpj',        label: 'Cartão CNPJ',                       grupo: 'juridica',    keywords: ['cnpj', 'cadastro nacional de pessoa juridica', 'cartao cnpj'] },
  { id: 'doc_socios',         label: 'Documentos dos sócios (RG/CPF)',    grupo: 'juridica',    keywords: ['rg', 'cpf', 'documento de identidade', 'socio', 'administrador', 'representante legal'] },
  { id: 'procuracao',         label: 'Procuração / Credenciamento',       grupo: 'juridica',    keywords: ['procuracao', 'credenciamento', 'poderes'] },
  // ── Regularidade fiscal e trabalhista ─────────────────────────────────────
  { id: 'cnd_federal',        label: 'CND Federal / União',               grupo: 'fiscal',      keywords: ['federal', 'uniao', 'receita federal', 'divida ativa da uniao', 'tributos federais', 'pgfn'] },
  { id: 'cnd_estadual',       label: 'CND Estadual',                      grupo: 'fiscal',      keywords: ['estadual', 'fazenda estadual', 'sefa', 'sefaz', 'icms'] },
  { id: 'cnd_municipal',      label: 'CND Municipal',                     grupo: 'fiscal',      keywords: ['municipal', 'fazenda municipal', 'iss', 'tributos municipais'] },
  { id: 'crf_fgts',           label: 'CRF / FGTS',                        grupo: 'fiscal',      keywords: ['fgts', 'crf', 'caixa economica', 'regularidade do fgts'] },
  { id: 'cndt_trabalhista',   label: 'CNDT Trabalhista',                  grupo: 'fiscal',      keywords: ['trabalhista', 'cndt', 'debitos trabalhistas', 'justica do trabalho', 'tst'] },
  { id: 'inss_previdencia',   label: 'Regularidade previdenciária',       grupo: 'fiscal',      keywords: ['inss', 'previdencia', 'seguridade social'] },
  // ── Qualificação econômico-financeira ─────────────────────────────────────
  { id: 'balanco',            label: 'Balanço patrimonial',               grupo: 'economica',   keywords: ['balanco patrimonial', 'demonstracoes contabeis', 'indices contabeis', 'liquidez'] },
  { id: 'certidao_falencia',  label: 'Certidão de falência/concordata',   grupo: 'economica',   keywords: ['falencia', 'concordata', 'recuperacao judicial', 'distribuidor'] },
  { id: 'capital_social',     label: 'Capital social mínimo',             grupo: 'economica',   keywords: ['capital social', 'patrimonio liquido'] },
  // ── Qualificação técnica ─────────────────────────────────────────────────
  { id: 'atestado_tecnico',   label: 'Atestado de capacidade técnica',    grupo: 'tecnica',     keywords: ['atestado', 'capacidade tecnica', 'aptidao', 'desempenho anterior'] },
  { id: 'registro_conselho',  label: 'Registro em conselho de classe',    grupo: 'tecnica',     keywords: ['crea', 'cau', 'crc', 'crm', 'conselho regional', 'conselho de classe'] },
  { id: 'alvara_licenca',     label: 'Alvará / Licença de funcionamento', grupo: 'tecnica',     keywords: ['alvara', 'licenca de funcionamento', 'licenca sanitaria', 'vigilancia sanitaria', 'anvisa', 'licenca ambiental'] },
  // ── Declarações ──────────────────────────────────────────────────────────
  { id: 'decl_menor',         label: 'Declaração — menor de idade',       grupo: 'declaracoes', keywords: ['menor', 'trabalho do menor', 'inciso xxxiii'] },
  { id: 'decl_idoneidade',    label: 'Declaração — idoneidade',           grupo: 'declaracoes', keywords: ['idoneidade', 'inidone', 'impedimento de licitar', 'suspensao'] },
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
export function classificarTipo(texto: string | null | undefined): TipoHabilitacao | null {
  const t = (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!t) return null;
  let melhor: { tipo: TipoHabilitacao; hits: number } | null = null;
  for (const tipo of TIPOS_HABILITACAO) {
    const hits = tipo.keywords.filter((k) => t.includes(k)).length;
    if (hits > 0 && (!melhor || hits > melhor.hits)) melhor = { tipo, hits };
  }
  return melhor?.tipo ?? null;
}
