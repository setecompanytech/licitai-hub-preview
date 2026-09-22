import { CERTIDOES_FEDERAIS, certidoesEstaduais } from '@/data/certidoes-catalogo';
import { normalizarEspacos } from './validade';

/**
 * O código de autenticidade da certidão — fase 2 das Certidões (23/09/2026).
 *
 * O que prova uma certidão não é o PDF: é o código que o órgão emissor
 * imprime nela e que qualquer pessoa confere no site dele. O cofre lê esse
 * código do mesmo texto de que já lê a validade (`validade.ts`) e mostra
 * "Código: … · Conferir no órgão", com o link oficial de conferência vindo
 * do catálogo (`data/certidoes-catalogo.ts`).
 *
 * Só os padrões CLAROS entram: o rótulo que o próprio órgão usa, seguido do
 * formato que ele usa. Sem padrão reconhecido, a resposta é `null` — nunca um
 * código inventado, nunca um emissor adivinhado. Nada aqui usa IA.
 */
export interface Autenticidade {
  emissor: string;
  codigo: string;
  /** A URL oficial de conferência do emissor, do catálogo; `null` quando o catálogo não a tem. */
  conferirEm: string | null;
}

const federal = (id: string) => CERTIDOES_FEDERAIS.find((c) => c.id === id);
const sefaPa = () => certidoesEstaduais('PA').find((c) => c.vaga === 'Certidão Negativa de Débitos Estaduais');

/**
 * Os emissores reconhecidos e onde cada um confere o código. O link é lido
 * do catálogo NA HORA (não fica congelado no que foi gravado): se o órgão
 * mudar de endereço, o catálogo muda e o cofre acompanha.
 */
export const EMISSORES = {
  receita: {
    nome: 'Receita Federal do Brasil / Procuradoria-Geral da Fazenda Nacional',
    conferirEm: () => federal('cnd-federal')?.urlAutenticidade ?? null,
  },
  caixa: {
    nome: 'Caixa Econômica Federal',
    conferirEm: () => federal('crf-fgts')?.urlAutenticidade ?? null,
  },
  tst: {
    nome: 'Tribunal Superior do Trabalho',
    conferirEm: () => federal('cndt')?.urlAutenticidade ?? null,
  },
  sefaPa: {
    nome: 'Secretaria de Estado da Fazenda do Pará (SEFA/PA)',
    conferirEm: () => sefaPa()?.urlAutenticidade ?? null,
  },
} as const;

type ChaveDoEmissor = keyof typeof EMISSORES;

/** A URL de conferência atual de um emissor reconhecido, pelo nome gravado. */
export function urlDeConferencia(emissor: string): string | null {
  const chave = (Object.keys(EMISSORES) as ChaveDoEmissor[]).find((k) => EMISSORES[k].nome === emissor);
  return chave ? EMISSORES[chave].conferirEm() : null;
}

interface Reconhecedor {
  emissor: ChaveDoEmissor;
  /** O documento é deste emissor? (cabeçalho ou título que só ele usa) */
  marca: RegExp;
  /** O rótulo do código, seguido do formato do código — o grupo 1 é o código. */
  codigo: RegExp;
  /** Como o órgão imprime o código (letras em caixa alta nos hexadecimais). */
  normalizar?: (codigo: string) => string;
}

const caixaAlta = (c: string) => c.toUpperCase();

/**
 * Os padrões, na ordem em que se testam. Cada um exige a MARCA do emissor e
 * o RÓTULO do código: "Certidão nº" sozinho aparece em qualquer certidão, e
 * um código hexadecimal solto não diz de quem é.
 */
const RECONHECEDORES: Reconhecedor[] = [
  {
    // "Código de controle da certidão: 3F8A.2B7C.9D1E.4A6B" — quatro blocos
    // hexadecimais de quatro; a Receita e a PGFN emitem juntas.
    emissor: 'receita',
    marca: /RECEITA FEDERAL|PROCURADORIA[- ]GERAL DA FAZENDA NACIONAL|C[ÓO]DIGO DE CONTROLE DA CERTID[ÃA]O/i,
    codigo: /C[ÓO]DIGO DE CONTROLE DA CERTID[ÃA]O\s*:?\s*([0-9A-F]{4}(?:\.[0-9A-F]{4}){3})\b/i,
    normalizar: caixaAlta,
  },
  {
    // "Certificação Número: 2025062303334570826430" — o CRF da Caixa.
    emissor: 'caixa',
    marca: /CAIXA|CERTIFICADO DE REGULARIDADE DO FGTS|\bCRF\b/i,
    codigo: /CERTIFICA[ÇC][ÃA]O N[ÚU]MERO\s*:?\s*(\d{16,32})\b/i,
  },
  {
    // "Certidão nº: 12345678/2026" numa Certidão Negativa (ou Positiva) de
    // Débitos Trabalhistas — o número é o que se confere no TST.
    emissor: 'tst',
    marca: /D[ÉE]BITOS TRABALHISTAS|TRIBUNAL SUPERIOR DO TRABALHO/i,
    codigo: /CERTID[ÃA]O N[º°o.]?\s*:?\s*(\d{1,12}\/\d{4})\b/i,
  },
  {
    // "Código de Controle de Autenticidade: 7D7CEA16.1B83C71C.9E7386BB.531F3DD9"
    // — quatro blocos hexadecimais de oito, na certidão da SEFA/PA.
    emissor: 'sefaPa',
    // `\b` é só ASCII em JavaScript — depois de "Á" não há fronteira; o
    // lookahead barra "PARANÁ" e "PARAÍBA" sem depender dela.
    marca: /(SECRETARIA DE ESTADO DA FAZENDA|\bSEFA\b)[\s\S]{0,200}PAR[ÁA](?![A-ZÀ-ÚÇ])|PAR[ÁA](?![A-ZÀ-ÚÇ])[\s\S]{0,200}(SECRETARIA DE ESTADO DA FAZENDA|\bSEFA\b)/i,
    codigo: /C[ÓO]DIGO DE CONTROLE DE AUTENTICIDADE\s*:?\s*([0-9A-F]{8}(?:\.[0-9A-F]{8}){3})\b/i,
    normalizar: caixaAlta,
  },
];

/**
 * O código de autenticidade do texto de uma certidão, ou `null`.
 *
 * O texto é o mesmo que `extrairValidadeDoTexto` lê (pdf.js, sem IA). A
 * primeira dupla marca + rótulo que casar decide; o link de conferência vem
 * do catálogo.
 */
export function extrairAutenticidade(textoCru: string): Autenticidade | null {
  if (!textoCru?.trim()) return null;
  const texto = normalizarEspacos(textoCru);
  for (const r of RECONHECEDORES) {
    if (!r.marca.test(texto)) continue;
    const m = texto.match(r.codigo);
    if (!m?.[1]) continue;
    const codigo = (r.normalizar ?? ((c: string) => c))(m[1].trim());
    const emissor = EMISSORES[r.emissor];
    return { emissor: emissor.nome, codigo, conferirEm: emissor.conferirEm() };
  }
  return null;
}

/* ── Guardar e ler em `documentos.dados_extraidos` ─────────────────────── */

/**
 * O que foi gravado na linha do documento, validado — JSON do banco não é
 * de confiança. O link de conferência é reatualizado pelo catálogo quando o
 * emissor é conhecido; o gravado só vale para emissor que o catálogo não
 * conhece mais.
 */
export function autenticidadeGravada(dados: unknown): Autenticidade | null {
  if (!dados || typeof dados !== 'object') return null;
  const a = (dados as { autenticidade?: unknown }).autenticidade;
  if (!a || typeof a !== 'object') return null;
  const { emissor, codigo, conferirEm } = a as Record<string, unknown>;
  if (typeof emissor !== 'string' || !emissor.trim()) return null;
  if (typeof codigo !== 'string' || !codigo.trim()) return null;
  const gravado = typeof conferirEm === 'string' && conferirEm.trim() ? conferirEm : null;
  return { emissor, codigo, conferirEm: urlDeConferencia(emissor) ?? gravado };
}

/**
 * Os `dados_extraidos` a gravar: o que já estava lá (outros usos da coluna)
 * mais a autenticidade — ou sem ela, quando o arquivo novo não tem código.
 * Devolve `null` quando não sobra nada, para a coluna ficar nula e não `{}`.
 */
export function comAutenticidade(dadosAtuais: unknown, autenticidade: Autenticidade | null): Record<string, unknown> | null {
  const base: Record<string, unknown> = dadosAtuais && typeof dadosAtuais === 'object' && !Array.isArray(dadosAtuais)
    ? { ...(dadosAtuais as Record<string, unknown>) }
    : {};
  delete base.autenticidade;
  if (autenticidade) {
    base.autenticidade = {
      emissor: autenticidade.emissor,
      codigo: autenticidade.codigo,
      conferirEm: autenticidade.conferirEm,
      lidoEm: new Date().toISOString(),
    };
  }
  return Object.keys(base).length ? base : null;
}
