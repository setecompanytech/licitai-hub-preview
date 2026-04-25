// ============================================================================
// PRAEFECTUS — Tabelas Simples Nacional (LC 123/2006, Anexos I a V)
// Vigência: a partir de 2018, mantidas em 2026.
// ============================================================================

export type AnexoSimples = 1 | 2 | 3 | 4 | 5;

export interface FaixaSimples {
  inicio: number;          // RBT12 mínimo
  fim: number;             // RBT12 máximo
  aliquota: number;        // alíquota nominal (%)
  parcelaDeduzir: number;  // PD em R$
}

// Anexo I — Comércio
export const ANEXO_I: readonly FaixaSimples[] = Object.freeze([
  { inicio: 0,          fim: 180000,   aliquota: 4.00,  parcelaDeduzir: 0       },
  { inicio: 180000.01,  fim: 360000,   aliquota: 7.30,  parcelaDeduzir: 5940    },
  { inicio: 360000.01,  fim: 720000,   aliquota: 9.50,  parcelaDeduzir: 13860   },
  { inicio: 720000.01,  fim: 1800000,  aliquota: 10.70, parcelaDeduzir: 22500   },
  { inicio: 1800000.01, fim: 3600000,  aliquota: 14.30, parcelaDeduzir: 87300   },
  { inicio: 3600000.01, fim: 4800000,  aliquota: 19.00, parcelaDeduzir: 378000  },
]);

// Anexo II — Indústria
export const ANEXO_II: readonly FaixaSimples[] = Object.freeze([
  { inicio: 0,          fim: 180000,   aliquota: 4.50,  parcelaDeduzir: 0       },
  { inicio: 180000.01,  fim: 360000,   aliquota: 7.80,  parcelaDeduzir: 5940    },
  { inicio: 360000.01,  fim: 720000,   aliquota: 10.00, parcelaDeduzir: 13860   },
  { inicio: 720000.01,  fim: 1800000,  aliquota: 11.20, parcelaDeduzir: 22500   },
  { inicio: 1800000.01, fim: 3600000,  aliquota: 14.70, parcelaDeduzir: 85500   },
  { inicio: 3600000.01, fim: 4800000,  aliquota: 30.00, parcelaDeduzir: 720000  },
]);

// Anexo III — Serviços (locação, instalação, agências, etc.)
export const ANEXO_III: readonly FaixaSimples[] = Object.freeze([
  { inicio: 0,          fim: 180000,   aliquota: 6.00,  parcelaDeduzir: 0       },
  { inicio: 180000.01,  fim: 360000,   aliquota: 11.20, parcelaDeduzir: 9360    },
  { inicio: 360000.01,  fim: 720000,   aliquota: 13.50, parcelaDeduzir: 17640   },
  { inicio: 720000.01,  fim: 1800000,  aliquota: 16.00, parcelaDeduzir: 35640   },
  { inicio: 1800000.01, fim: 3600000,  aliquota: 21.00, parcelaDeduzir: 125640  },
  { inicio: 3600000.01, fim: 4800000,  aliquota: 33.00, parcelaDeduzir: 648000  },
]);

// Anexo IV — Serviços (limpeza, vigilância, construção, advocacia)
export const ANEXO_IV: readonly FaixaSimples[] = Object.freeze([
  { inicio: 0,          fim: 180000,   aliquota: 4.50,  parcelaDeduzir: 0       },
  { inicio: 180000.01,  fim: 360000,   aliquota: 9.00,  parcelaDeduzir: 8100    },
  { inicio: 360000.01,  fim: 720000,   aliquota: 10.20, parcelaDeduzir: 12420   },
  { inicio: 720000.01,  fim: 1800000,  aliquota: 14.00, parcelaDeduzir: 39780   },
  { inicio: 1800000.01, fim: 3600000,  aliquota: 22.00, parcelaDeduzir: 183780  },
  { inicio: 3600000.01, fim: 4800000,  aliquota: 33.00, parcelaDeduzir: 828000  },
]);

// Anexo V — Serviços técnicos/intelectuais (fator R)
export const ANEXO_V: readonly FaixaSimples[] = Object.freeze([
  { inicio: 0,          fim: 180000,   aliquota: 15.50, parcelaDeduzir: 0       },
  { inicio: 180000.01,  fim: 360000,   aliquota: 18.00, parcelaDeduzir: 4500    },
  { inicio: 360000.01,  fim: 720000,   aliquota: 19.50, parcelaDeduzir: 9900    },
  { inicio: 720000.01,  fim: 1800000,  aliquota: 20.50, parcelaDeduzir: 17100   },
  { inicio: 1800000.01, fim: 3600000,  aliquota: 23.00, parcelaDeduzir: 62100   },
  { inicio: 3600000.01, fim: 4800000,  aliquota: 30.50, parcelaDeduzir: 540000  },
]);

export const ANEXOS: Record<AnexoSimples, readonly FaixaSimples[]> = {
  1: ANEXO_I, 2: ANEXO_II, 3: ANEXO_III, 4: ANEXO_IV, 5: ANEXO_V,
};

export interface ResultadoSimples {
  rbt12: number;
  receitaMes: number;
  anexo: AnexoSimples;
  faixa: number;
  aliquotaNominal: number;
  parcelaDeduzir: number;
  aliquotaEfetiva: number; // %
  valorDevido: number;
  excedeuLimite: boolean;
}

/**
 * Cálculo do Simples Nacional:
 *   AlEf = ((RBT12 × Alíq) − PD) ÷ RBT12
 *   DAS  = Receita do mês × AlEf
 */
export function calcularSimples(
  rbt12: number,
  receitaMes: number,
  anexo: AnexoSimples
): ResultadoSimples {
  const tabela = ANEXOS[anexo];
  const baseRBT = rbt12 > 0 ? rbt12 : receitaMes * 12; // estimativa para iniciantes
  const faixa = tabela.find((f) => baseRBT >= f.inicio && baseRBT <= f.fim) || tabela[tabela.length - 1];
  const faixaIndex = tabela.indexOf(faixa) + 1;

  const aliqEfetiva = baseRBT > 0
    ? Math.max(0, ((baseRBT * (faixa.aliquota / 100)) - faixa.parcelaDeduzir) / baseRBT) * 100
    : 0;

  const valor = round2(receitaMes * (aliqEfetiva / 100));

  return {
    rbt12: baseRBT,
    receitaMes,
    anexo,
    faixa: faixaIndex,
    aliquotaNominal: faixa.aliquota,
    parcelaDeduzir: faixa.parcelaDeduzir,
    aliquotaEfetiva: round4(aliqEfetiva),
    valorDevido: valor,
    excedeuLimite: baseRBT > 4800000,
  };
}

// ============================================================================
// LUCRO PRESUMIDO
// ============================================================================

export interface ParametrosPresumido {
  receitaComercio: number;
  receitaServico: number;
  presuncaoIrpjComercio: number;   // %
  presuncaoIrpjServico: number;    // %
  presuncaoCsllComercio: number;   // %
  presuncaoCsllServico: number;    // %
  aliquotaIrpj: number;            // %
  adicionalIrpj: number;           // % sobre excedente
  limiteAdicionalIrpj: number;     // R$ mensal (default 20.000)
  aliquotaCsll: number;            // %
  aliquotaPis: number;             // % cumulativo
  aliquotaCofins: number;          // % cumulativo
  aliquotaIss: number;             // % sobre serviços
  aliquotaIcms: number;            // % sobre comércio
}

export interface ResultadoPresumido {
  receitaTotal: number;
  baseIrpj: number;
  baseCsll: number;
  irpj: number;
  adicionalIrpj: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  icms: number;
  total: number;
}

export function calcularPresumido(p: ParametrosPresumido): ResultadoPresumido {
  const receitaTotal = p.receitaComercio + p.receitaServico;

  const baseIrpj =
    p.receitaComercio * (p.presuncaoIrpjComercio / 100) +
    p.receitaServico * (p.presuncaoIrpjServico / 100);

  const baseCsll =
    p.receitaComercio * (p.presuncaoCsllComercio / 100) +
    p.receitaServico * (p.presuncaoCsllServico / 100);

  const irpj = baseIrpj * (p.aliquotaIrpj / 100);
  const excedente = Math.max(0, baseIrpj - p.limiteAdicionalIrpj);
  const adicional = excedente * (p.adicionalIrpj / 100);
  const csll = baseCsll * (p.aliquotaCsll / 100);

  // PIS/COFINS no presumido = regime cumulativo sobre receita bruta
  const pis = receitaTotal * (p.aliquotaPis / 100);
  const cofins = receitaTotal * (p.aliquotaCofins / 100);

  const iss = p.receitaServico * (p.aliquotaIss / 100);
  const icms = p.receitaComercio * (p.aliquotaIcms / 100);

  const total = irpj + adicional + csll + pis + cofins + iss + icms;

  return {
    receitaTotal: round2(receitaTotal),
    baseIrpj: round2(baseIrpj),
    baseCsll: round2(baseCsll),
    irpj: round2(irpj),
    adicionalIrpj: round2(adicional),
    csll: round2(csll),
    pis: round2(pis),
    cofins: round2(cofins),
    iss: round2(iss),
    icms: round2(icms),
    total: round2(total),
  };
}

// ============================================================================
// LUCRO REAL (estimativa mensal — apuração simplificada)
// ============================================================================

export interface ParametrosReal {
  receitaComercio: number;
  receitaServico: number;
  despesasOperacionais: number;     // total de despesas dedutíveis
  aliquotaIrpj: number;             // 15%
  adicionalIrpj: number;            // 10%
  limiteAdicionalIrpj: number;      // R$ 20.000/mês
  aliquotaCsll: number;             // 9%
  aliquotaPisNc: number;            // 1,65% (não-cumulativo)
  aliquotaCofinsNc: number;         // 7,60% (não-cumulativo)
  creditosPisCofins?: number;       // créditos de insumos (R$)
  aliquotaIss: number;
  aliquotaIcms: number;
}

export interface ResultadoReal {
  receitaTotal: number;
  lucroAntesIRCSLL: number;
  irpj: number;
  adicionalIrpj: number;
  csll: number;
  pis: number;
  cofins: number;
  iss: number;
  icms: number;
  total: number;
}

export function calcularReal(p: ParametrosReal): ResultadoReal {
  const receitaTotal = p.receitaComercio + p.receitaServico;
  const lucro = Math.max(0, receitaTotal - p.despesasOperacionais);

  const irpj = lucro * (p.aliquotaIrpj / 100);
  const excedente = Math.max(0, lucro - p.limiteAdicionalIrpj);
  const adicional = excedente * (p.adicionalIrpj / 100);
  const csll = lucro * (p.aliquotaCsll / 100);

  const creditos = p.creditosPisCofins ?? 0;
  const pis = Math.max(0, receitaTotal * (p.aliquotaPisNc / 100) - creditos * (p.aliquotaPisNc / (p.aliquotaPisNc + p.aliquotaCofinsNc)));
  const cofins = Math.max(0, receitaTotal * (p.aliquotaCofinsNc / 100) - creditos * (p.aliquotaCofinsNc / (p.aliquotaPisNc + p.aliquotaCofinsNc)));

  const iss = p.receitaServico * (p.aliquotaIss / 100);
  const icms = p.receitaComercio * (p.aliquotaIcms / 100);

  const total = irpj + adicional + csll + pis + cofins + iss + icms;

  return {
    receitaTotal: round2(receitaTotal),
    lucroAntesIRCSLL: round2(lucro),
    irpj: round2(irpj),
    adicionalIrpj: round2(adicional),
    csll: round2(csll),
    pis: round2(pis),
    cofins: round2(cofins),
    iss: round2(iss),
    icms: round2(icms),
    total: round2(total),
  };
}

// ============================================================================
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
