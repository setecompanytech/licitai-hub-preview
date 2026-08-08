/**
 * Tabelas Oficiais do Simples Nacional — LC 123/2006
 * Resolução CGSN nº 140/2018
 * Fonte: Receita Federal do Brasil
 * 
 * Cada Anexo possui:
 * - Faixas de faturamento (RBT12) com alíquotas nominais e valores a deduzir
 * - Tabela de partilha (repartição dos tributos) por faixa
 */

export type PartilhaFaixa = {
  IRPJ: number;
  CSLL: number;
  COFINS: number;
  PIS: number;
  CPP: number;
  ICMS: number;
  ISS: number;
  IPI: number;
};

export type FaixaSimples = {
  min: number;
  max: number;
  aliquota: number;
  deducao: number;
  faixaNum: number;
};

export type AnexoSimples = {
  id: string;
  nome: string;
  descricao: string;
  tributosPrincipais: string[];
  faixas: FaixaSimples[];
  partilha: Record<number, PartilhaFaixa>;
};

const PARTILHA_ZERO: PartilhaFaixa = { IRPJ: 0, CSLL: 0, COFINS: 0, PIS: 0, CPP: 0, ICMS: 0, ISS: 0, IPI: 0 };

// ══════════════════════════════════════════════════════════════════
// ANEXO I — COMÉRCIO
// Resolução CGSN nº 140/2018, Anexo I
// ══════════════════════════════════════════════════════════════════
const ANEXO_I: AnexoSimples = {
  id: 'anexo_i',
  nome: 'Anexo I — Comércio',
  descricao: 'Receitas de revenda de mercadorias não sujeitas a substituição tributária ou monofásicas.',
  tributosPrincipais: ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'CPP', 'ICMS'],
  faixas: [
    { min: 0, max: 180_000, aliquota: 4.00, deducao: 0, faixaNum: 1 },
    { min: 180_000.01, max: 360_000, aliquota: 7.30, deducao: 5_940, faixaNum: 2 },
    { min: 360_000.01, max: 720_000, aliquota: 9.50, deducao: 13_860, faixaNum: 3 },
    { min: 720_000.01, max: 1_800_000, aliquota: 10.70, deducao: 22_500, faixaNum: 4 },
    { min: 1_800_000.01, max: 3_600_000, aliquota: 14.30, deducao: 87_300, faixaNum: 5 },
    { min: 3_600_000.01, max: 4_800_000, aliquota: 19.00, deducao: 378_000, faixaNum: 6 },
  ],
  partilha: {
    1: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
    2: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 41.50, ICMS: 34.00, ISS: 0, IPI: 0 },
    3: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 42.00, ICMS: 33.50, ISS: 0, IPI: 0 },
    4: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 42.00, ICMS: 33.50, ISS: 0, IPI: 0 },
    5: { IRPJ: 5.50, CSLL: 3.50, COFINS: 12.74, PIS: 2.76, CPP: 42.00, ICMS: 33.50, ISS: 0, IPI: 0 },
    6: { IRPJ: 13.50, CSLL: 10.00, COFINS: 28.27, PIS: 6.13, CPP: 42.10, ICMS: 0, ISS: 0, IPI: 0 },
  },
};

// ══════════════════════════════════════════════════════════════════
// ANEXO II — INDÚSTRIA
// Resolução CGSN nº 140/2018, Anexo II
// ══════════════════════════════════════════════════════════════════
const ANEXO_II: AnexoSimples = {
  id: 'anexo_ii',
  nome: 'Anexo II — Indústria',
  descricao: 'Receitas de venda de produtos industrializados pelo contribuinte.',
  tributosPrincipais: ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'CPP', 'ICMS', 'IPI'],
  faixas: [
    { min: 0, max: 180_000, aliquota: 4.50, deducao: 0, faixaNum: 1 },
    { min: 180_000.01, max: 360_000, aliquota: 7.80, deducao: 5_940, faixaNum: 2 },
    { min: 360_000.01, max: 720_000, aliquota: 10.00, deducao: 13_860, faixaNum: 3 },
    { min: 720_000.01, max: 1_800_000, aliquota: 11.20, deducao: 22_500, faixaNum: 4 },
    { min: 1_800_000.01, max: 3_600_000, aliquota: 14.70, deducao: 85_500, faixaNum: 5 },
    { min: 3_600_000.01, max: 4_800_000, aliquota: 30.00, deducao: 720_000, faixaNum: 6 },
  ],
  partilha: {
    1: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.50, ICMS: 32.00, ISS: 0, IPI: 7.50 },
    2: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.50, ICMS: 32.00, ISS: 0, IPI: 7.50 },
    3: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.50, ICMS: 32.00, ISS: 0, IPI: 7.50 },
    4: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.50, ICMS: 32.00, ISS: 0, IPI: 7.50 },
    5: { IRPJ: 5.50, CSLL: 3.50, COFINS: 11.51, PIS: 2.49, CPP: 37.50, ICMS: 32.00, ISS: 0, IPI: 7.50 },
    6: { IRPJ: 8.50, CSLL: 7.50, COFINS: 20.96, PIS: 4.54, CPP: 23.50, ICMS: 0, ISS: 0, IPI: 35.00 },
  },
};

// ══════════════════════════════════════════════════════════════════
// ANEXO III — SERVIÇOS (receitas de locação de bens móveis, 
// serviços de instalação/reparação/manutenção, agências de viagem,
// escritórios de contabilidade, academia, lab. análises, etc.)
// Resolução CGSN nº 140/2018, Anexo III
// ══════════════════════════════════════════════════════════════════
const ANEXO_III: AnexoSimples = {
  id: 'anexo_iii',
  nome: 'Anexo III — Serviços',
  descricao: 'Locação de bens móveis, instalações, reparação, academias, laboratórios, medicina, odontologia, contabilidade, etc.',
  tributosPrincipais: ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'CPP', 'ISS'],
  faixas: [
    { min: 0, max: 180_000, aliquota: 6.00, deducao: 0, faixaNum: 1 },
    { min: 180_000.01, max: 360_000, aliquota: 11.20, deducao: 9_360, faixaNum: 2 },
    { min: 360_000.01, max: 720_000, aliquota: 13.50, deducao: 17_640, faixaNum: 3 },
    { min: 720_000.01, max: 1_800_000, aliquota: 16.00, deducao: 35_640, faixaNum: 4 },
    { min: 1_800_000.01, max: 3_600_000, aliquota: 21.00, deducao: 125_640, faixaNum: 5 },
    { min: 3_600_000.01, max: 4_800_000, aliquota: 33.00, deducao: 648_000, faixaNum: 6 },
  ],
  partilha: {
    // IRPJ 4,00 nas faixas 1-5 (CGSN 140/2018). Estava 6,00 até 2026-08-08, o que
    // fazia a partilha somar 102% e inflar o divisor do mark-up — ver
    // src/test/tributario-partilha.test.ts.
    1: { IRPJ: 4.00, CSLL: 3.50, COFINS: 12.82, PIS: 2.78, CPP: 43.40, ICMS: 0, ISS: 33.50, IPI: 0 },
    2: { IRPJ: 4.00, CSLL: 3.50, COFINS: 14.05, PIS: 3.05, CPP: 43.40, ICMS: 0, ISS: 32.00, IPI: 0 },
    3: { IRPJ: 4.00, CSLL: 3.50, COFINS: 13.64, PIS: 2.96, CPP: 43.40, ICMS: 0, ISS: 32.50, IPI: 0 },
    4: { IRPJ: 4.00, CSLL: 3.50, COFINS: 13.64, PIS: 2.96, CPP: 43.40, ICMS: 0, ISS: 32.50, IPI: 0 },
    5: { IRPJ: 4.00, CSLL: 3.50, COFINS: 12.82, PIS: 2.78, CPP: 43.40, ICMS: 0, ISS: 33.50, IPI: 0 },
    6: { IRPJ: 35.00, CSLL: 15.00, COFINS: 16.03, PIS: 3.47, CPP: 30.50, ICMS: 0, ISS: 0, IPI: 0 },
  },
};

// ══════════════════════════════════════════════════════════════════
// ANEXO IV — SERVIÇOS (construção de imóveis, obras de engenharia,
// vigilância, limpeza, conservação, serviços advocatícios)
// NOTA: CPP NÃO é recolhido no DAS — recolhimento separado (INSS patronal 20%)
// Resolução CGSN nº 140/2018, Anexo IV
// ══════════════════════════════════════════════════════════════════
const ANEXO_IV: AnexoSimples = {
  id: 'anexo_iv',
  nome: 'Anexo IV — Serviços (Construção/Vigilância/Advocacia)',
  descricao: 'Construção de imóveis, obras de engenharia, vigilância, limpeza, conservação, advocacia. CPP recolhido separadamente (INSS 20%).',
  tributosPrincipais: ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'ISS'],
  faixas: [
    { min: 0, max: 180_000, aliquota: 4.50, deducao: 0, faixaNum: 1 },
    { min: 180_000.01, max: 360_000, aliquota: 9.00, deducao: 8_100, faixaNum: 2 },
    { min: 360_000.01, max: 720_000, aliquota: 10.20, deducao: 12_420, faixaNum: 3 },
    { min: 720_000.01, max: 1_800_000, aliquota: 14.00, deducao: 39_780, faixaNum: 4 },
    { min: 1_800_000.01, max: 3_600_000, aliquota: 22.00, deducao: 183_780, faixaNum: 5 },
    { min: 3_600_000.01, max: 4_800_000, aliquota: 33.00, deducao: 828_000, faixaNum: 6 },
  ],
  partilha: {
    // CPP = 0 pois é recolhido separadamente (INSS patronal 20%)
    1: { IRPJ: 18.80, CSLL: 15.20, COFINS: 17.67, PIS: 3.83, CPP: 0, ICMS: 0, ISS: 44.50, IPI: 0 },
    2: { IRPJ: 19.80, CSLL: 15.20, COFINS: 20.55, PIS: 4.45, CPP: 0, ICMS: 0, ISS: 40.00, IPI: 0 },
    3: { IRPJ: 20.80, CSLL: 15.20, COFINS: 19.73, PIS: 4.27, CPP: 0, ICMS: 0, ISS: 40.00, IPI: 0 },
    4: { IRPJ: 17.80, CSLL: 19.20, COFINS: 18.90, PIS: 4.10, CPP: 0, ICMS: 0, ISS: 40.00, IPI: 0 },
    5: { IRPJ: 18.80, CSLL: 19.20, COFINS: 18.08, PIS: 3.92, CPP: 0, ICMS: 0, ISS: 40.00, IPI: 0 },
    6: { IRPJ: 53.50, CSLL: 21.50, COFINS: 20.55, PIS: 4.45, CPP: 0, ICMS: 0, ISS: 0, IPI: 0 },
  },
};

// ══════════════════════════════════════════════════════════════════
// ANEXO V — SERVIÇOS (auditoria, jornalismo, tecnologia, 
// publicidade, engenharia, entre outros)
// Resolução CGSN nº 140/2018, Anexo V
// NOTA: Quando o fator "r" (folha/receita) ≥ 28%, migra para Anexo III
// ══════════════════════════════════════════════════════════════════
const ANEXO_V: AnexoSimples = {
  id: 'anexo_v',
  nome: 'Anexo V — Serviços (Tecnologia/Engenharia/Auditoria)',
  descricao: 'Auditoria, jornalismo, tecnologia, publicidade, engenharia, etc. Se fator "r" (folha/receita) ≥ 28%, tributa-se pelo Anexo III.',
  tributosPrincipais: ['IRPJ', 'CSLL', 'COFINS', 'PIS/PASEP', 'CPP', 'ISS'],
  faixas: [
    { min: 0, max: 180_000, aliquota: 15.50, deducao: 0, faixaNum: 1 },
    { min: 180_000.01, max: 360_000, aliquota: 18.00, deducao: 4_500, faixaNum: 2 },
    { min: 360_000.01, max: 720_000, aliquota: 19.50, deducao: 9_900, faixaNum: 3 },
    { min: 720_000.01, max: 1_800_000, aliquota: 20.50, deducao: 17_100, faixaNum: 4 },
    { min: 1_800_000.01, max: 3_600_000, aliquota: 23.00, deducao: 62_100, faixaNum: 5 },
    { min: 3_600_000.01, max: 4_800_000, aliquota: 30.50, deducao: 540_000, faixaNum: 6 },
  ],
  partilha: {
    1: { IRPJ: 25.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 28.85, ICMS: 0, ISS: 14.00, IPI: 0 },
    2: { IRPJ: 23.00, CSLL: 15.00, COFINS: 14.10, PIS: 3.05, CPP: 27.85, ICMS: 0, ISS: 17.00, IPI: 0 },
    3: { IRPJ: 24.00, CSLL: 15.00, COFINS: 14.92, PIS: 3.23, CPP: 23.85, ICMS: 0, ISS: 19.00, IPI: 0 },
    4: { IRPJ: 21.00, CSLL: 15.00, COFINS: 15.74, PIS: 3.41, CPP: 23.85, ICMS: 0, ISS: 21.00, IPI: 0 },
    5: { IRPJ: 23.00, CSLL: 12.50, COFINS: 14.10, PIS: 3.05, CPP: 23.85, ICMS: 0, ISS: 23.50, IPI: 0 },
    6: { IRPJ: 35.00, CSLL: 15.50, COFINS: 16.44, PIS: 3.56, CPP: 29.50, ICMS: 0, ISS: 0, IPI: 0 },
  },
};

export const ANEXOS_SIMPLES: AnexoSimples[] = [ANEXO_I, ANEXO_II, ANEXO_III, ANEXO_IV, ANEXO_V];

export function getAnexoById(id: string): AnexoSimples | undefined {
  return ANEXOS_SIMPLES.find(a => a.id === id);
}

export function calcularSimplesNacional(rbt12: number, anexo: AnexoSimples) {
  const faixa = anexo.faixas.find(f => rbt12 >= f.min && rbt12 <= f.max);
  if (!faixa) return { aliquotaEfetiva: 0, valorDAS: 0, faixa: null };
  const aliquotaEfetiva = ((rbt12 * faixa.aliquota / 100) - faixa.deducao) / rbt12 * 100;
  const receitaMensal = rbt12 / 12;
  const valorDAS = receitaMensal * (Math.max(0, aliquotaEfetiva) / 100);
  return { aliquotaEfetiva: Math.max(0, aliquotaEfetiva), valorDAS, faixa };
}

export function formatCurrencyShort(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return `R$ ${v}`;
}

/**
 * Calcula a partilha REAL dos tributos conforme LC 123/2006
 * Retorna array com cada tributo, sua alíquota efetiva e % de partilha
 */
export function getPartilhaSimplesReal(
  rbt12: number,
  anexo: AnexoSimples,
  icmsUFRate: number,
  issRate: number = 5
) {
  const faixa = anexo.faixas.find(f => rbt12 >= f.min && rbt12 <= f.max);
  if (!faixa) return null;

  const partilha = anexo.partilha[faixa.faixaNum];
  const ae = Math.max(0, ((rbt12 * faixa.aliquota / 100) - faixa.deducao) / rbt12 * 100);
  const faixaLabel = `${faixa.faixaNum}ª Faixa (RBT12 até ${formatCurrencyShort(faixa.max)})`;
  const sublimite6 = faixa.faixaNum === 6;
  const anexoNome = anexo.nome;

  const tributos: { nome: string; aliquota: number; percentPartilha: number; info: string }[] = [];

  // IRPJ
  if (partilha.IRPJ > 0) {
    tributos.push({
      nome: 'IRPJ',
      aliquota: +(ae * partilha.IRPJ / 100).toFixed(4),
      percentPartilha: partilha.IRPJ,
      info: `Partilha: ${partilha.IRPJ}% × ${ae.toFixed(2)}% = ${(ae * partilha.IRPJ / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // CSLL
  if (partilha.CSLL > 0) {
    tributos.push({
      nome: 'CSLL',
      aliquota: +(ae * partilha.CSLL / 100).toFixed(4),
      percentPartilha: partilha.CSLL,
      info: `Partilha: ${partilha.CSLL}% × ${ae.toFixed(2)}% = ${(ae * partilha.CSLL / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // COFINS
  if (partilha.COFINS > 0) {
    tributos.push({
      nome: 'COFINS',
      aliquota: +(ae * partilha.COFINS / 100).toFixed(4),
      percentPartilha: partilha.COFINS,
      info: `Partilha: ${partilha.COFINS}% × ${ae.toFixed(2)}% = ${(ae * partilha.COFINS / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // PIS/PASEP
  if (partilha.PIS > 0) {
    tributos.push({
      nome: 'PIS/PASEP',
      aliquota: +(ae * partilha.PIS / 100).toFixed(4),
      percentPartilha: partilha.PIS,
      info: `Partilha: ${partilha.PIS}% × ${ae.toFixed(2)}% = ${(ae * partilha.PIS / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // CPP
  if (partilha.CPP > 0) {
    tributos.push({
      nome: 'CPP',
      aliquota: +(ae * partilha.CPP / 100).toFixed(4),
      percentPartilha: partilha.CPP,
      info: `Partilha: ${partilha.CPP}% × ${ae.toFixed(2)}% = ${(ae * partilha.CPP / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  } else if (anexo.id === 'anexo_iv') {
    tributos.push({
      nome: 'CPP (INSS separado)',
      aliquota: 20,
      percentPartilha: 0,
      info: `Anexo IV: CPP não incluído no DAS. INSS patronal de 20% recolhido separadamente — Art. 18, §5º-C, LC 123/2006`,
    });
  }

  // ICMS (Anexo I e II)
  if (partilha.ICMS > 0 && !sublimite6) {
    tributos.push({
      nome: 'ICMS',
      aliquota: +(ae * partilha.ICMS / 100).toFixed(4),
      percentPartilha: partilha.ICMS,
      info: `Partilha: ${partilha.ICMS}% × ${ae.toFixed(2)}% = ${(ae * partilha.ICMS / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  } else if ((anexo.id === 'anexo_i' || anexo.id === 'anexo_ii') && sublimite6) {
    tributos.push({
      nome: 'ICMS (Sublimite)',
      aliquota: icmsUFRate,
      percentPartilha: 0,
      info: `6ª Faixa: ICMS cobrado separadamente a ${icmsUFRate}% (sublimite estadual — Art. 13-A, LC 123/2006)`,
    });
  }

  // ISS (Anexo III, IV e V)
  if (partilha.ISS > 0 && !sublimite6) {
    tributos.push({
      nome: 'ISS',
      aliquota: +(ae * partilha.ISS / 100).toFixed(4),
      percentPartilha: partilha.ISS,
      info: `Partilha: ${partilha.ISS}% × ${ae.toFixed(2)}% = ${(ae * partilha.ISS / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // IPI (Anexo II)
  if (partilha.IPI > 0) {
    tributos.push({
      nome: 'IPI',
      aliquota: +(ae * partilha.IPI / 100).toFixed(4),
      percentPartilha: partilha.IPI,
      info: `Partilha: ${partilha.IPI}% × ${ae.toFixed(2)}% = ${(ae * partilha.IPI / 100).toFixed(4)}% — ${faixaLabel} — ${anexoNome}`,
    });
  }

  // DAS Total
  tributos.push({
    nome: 'DAS Total',
    aliquota: +ae.toFixed(2),
    percentPartilha: 100,
    info: `Alíquota efetiva: [(RBT12 × ${faixa.aliquota}%) − R$ ${faixa.deducao.toLocaleString('pt-BR')}] / RBT12 = ${ae.toFixed(2)}% — ${faixaLabel}`,
  });

  return tributos;
}
