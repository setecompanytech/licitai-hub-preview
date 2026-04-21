/**
 * Valida e normaliza os campos extraídos pela IA antes de aplicá-los ao
 * registro pai (`contratos`). Garante que o Dashboard não receba dados
 * inválidos (datas inconsistentes, valores absurdos, strings vazias, etc.).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const MAX_VALOR = 1_000_000_000_000; // R$ 1 trilhão — sanity ceiling
const MAX_MESES = 120; // 10 anos

function toIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  if (ISO_DATE.test(s)) {
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : s;
  }
  const m = s.match(BR_DATE);
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(iso + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

function toPositiveNumber(v: unknown, max = MAX_VALOR): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

function toCleanString(v: unknown, maxLen = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > maxLen) return null;
  return s;
}

export interface NormalizedExtraction {
  numero_contrato?: string;
  numero_ata?: string;
  objeto?: string;
  orgao_contratante?: string;
  modalidade?: string;
  valor_global?: number;
  data_assinatura?: string;
  data_inicio?: string;
  data_fim?: string;
  vigencia_meses?: number;
  validade_ata_meses?: number;
}

export interface ValidationReport {
  normalized: NormalizedExtraction;
  rejected: string[];
}

/**
 * Recebe o payload bruto da IA e retorna apenas os campos que passaram nas
 * validações de tipo, intervalo e coerência. Campos rejeitados são listados.
 */
export function validateExtractedContract(raw: any): ValidationReport {
  const out: NormalizedExtraction = {};
  const rejected: string[] = [];
  if (!raw || typeof raw !== 'object') return { normalized: out, rejected: ['payload_vazio'] };

  const numContrato = toCleanString(raw.numero_contrato, 80);
  if (numContrato) out.numero_contrato = numContrato;
  else if (raw.numero_contrato) rejected.push('numero_contrato');

  const numAta = toCleanString(raw.numero_ata, 80);
  if (numAta) out.numero_ata = numAta;
  else if (raw.numero_ata) rejected.push('numero_ata');

  const objeto = toCleanString(raw.objeto, 2000);
  if (objeto) out.objeto = objeto;
  else if (raw.objeto) rejected.push('objeto');

  const orgao = toCleanString(raw.orgao_contratante ?? raw.orgao, 300);
  if (orgao) out.orgao_contratante = orgao;
  else if (raw.orgao_contratante || raw.orgao) rejected.push('orgao_contratante');

  const modalidade = toCleanString(raw.modalidade, 80);
  if (modalidade) out.modalidade = modalidade;
  else if (raw.modalidade) rejected.push('modalidade');

  const valor = toPositiveNumber(raw.valor_global);
  if (valor !== null) out.valor_global = valor;
  else if (raw.valor_global !== undefined && raw.valor_global !== null) rejected.push('valor_global');

  const dAssinatura = toIsoDate(raw.data_assinatura);
  if (dAssinatura) out.data_assinatura = dAssinatura;
  else if (raw.data_assinatura) rejected.push('data_assinatura');

  const dInicio = toIsoDate(raw.data_inicio);
  if (dInicio) out.data_inicio = dInicio;
  else if (raw.data_inicio) rejected.push('data_inicio');

  const dFim = toIsoDate(raw.data_fim);
  if (dFim) out.data_fim = dFim;
  else if (raw.data_fim) rejected.push('data_fim');

  // Coerência: data_inicio ≤ data_fim. Se inválido, descarta data_fim.
  if (out.data_inicio && out.data_fim && out.data_inicio > out.data_fim) {
    rejected.push('data_fim_anterior_a_inicio');
    delete out.data_fim;
  }
  // Coerência: data_assinatura ≤ data_inicio (assinatura não pode ser depois).
  if (out.data_assinatura && out.data_inicio && out.data_assinatura > out.data_inicio) {
    rejected.push('data_assinatura_posterior_a_inicio');
    delete out.data_assinatura;
  }

  const vigMeses = toPositiveNumber(raw.vigencia_meses, MAX_MESES);
  if (vigMeses !== null && Number.isInteger(vigMeses)) out.vigencia_meses = vigMeses;
  else if (raw.vigencia_meses) rejected.push('vigencia_meses');

  const valMeses = toPositiveNumber(raw.validade_ata_meses, MAX_MESES);
  if (valMeses !== null && Number.isInteger(valMeses)) out.validade_ata_meses = valMeses;
  else if (raw.validade_ata_meses) rejected.push('validade_ata_meses');

  return { normalized: out, rejected };
}

/**
 * Decide quais campos validados devem ser enviados ao UPDATE, respeitando
 * o princípio: nunca sobrescrever edições manuais já presentes no parent.
 */
export function buildParentUpdates(
  normalized: NormalizedExtraction,
  parent: any,
  parentTipo: 'ata_srp' | 'contrato',
): Record<string, any> {
  const u: Record<string, any> = {};
  if (!parent) return u;

  // Identificadores
  if (parentTipo === 'ata_srp') {
    if (normalized.numero_ata && !parent.numero_ata) u.numero_ata = normalized.numero_ata;
    if (normalized.validade_ata_meses && !parent.validade_ata_meses) {
      u.validade_ata_meses = normalized.validade_ata_meses;
    } else if (normalized.vigencia_meses && !parent.validade_ata_meses) {
      u.validade_ata_meses = normalized.vigencia_meses;
    }
  }
  if (normalized.numero_contrato && (!parent.numero_contrato || /^(SEM|TBD|--)/i.test(parent.numero_contrato))) {
    u.numero_contrato = normalized.numero_contrato;
  }

  if (normalized.objeto && !parent.objeto) u.objeto = normalized.objeto;
  // Coluna real é `orgao_contratante`
  if (normalized.orgao_contratante && !parent.orgao_contratante) {
    u.orgao_contratante = normalized.orgao_contratante;
  }
  if (normalized.modalidade && !parent.modalidade) u.modalidade = normalized.modalidade;

  // Financeiro: jamais sobrescrever valor manual já gravado
  if (normalized.valor_global && !(Number(parent.valor_global_original) > 0)) {
    u.valor_global_original = normalized.valor_global;
    if (!(Number(parent.valor_global) > 0)) u.valor_global = normalized.valor_global;
  }

  // Datas
  if (normalized.data_assinatura && !parent.data_assinatura) u.data_assinatura = normalized.data_assinatura;
  if (normalized.data_inicio && !parent.data_inicio) u.data_inicio = normalized.data_inicio;
  if (normalized.data_fim && !parent.data_fim) u.data_fim = normalized.data_fim;

  if (parentTipo === 'contrato' && normalized.vigencia_meses && !parent.vigencia_meses) {
    u.vigencia_meses = normalized.vigencia_meses;
  }

  return u;
}
