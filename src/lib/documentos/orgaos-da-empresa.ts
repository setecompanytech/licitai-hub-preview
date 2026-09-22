import type { OrgaoCadastradoPelaEmpresa } from '@/data/certidoes-catalogo';

/**
 * O órgão municipal cadastrado pela empresa — a ponte entre a linha de
 * `certidoes_orgaos_da_empresa` (migration 20260923000005), o formulário e o
 * catálogo. Nada aqui escreve no banco: são as regras de leitura, de
 * validação e da linha a gravar.
 */
export interface LinhaDeOrgao {
  id: string;
  empresa_id: string;
  esfera: string;
  uf: string;
  municipio: string;
  nome_orgao: string;
  site: string | null;
  email: string | null;
  instrucoes: string | null;
  validade_dias: number | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/** A linha gravada, como o catálogo a entende. Linha de outra esfera é ignorada (nula). */
export function orgaoDaLinha(l: LinhaDeOrgao): OrgaoCadastradoPelaEmpresa | null {
  if (l.esfera !== 'municipal') return null;
  return {
    id: l.id,
    esfera: 'municipal',
    uf: l.uf,
    municipio: l.municipio,
    nomeDoOrgao: l.nome_orgao,
    site: l.site,
    email: l.email,
    instrucoes: l.instrucoes,
    validadeDias: l.validade_dias,
  };
}

export function orgaosDasLinhas(linhas: LinhaDeOrgao[]): OrgaoCadastradoPelaEmpresa[] {
  return linhas.map(orgaoDaLinha).filter((o): o is OrgaoCadastradoPelaEmpresa => o !== null);
}

/* ── O formulário ───────────────────────────────────────────────────────── */

/** O que a pessoa digita — tudo texto, como vem dos campos. */
export interface DadosDoOrgao {
  nomeDoOrgao: string;
  site?: string;
  email?: string;
  instrucoes?: string;
  /** Dias, como texto; vazio = conforme o documento ou o edital. */
  validadeDias?: string;
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const VALIDADE_MAXIMA_DIAS = 3650;

/** "sefin.belem.pa.gov.br" vira "https://sefin.belem.pa.gov.br"; endereço com esquema fica como está. */
export function normalizarSite(site?: string): string | null {
  const s = site?.trim() ?? '';
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function siteValido(site: string): boolean {
  try {
    const u = new URL(site);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Os erros de preenchimento, por extenso. Vazio = pode gravar. */
export function validarOrgao(d: DadosDoOrgao): string[] {
  const erros: string[] = [];
  if (!d.nomeDoOrgao?.trim()) erros.push('Informe o nome do órgão (ex.: Prefeitura Municipal de X · Secretaria de Finanças).');
  const site = normalizarSite(d.site);
  if (site && !siteValido(site)) erros.push('O site do órgão não parece um endereço válido.');
  const email = d.email?.trim();
  if (email && !EMAIL_VALIDO.test(email)) erros.push('O e-mail do órgão não parece válido.');
  const validade = d.validadeDias?.trim();
  if (validade) {
    const n = Number(validade);
    if (!Number.isInteger(n) || n < 1 || n > VALIDADE_MAXIMA_DIAS) {
      erros.push(`A validade usual é um número inteiro de dias, de 1 a ${VALIDADE_MAXIMA_DIAS}.`);
    }
  }
  if (!site && !email) erros.push('Informe ao menos um canal: o site do órgão ou o e-mail.');
  return erros;
}

/** A linha a gravar em `certidoes_orgaos_da_empresa`, já limpa. */
export function linhaDoOrgao(
  d: DadosDoOrgao,
  contexto: { empresaId: string; userId: string; uf: string; municipio: string },
) {
  const validade = d.validadeDias?.trim();
  return {
    empresa_id: contexto.empresaId,
    user_id: contexto.userId,
    esfera: 'municipal' as const,
    uf: contexto.uf.trim().toUpperCase(),
    municipio: contexto.municipio.trim(),
    nome_orgao: d.nomeDoOrgao.trim(),
    site: normalizarSite(d.site),
    email: d.email?.trim() || null,
    instrucoes: d.instrucoes?.trim() || null,
    validade_dias: validade ? Number(validade) : null,
  };
}

/** O formulário preenchido a partir de um cadastro existente, para corrigir. */
export function dadosDoOrgao(o: OrgaoCadastradoPelaEmpresa): DadosDoOrgao {
  return {
    nomeDoOrgao: o.nomeDoOrgao,
    site: o.site ?? '',
    email: o.email ?? '',
    instrucoes: o.instrucoes ?? '',
    validadeDias: o.validadeDias ? String(o.validadeDias) : '',
  };
}

/** Texto discreto enquanto a migration não foi colada — nunca um alarme vermelho. */
export const AVISO_ORGAOS_INDISPONIVEIS =
  'O cadastro do órgão municipal fica disponível após a atualização do banco (migration 20260923000005).';
