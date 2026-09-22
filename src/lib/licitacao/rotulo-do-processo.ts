import { normalizarStatus, RESULTADOS_ENCERRADORES } from './status';
import { nomeDeOrgaoLegivel } from '@/lib/texto/nome-de-orgao';

/**
 * O rótulo do processo na norma da casa (22/09/2026): "Pregão Eletrônico
 * nº 44/2025 — Município de Rondon do Pará".
 *
 * A lista de processos da Análise de concorrente mostrava o número como cada
 * um digitou ("P.E. 044", "Pregão Eletrônico SRP Nº 014", "00046", "1"), a
 * modalidade como o PNCP escreve ("Pregão - Eletrônico") e o órgão em caixa
 * alta sem acento — e misturava cancelados, anulados, perdidos e arquivados.
 * Aqui mora a régua: o que é válido para análise, a ordem e o texto.
 */
export interface ProcessoParaRotulo {
  numero?: string | null;
  modalidade?: string | null;
  orgao?: string | null;
  ano_compra?: string | null;
  data_abertura?: string | null;
  created_at?: string | null;
}

export interface ProcessoParaFiltro extends ProcessoParaRotulo {
  status?: string | null;
  resultado?: string | null;
  arquivado_em?: string | null;
}

const semZeros = (d: string): string => d.replace(/^0+(?=\d)/, '');

/** O ano do processo: o da compra, senão o da abertura, senão o do cadastro. */
export function anoDoProcesso(p: ProcessoParaRotulo): string {
  const ano = String(p.ano_compra ?? '').replace(/\D/g, '').slice(0, 4);
  if (ano.length === 4) return ano;
  for (const data of [p.data_abertura, p.created_at]) {
    const m = String(data ?? '').match(/^(\d{4})-\d{2}-\d{2}/);
    if (m) return m[1];
  }
  return '';
}

/**
 * "P.E. 044" → "44/2025"; "Pregão Eletrônico SRP Nº 014" → "14/2025";
 * "011/2026" → "11/2026"; "00046" → "46/2025"; "90012/2025" fica;
 * sem dígito, o texto como veio.
 */
export function numeroDoProcessoLegivel(numero: string | null | undefined, ano = ''): string {
  const t = String(numero ?? '').trim();
  if (!t) return '';
  const comAno = t.match(/(\d+)\s*[/.-]\s*(\d{4})(?!\d)/);
  if (comAno) return `${semZeros(comAno[1])}/${comAno[2]}`;
  const grupos = t.match(/\d+/g);
  if (!grupos) return t;
  const n = semZeros(grupos[grupos.length - 1]);
  return ano ? `${n}/${ano}` : n;
}

/** "Pregão - Eletrônico" → "Pregão Eletrônico"; "PREGAO ELETRONICO" → "Pregão Eletrônico"; caixa mista passa. */
export function modalidadeLegivel(modalidade: string | null | undefined): string {
  const t = String(modalidade ?? '').replace(/\s*[-–—]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return nomeDeOrgaoLegivel(t);
}

/** "Pregão Eletrônico nº 44/2025 — Município de Rondon do Pará". */
export function rotuloDoProcesso(p: ProcessoParaRotulo): string {
  const modalidade = modalidadeLegivel(p.modalidade) || 'Processo';
  const numero = numeroDoProcessoLegivel(p.numero, anoDoProcesso(p));
  const orgao = nomeDeOrgaoLegivel(p.orgao);
  const cabeca = numero ? `${modalidade} nº ${numero}` : modalidade;
  return orgao ? `${cabeca} — ${orgao}` : cabeca;
}

const ENCERRADO_NO_TEXTO = /cancel|anulad|revog|suspens|exclu|desert|fracass|perd|arquiv/;

/**
 * Válido para a análise de concorrente: em andamento ou ganho. Fora: cancelado,
 * anulado, revogado e suspenso (que o vocabulário lê como Perdida ou nem lê),
 * perdido, arquivado, deserto, fracassado — e o processo sem número nem órgão,
 * que não identifica licitação nenhuma.
 */
export function processoValidoParaAnalise(p: ProcessoParaFiltro): boolean {
  if (p.arquivado_em) return false;
  if (!String(p.numero ?? '').trim() && !String(p.orgao ?? '').trim()) return false;
  const bruto = String(p.status ?? '').trim().toLowerCase();
  if (ENCERRADO_NO_TEXTO.test(bruto)) return false;
  const status = normalizarStatus(p.status);
  if (status === 'Perdida' || status === 'Arquivada') return false;
  const resultado = String(p.resultado ?? '').trim().toLowerCase();
  if (resultado && (RESULTADOS_ENCERRADORES.some((r) => r.toLowerCase() === resultado) || ENCERRADO_NO_TEXTO.test(resultado))) return false;
  return true;
}

const instante = (data: string | null | undefined): number => {
  const t = new Date(String(data ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Os mais recentes primeiro: pela abertura, e pelo cadastro quando ela falta. */
export function ordenarProcessos<T extends ProcessoParaRotulo>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const abertura = instante(b.data_abertura) - instante(a.data_abertura);
    if (abertura !== 0) return abertura;
    return instante(b.created_at) - instante(a.created_at);
  });
}
