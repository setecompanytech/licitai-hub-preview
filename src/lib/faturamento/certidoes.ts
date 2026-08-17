/**
 * Certidões que acompanham a NF-e — quais são e em que estado estão.
 *
 * O financeiro emite a nota e precisa anexar as negativas. Certidão vencida
 * enviada ao órgão volta como pendência e atrasa o pagamento, então o estado
 * de cada uma tem de ser visível ANTES do download, não descoberto depois.
 *
 * Regra deliberada: vencida não entra no pacote. O que sai do sistema é o que
 * pode ser enviado — mas a tela avisa, nomeando cada uma, para que a ausência
 * seja uma decisão de quem envia e não uma surpresa.
 */

/** Documento cru, como vem de `documentos`. */
export type DocumentoEmpresa = {
  id: string;
  nome: string;
  validade: string | null;
  arquivo_path: string | null;
};

export type SituacaoCertidao = 'valida' | 'vence_em_breve' | 'vencida' | 'sem_validade' | 'ausente';

export type CertidaoAvaliada = {
  nome: string;
  documento: DocumentoEmpresa | null;
  situacao: SituacaoCertidao;
  /** Dias até vencer; negativo se já venceu; null quando não há data. */
  diasRestantes: number | null;
};

/**
 * As negativas que acompanham o faturamento, na ordem em que o órgão costuma
 * conferir. Espelha os nomes cadastrados em Jurídico → Documentos, porque é
 * por nome que o documento é encontrado — id não existe até alguém subir.
 */
export const CERTIDOES_DO_FATURAMENTO = [
  'Certidão Negativa de Débitos Federais (CND)',
  'Certidão de Regularidade do FGTS (CRF)',
  'Certidão Negativa de Débitos Estaduais',
  'Certidão Negativa de Débitos Municipais',
  'CNDT – Certidão Trabalhista',
  'Certidão Negativa de Falência',
] as const;

/** Janela de alerta: certidão que vence dentro disso ainda serve, mas avisa. */
export const DIAS_DE_ALERTA = 15;

/**
 * Dias até vencer, comparando DATAS e não instantes.
 *
 * Duas armadilhas que os testes pegaram: `new Date('2026-08-16')` cai em UTC e
 * pode voltar um dia no fuso de Belém; e meio-dia contra meia-noite produz
 * meio dia de diferença, onde `Math.round(-0.5)` devolve `-0` — que não é
 * menor que zero, e fazia "venceu ontem" passar por válida.
 */
export function diasAte(validade: string | null, hoje = new Date()): number | null {
  if (!validade) return null;
  const [ano, mes, dia] = validade.slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  const fim = new Date(ano, mes - 1, dia).getTime();
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((fim - base) / 86_400_000);
}

export function situacaoDe(doc: DocumentoEmpresa | null, hoje = new Date()): SituacaoCertidao {
  if (!doc || !doc.arquivo_path) return 'ausente';
  const dias = diasAte(doc.validade, hoje);
  // Sem data de validade não dá para afirmar que está boa nem que venceu.
  // Tratar como válida esconderia o risco; como vencida, barraria à toa.
  if (dias === null) return 'sem_validade';
  if (dias < 0) return 'vencida';
  if (dias <= DIAS_DE_ALERTA) return 'vence_em_breve';
  return 'valida';
}

/** Uma linha por certidão esperada, tenha ela sido cadastrada ou não. */
export function avaliarCertidoes(
  documentos: DocumentoEmpresa[],
  hoje = new Date(),
): CertidaoAvaliada[] {
  const porNome = new Map(documentos.map((d) => [d.nome.trim().toLowerCase(), d]));
  return CERTIDOES_DO_FATURAMENTO.map((nome) => {
    const doc = porNome.get(nome.trim().toLowerCase()) ?? null;
    return { nome, documento: doc, situacao: situacaoDe(doc, hoje), diasRestantes: diasAte(doc?.validade ?? null, hoje) };
  });
}

/** Entram no pacote as que podem ser enviadas hoje. */
export const podeEnviar = (c: CertidaoAvaliada): boolean =>
  c.situacao === 'valida' || c.situacao === 'vence_em_breve' || c.situacao === 'sem_validade';

/** Nome de arquivo legível: o órgão recebe "CND-Federal.pdf", não um uuid. */
export function nomeDeArquivo(nomeCertidao: string, caminhoOriginal: string | null): string {
  const ext = (caminhoOriginal?.split('.').pop() ?? 'pdf').toLowerCase().slice(0, 4);
  const base = nomeCertidao
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `${base}.${ext}`;
}
