// ============================================================================
// PRAEFECTUS — Tabelas e calculadora INSS/IRRF 2026
// Path no Lovable: src/lib/financeiro/inss-irrf-2026.ts
// ============================================================================
// Fontes oficiais:
// - INSS: Portaria Interministerial MPS/MF nº 13/2026
// - IRRF: Lei nº 15.270/2025 (Reforma do Imposto de Renda)
// - Tabela progressiva IRRF: mantida desde maio/2025 (sem reajuste em 2026)
// - Redutor 2026: novidade da Lei 15.270/2025, isenta até R$ 5.000/mês
// ============================================================================

// ----------------------------------------------------------------------------
// CONSTANTES BASE 2026
// ----------------------------------------------------------------------------

export const SALARIO_MINIMO_2026 = 1621.00;
export const TETO_INSS_2026 = 8475.55;
export const DESCONTO_MAXIMO_INSS_2026 = 988.09;

export const DEDUCAO_DEPENDENTE_2026 = 189.59;          // por dependente/mês
export const DESCONTO_SIMPLIFICADO_2026 = 607.20;       // mensal
export const ISENCAO_IDOSO_65_2026 = 1903.98;           // adicional p/ aposentado 65+

// Faixa de aplicação do redutor 2026 (Lei 15.270/2025)
export const REDUTOR_2026_FAIXA_INICIO = 5000.01;
export const REDUTOR_2026_FAIXA_FIM = 7350.00;
export const REDUTOR_2026_BASE = 978.62;
export const REDUTOR_2026_FATOR = 0.133145;

// ----------------------------------------------------------------------------
// TABELA INSS 2026 (Portaria Interministerial MPS/MF nº 13/2026)
// ----------------------------------------------------------------------------
// Cálculo progressivo: cada faixa incide apenas sobre a parcela do salário
// que se enquadra no intervalo.
// ----------------------------------------------------------------------------

export interface FaixaINSS {
  inicio: number;
  fim: number;
  aliquota: number;     // decimal: 0.075 = 7.5%
}

export const TABELA_INSS_2026: readonly FaixaINSS[] = Object.freeze([
  { inicio: 0,        fim: 1621.00, aliquota: 0.075 },
  { inicio: 1621.01,  fim: 2902.84, aliquota: 0.09  },
  { inicio: 2902.85,  fim: 4354.27, aliquota: 0.12  },
  { inicio: 4354.28,  fim: 8475.55, aliquota: 0.14  },
]);

// ----------------------------------------------------------------------------
// TABELA IRRF PROGRESSIVA 2026 (mantida desde maio/2025)
// ----------------------------------------------------------------------------

export interface FaixaIRRF {
  inicio: number;
  fim: number;
  aliquota: number;       // decimal
  parcelaDeduzir: number;
}

export const TABELA_IRRF_2026: readonly FaixaIRRF[] = Object.freeze([
  { inicio: 0,        fim: 2428.80, aliquota: 0,      parcelaDeduzir: 0      },
  { inicio: 2428.81,  fim: 2826.65, aliquota: 0.075,  parcelaDeduzir: 182.16 },
  { inicio: 2826.66,  fim: 3751.05, aliquota: 0.15,   parcelaDeduzir: 394.16 },
  { inicio: 3751.06,  fim: 4664.68, aliquota: 0.225,  parcelaDeduzir: 675.49 },
  { inicio: 4664.69,  fim: Infinity, aliquota: 0.275, parcelaDeduzir: 908.73 },
]);

// ============================================================================
// CALCULADORA INSS
// ============================================================================

export interface ResultadoINSS {
  base: number;
  total: number;
  aliquotaEfetiva: number;
  detalhamento: Array<{
    faixa: number;          // 1, 2, 3, 4
    inicio: number;
    fim: number;
    aliquota: number;
    parcela: number;        // quanto do salário ficou nesta faixa
    contribuicao: number;
  }>;
  atingiu_teto: boolean;
}

/**
 * Calcula o INSS pelo método progressivo oficial (não pela fórmula simplificada).
 * Cada faixa contribui com (parcela_no_intervalo × aliquota).
 */
export function calcularINSS(salarioBruto: number): ResultadoINSS {
  const base = Math.min(salarioBruto, TETO_INSS_2026);
  const detalhamento: ResultadoINSS["detalhamento"] = [];
  let total = 0;

  for (let i = 0; i < TABELA_INSS_2026.length; i++) {
    const faixa = TABELA_INSS_2026[i];
    if (base <= faixa.inicio - 0.01) break;

    const limite_inferior = i === 0 ? 0 : faixa.inicio;
    const limite_superior = Math.min(base, faixa.fim);
    const parcela = Math.max(0, limite_superior - limite_inferior);

    if (parcela <= 0) continue;

    const contribuicao = round2(parcela * faixa.aliquota);
    detalhamento.push({
      faixa: i + 1,
      inicio: faixa.inicio,
      fim: faixa.fim,
      aliquota: faixa.aliquota,
      parcela: round2(parcela),
      contribuicao,
    });
    total += contribuicao;
  }

  total = Math.min(round2(total), DESCONTO_MAXIMO_INSS_2026);
  const aliquotaEfetiva = salarioBruto > 0 ? total / salarioBruto : 0;

  return {
    base,
    total,
    aliquotaEfetiva: round4(aliquotaEfetiva),
    detalhamento,
    atingiu_teto: salarioBruto >= TETO_INSS_2026,
  };
}

// ============================================================================
// CALCULADORA IRRF (com redutor 2026 da Reforma do IR)
// ============================================================================

export interface ParametrosIRRF {
  rendimentoBruto: number;        // antes do INSS
  inssDescontado: number;
  dependentes?: number;           // padrão 0
  pensaoAlimenticia?: number;     // dedutível
  outrasDeducoes?: number;        // ex: previdência privada PGBL
  usarSimplificado?: boolean;     // R$ 607,20 vs deduções legais
  idadeMaisDe65?: boolean;
}

export interface ResultadoIRRF {
  baseSemReforma: number;       // base usando regra antiga
  baseComReforma: number;       // base efetiva (mantém a maior dedução)
  imposto_tabela: number;       // imposto pela tabela progressiva
  redutor_2026: number;         // desconto da Lei 15.270/2025
  imposto_final: number;        // imposto efetivo a recolher
  faixa_aplicada: number;
  aliquota_aplicada: number;
  aliquota_efetiva: number;
  isento: boolean;
  isento_pela_reforma: boolean;
  detalhes: {
    deducao_dependentes: number;
    deducao_pensao: number;
    deducao_inss: number;
    deducao_outras: number;
    deducao_simplificada_aplicada: number;
    deducao_total: number;
    parcela_a_deduzir: number;
  };
}

/**
 * Calcula o IRRF aplicando a tabela progressiva e o redutor da Reforma 2026.
 *
 * Regra Lei 15.270/2025:
 * - Renda mensal (bruta) ≤ R$ 5.000 → imposto zerado pelo redutor
 * - Renda entre R$ 5.000,01 e R$ 7.350 → redutor parcial:
 *     redutor = R$ 978,62 − (0,133145 × rendimentoBruto), limitado ao imposto
 * - Renda > R$ 7.350 → tabela progressiva sem redutor
 */
export function calcularIRRF(p: ParametrosIRRF): ResultadoIRRF {
  const dependentes = p.dependentes ?? 0;
  const pensao = p.pensaoAlimenticia ?? 0;
  const outras = p.outrasDeducoes ?? 0;

  // Deduções legais
  const deducaoDependentes = dependentes * DEDUCAO_DEPENDENTE_2026;
  const deducaoLegal = p.inssDescontado + deducaoDependentes + pensao + outras;

  // Decide entre dedução legal vs simplificada (R$ 607,20)
  // O contribuinte pode escolher; default = a maior
  const deducaoSimplificada = DESCONTO_SIMPLIFICADO_2026;
  const usarSimplificado = p.usarSimplificado ?? (deducaoSimplificada > deducaoLegal);
  const deducaoTotal = usarSimplificado ? deducaoSimplificada : deducaoLegal;

  let base = Math.max(0, p.rendimentoBruto - deducaoTotal);

  // Aposentado/pensionista 65+ tem isenção adicional
  if (p.idadeMaisDe65) {
    base = Math.max(0, base - ISENCAO_IDOSO_65_2026);
  }

  // Aplica tabela progressiva
  const faixa = TABELA_IRRF_2026.find((f) => base >= f.inicio && base <= f.fim)!;
  const faixaIndex = TABELA_IRRF_2026.indexOf(faixa);
  const impostoTabela = Math.max(0, round2(base * faixa.aliquota - faixa.parcelaDeduzir));

  // ============================================================================
  // REDUTOR 2026 (Lei 15.270/2025)
  // ============================================================================
  let redutor = 0;
  let isentoPelaReforma = false;

  if (p.rendimentoBruto <= 5000.00) {
    // Faixa 1 da reforma: zera totalmente
    redutor = impostoTabela;
    isentoPelaReforma = true;
  } else if (p.rendimentoBruto >= REDUTOR_2026_FAIXA_INICIO &&
             p.rendimentoBruto <= REDUTOR_2026_FAIXA_FIM) {
    // Faixa 2 da reforma: redução decrescente
    const r = REDUTOR_2026_BASE - (REDUTOR_2026_FATOR * p.rendimentoBruto);
    redutor = Math.max(0, Math.min(r, impostoTabela));
  }
  // Acima de R$ 7.350 → sem redutor

  const impostoFinal = round2(impostoTabela - redutor);
  const aliquotaEfetiva = p.rendimentoBruto > 0 ? impostoFinal / p.rendimentoBruto : 0;

  return {
    baseSemReforma: round2(p.rendimentoBruto - p.inssDescontado),
    baseComReforma: round2(base),
    imposto_tabela: impostoTabela,
    redutor_2026: round2(redutor),
    imposto_final: impostoFinal,
    faixa_aplicada: faixaIndex + 1,
    aliquota_aplicada: faixa.aliquota,
    aliquota_efetiva: round4(aliquotaEfetiva),
    isento: impostoFinal === 0,
    isento_pela_reforma: isentoPelaReforma,
    detalhes: {
      deducao_dependentes: round2(deducaoDependentes),
      deducao_pensao: round2(pensao),
      deducao_inss: round2(p.inssDescontado),
      deducao_outras: round2(outras),
      deducao_simplificada_aplicada: usarSimplificado ? deducaoSimplificada : 0,
      deducao_total: round2(deducaoTotal),
      parcela_a_deduzir: faixa.parcelaDeduzir,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================================
// TESTES DE SANIDADE (executar com Vitest/Jest)
// ============================================================================
/*
import { describe, expect, test } from 'vitest';

describe('INSS 2026', () => {
  test('salário R$ 3.000 → desconto R$ 248,61', () => {
    const r = calcularINSS(3000);
    expect(r.total).toBeCloseTo(248.61, 2);
  });
  test('salário R$ 5.000 → desconto R$ 501,50', () => {
    const r = calcularINSS(5000);
    expect(r.total).toBeCloseTo(501.50, 2);
  });
  test('teto: salário R$ 10.000 → desconto R$ 988,09', () => {
    const r = calcularINSS(10000);
    expect(r.total).toBeCloseTo(988.09, 2);
    expect(r.atingiu_teto).toBe(true);
  });
});

describe('IRRF 2026 com redutor', () => {
  test('R$ 4.000 → isento (abaixo de R$ 5.000)', () => {
    const inss = calcularINSS(4000).total;
    const r = calcularIRRF({ rendimentoBruto: 4000, inssDescontado: inss });
    expect(r.imposto_final).toBe(0);
    expect(r.isento_pela_reforma).toBe(true);
  });
  test('R$ 6.000 → redução parcial', () => {
    const inss = calcularINSS(6000).total;
    const r = calcularIRRF({ rendimentoBruto: 6000, inssDescontado: inss });
    // Redutor esperado: 978,62 - (0,133145 × 6.000) = 179,75
    expect(r.redutor_2026).toBeCloseTo(179.75, 2);
  });
  test('R$ 10.000 → tabela tradicional sem redutor', () => {
    const inss = calcularINSS(10000).total;
    const r = calcularIRRF({ rendimentoBruto: 10000, inssDescontado: inss });
    expect(r.redutor_2026).toBe(0);
    expect(r.faixa_aplicada).toBe(5); // alíquota 27,5%
  });
});
*/
