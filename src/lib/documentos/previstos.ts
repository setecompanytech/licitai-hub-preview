/**
 * O que a empresa precisa ter no cofre — as vagas do checklist de habilitação.
 *
 * A lista saiu de dentro de `pages/Documentos.tsx` (onde era uma constante de
 * componente) para cá, SEM ALTERAR UMA LETRA dos nomes. O motivo é duro: o
 * casamento entre a vaga e a linha gravada é feito por NOME EXATO, e três
 * lugares dependem dessas strings:
 *
 *   - a própria tela, que casa `documentos.nome === vaga.nome`;
 *   - `lib/faturamento/certidoes.ts`, que monta o kit de faturamento pelos
 *     mesmos nomes;
 *   - o histórico, que grava `documento_nome` como texto.
 *
 * Renomear qualquer string aqui ORFANA os registros já gravados e zera o kit
 * de faturamento em silêncio. Quem for mexer: a mudança exige migration de
 * dados, não edição de literal.
 *
 * A ÚNICA informação nova é `vence`, e ela existe para resolver uma confusão
 * que o banco não resolve. `documentos.validade` é `NULL` tanto para "ainda
 * não informei a validade" quanto para "este documento não vence" — contrato
 * social e cartão CNPJ não têm prazo, e cobrar validade deles seria inventar
 * pendência. O banco não distingue os dois casos, mas o DOMÍNIO distingue: a
 * natureza do documento é conhecida de antemão, e é isso que esta coluna
 * declara.
 */

export type CategoriaPrevista =
  | 'Habilitação Jurídica'
  | 'Regularidade Fiscal'
  | 'Qualificação Técnica'
  | 'Qualif. Econômico-Financeira'
  | 'Declarações';

export interface VagaPrevista {
  /** ⚠️ Chave de casamento com `documentos.nome`. Não renomear. */
  nome: string;
  categoria: CategoriaPrevista;
  /** Dispositivo da Lei 14.133/2021 que exige o documento. */
  artigo: string;
  /**
   * O documento tem prazo por natureza?
   *
   * `false` significa "não se aplica" — e é diferente de "não informada".
   * Certidão sempre vence; contrato social, não. Sem esta distinção, um cofre
   * completo mostraria seis documentos "sem validade" como se faltasse algo.
   */
  vence: boolean;
}

export const VAGAS_PREVISTAS: VagaPrevista[] = [
  // ── Habilitação jurídica ──────────────────────────────────────────────────
  // Ato constitutivo e identidade não vencem: valem enquanto não houver
  // alteração contratual. A certidão da Junta, sim — ela retrata uma data.
  { nome: 'Ato Constitutivo / Contrato Social', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', vence: false },
  { nome: 'Cédula de Identidade dos Sócios', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', vence: false },
  /* Documento AUXILIAR: informa o que está arquivado na Junta, mas não substitui
     o teor jurídico do contrato social (objeto, capital, poderes). Vale o mesmo
     para a certidão de inteiro teor e a específica. */
  { nome: 'Certidão Simplificada da Junta Comercial', categoria: 'Habilitação Jurídica', artigo: 'Art. 66', vence: true },

  // ── Regularidade fiscal ───────────────────────────────────────────────────
  // Cartão CNPJ e as provas de INSCRIÇÃO são cadastrais: retratam um registro
  // que não expira. As certidões de DÉBITO, sim — todas têm prazo.
  { nome: 'Cartão CNPJ', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, I', vence: false },
  /* Art. 68, II — prova de INSCRIÇÃO no cadastro de contribuintes, que não se
     confunde com a certidão de regularidade do inciso III. A sigla muda em cada
     ente (FIC no Pará, CISC em Belém), então a vaga é nomeada pela função e o
     sistema reconhece as siglas locais pelo nome do arquivo. */
  { nome: 'Inscrição Estadual (cadastro de contribuintes)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, II', vence: false },
  { nome: 'Inscrição Municipal (cadastro de contribuintes)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68, II', vence: false },
  { nome: 'Certidão Negativa de Débitos Federais (CND)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', vence: true },
  { nome: 'Certidão de Regularidade do FGTS (CRF)', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', vence: true },
  { nome: 'Certidão Negativa de Débitos Estaduais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', vence: true },
  { nome: 'Certidão Negativa de Débitos Municipais', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', vence: true },
  { nome: 'CNDT – Certidão Trabalhista', categoria: 'Regularidade Fiscal', artigo: 'Art. 68', vence: true },

  // ── Qualificação técnica ──────────────────────────────────────────────────
  // O registro no conselho tem anuidade; a CAT é definitiva.
  { nome: 'Registro no CREA/CAU', categoria: 'Qualificação Técnica', artigo: 'Art. 67', vence: true },
  /* Atestado de Capacidade Técnica é gerenciado na aba própria, com segmentos. */
  { nome: 'CAT – Certidão de Acervo Técnico', categoria: 'Qualificação Técnica', artigo: 'Art. 67', vence: false },

  // ── Qualificação econômico-financeira ─────────────────────────────────────
  // O balanço é do exercício (não "vence", é substituído); a certidão de
  // falência tem prazo de emissão.
  { nome: 'Balanço Patrimonial (último exercício)', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', vence: false },
  { nome: 'Certidão Negativa de Falência', categoria: 'Qualif. Econômico-Financeira', artigo: 'Art. 69', vence: true },

  // ── Declarações ───────────────────────────────────────────────────────────
  // Declaração é firmada para o certame: não vence, se refaz.
  { nome: 'Declaração de Inexistência de Fato Impeditivo', categoria: 'Declarações', artigo: 'Art. 63, §1º', vence: false },
  { nome: 'Declaração de Não Emprego de Menor', categoria: 'Declarações', artigo: 'Art. 68, VI', vence: false },
  { nome: 'Declaração ME/EPP (se aplicável)', categoria: 'Declarações', artigo: 'LC 123/2006', vence: false },
];

/** As categorias na ordem em que a lei as organiza. */
export const CATEGORIAS_PREVISTAS: CategoriaPrevista[] = [
  ...new Set(VAGAS_PREVISTAS.map((v) => v.categoria)),
];

/** A vaga de um nome, para quem tem só a linha gravada em mãos. */
export function vagaDe(nome: string): VagaPrevista | undefined {
  return VAGAS_PREVISTAS.find((v) => v.nome === nome);
}
