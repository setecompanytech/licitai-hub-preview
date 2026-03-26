export type JsonRecord = Record<string, unknown>;

export interface ExtractedRepresentanteData {
  repNome?: string;
  repCpf?: string;
  repRg?: string;
  repOrgaoExp?: string;
  repCargo?: string;
  repNaturalidade?: string;
  repNacionalidade?: string;
}

const GENERIC_EXAMPLE_VALUES = {
  repNome: ['nome completo', 'nome completo do representante', 'representante legal'],
  repCpf: ['000.000.000-00', 'cpf'],
  repRg: ['número do rg', 'numero do rg', 'rg'],
  repOrgaoExp: ['ssp/xx', 'órgão expedidor', 'orgão expedidor', 'orgao expedidor'],
  repNaturalidade: ['cidade/uf', 'naturalidade'],
  repNacionalidade: ['nacionalidade'],
} as const;

export function extractFirstJsonObject(content: string): JsonRecord | null {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? content;
  const trimmed = candidate.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonRecord) : null;
  } catch {
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonRecord) : null;
    } catch {
      return null;
    }
  }
}

function sanitizeGenericFieldValue(field: keyof ExtractedRepresentanteData, value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!trimmed) return '';

  if (field === 'repCpf' && trimmed.replace(/\D/g, '') === '00000000000') {
    return '';
  }

  if (field === 'repNaturalidade' && /cidade\s*\/\s*uf/i.test(trimmed)) {
    return '';
  }

  if (field === 'repOrgaoExp' && /^ssp\s*\/\s*xx$/i.test(trimmed)) {
    return '';
  }

  const genericValues = GENERIC_EXAMPLE_VALUES[field] ?? [];
  if (genericValues.some((item) => normalized === item)) {
    return '';
  }

  return trimmed;
}

function readStringField(source: JsonRecord, field: keyof ExtractedRepresentanteData, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      const sanitized = sanitizeGenericFieldValue(field, value);
      if (sanitized) return sanitized;
    }
  }

  return '';
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return value.trim();
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function hasUsableCpf(value?: string) {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length === 11 && digits !== '00000000000';
}

function hasUsableRg(value?: string) {
  const trimmed = value?.trim() ?? '';
  const normalized = trimmed.toLowerCase();
  return Boolean(trimmed) && !['rg', 'numero do rg', 'número do rg'].includes(normalized);
}

export function normalizeRepresentanteData(raw: JsonRecord): ExtractedRepresentanteData {
  return {
    repNome: readStringField(raw, 'repNome', ['repNome', 'nome', 'representante', 'nomeRepresentante']),
    repCpf: formatCpf(readStringField(raw, 'repCpf', ['repCpf', 'cpf', 'cpfRepresentante'])),
    repRg: readStringField(raw, 'repRg', ['repRg', 'rg', 'rgRepresentante', 'numeroRg']),
    repOrgaoExp: readStringField(raw, 'repOrgaoExp', ['repOrgaoExp', 'repOrgaoExpedidor', 'orgaoExpedidor', 'orgao_expedidor']),
    repCargo: readStringField(raw, 'repCargo', ['repCargo', 'cargo', 'funcao', 'qualificacao']),
    repNaturalidade: readStringField(raw, 'repNaturalidade', ['repNaturalidade', 'naturalidade', 'cidadeNascimento']),
    repNacionalidade: readStringField(raw, 'repNacionalidade', ['repNacionalidade', 'nacionalidade']),
  };
}

export function hasCoreRepresentanteValues(data: ExtractedRepresentanteData) {
  return Boolean((data.repNome && data.repNome.trim()) || hasUsableCpf(data.repCpf) || hasUsableRg(data.repRg));
}