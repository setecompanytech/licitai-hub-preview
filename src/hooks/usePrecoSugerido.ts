/**
 * Hook para calcular preço de venda sugerido com base no regime tributário da empresa.
 * Utiliza o motor de composição determinística (Mark-up Divisor) para incluir
 * tributos, frete, despesas administrativas e margem de lucro.
 */

import { useMemo } from 'react';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  calcularComposicao,
  type ComposicaoParametros,
  type ComposicaoItemInput,
} from '@/lib/composicao-engine';

// ── UF → ICMS interno ──
const UF_ICMS: Record<string, number> = {
  AC: 19, AL: 19, AP: 18, AM: 20, BA: 20.5, CE: 20, DF: 20, ES: 17,
  GO: 19, MA: 22, MT: 17, MS: 17, MG: 18, PA: 19, PB: 20, PR: 19.5,
  PE: 20.5, PI: 21, RJ: 22, RN: 20, RS: 17, RO: 19.5, RR: 20,
  SC: 17, SP: 18, SE: 19, TO: 20,
};

// ── Defaults para despesas (conservador) ──
const DEFAULTS = {
  margemLucroPerc: 10,
  fretePerc: 2,
  despesasAdmPerc: 5,
  issRate: 3,
};

export interface PrecoSugerido {
  precoSugerido: number;
  bdiPercentual: number;
  totalTributoPerc: number;
  margemPerc: number;
  fretePerc: number;
  despAdmPerc: number;
  regimeLabel: string;
  detalhamento: string;
}

/**
 * Calcula o preço de venda sugerido a partir de um custo de aquisição.
 * Retorna null se não há empresa ativa ou regime tributário configurado.
 */
export function usePrecoSugerido(custoAquisicao: number | null): PrecoSugerido | null {
  const { empresaAtiva } = useEmpresa();

  return useMemo(() => {
    if (!custoAquisicao || custoAquisicao <= 0 || !empresaAtiva?.regime_tributario) {
      return null;
    }

    const regime = empresaAtiva.regime_tributario as 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
    const uf = empresaAtiva.uf || 'SP';
    const cnae = empresaAtiva.cnae_principal || '';
    const cnaePrefix = cnae.substring(0, 2);

    // Auto-detect activity type from CNAE
    let atividade: 'comercio' | 'servicos' | 'industria' = 'comercio';
    if (['62', '63', '69', '70', '71', '72', '73', '74', '78', '80', '81', '82'].includes(cnaePrefix)) {
      atividade = 'servicos';
    } else {
      const prefixNum = parseInt(cnaePrefix, 10);
      if (prefixNum >= 10 && prefixNum <= 33) atividade = 'industria';
    }

    const icmsInterno = UF_ICMS[uf] || 18;

    const params: ComposicaoParametros = {
      regime,
      uf,
      icmsInterno,
      issRate: atividade === 'servicos' ? DEFAULTS.issRate : 0,
      atividade,
      margemLucroPerc: DEFAULTS.margemLucroPerc,
      fretePerc: DEFAULTS.fretePerc,
      despesasAdmPerc: DEFAULTS.despesasAdmPerc,
      rbt12: regime === 'simples_nacional' ? 500000 : undefined, // fallback ~6% DAS
    };

    const itens: ComposicaoItemInput[] = [{
      descricao: 'Item',
      quantidade: 1,
      unidade: 'UN',
      custoUnitario: custoAquisicao,
    }];

    const result = calcularComposicao(itens, params);
    const item = result.itens[0];
    if (!item) return null;

    const regimeLabels: Record<string, string> = {
      simples_nacional: 'Simples Nacional',
      lucro_presumido: 'Lucro Presumido',
      lucro_real: 'Lucro Real',
    };

    const tribPerc = result.resumo.tributosPorImposto.reduce((s, t) => s + t.aliquota, 0);

    return {
      precoSugerido: item.precoUnitarioSugerido,
      bdiPercentual: item.bdiPercentual,
      totalTributoPerc: tribPerc,
      margemPerc: DEFAULTS.margemLucroPerc,
      fretePerc: DEFAULTS.fretePerc,
      despAdmPerc: DEFAULTS.despesasAdmPerc,
      regimeLabel: regimeLabels[regime] || regime,
      detalhamento: `Tributos: ${tribPerc.toFixed(1)}% | Frete: ${DEFAULTS.fretePerc}% | Desp. Adm.: ${DEFAULTS.despesasAdmPerc}% | Margem: ${DEFAULTS.margemLucroPerc}%`,
    };
  }, [custoAquisicao, empresaAtiva]);
}

/**
 * Função standalone para calcular preço sugerido (sem hook).
 * Útil para cálculos batch.
 */
export function calcularPrecoSugerido(
  custoAquisicao: number,
  regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real',
  uf: string,
  cnae?: string,
): number {
  if (custoAquisicao <= 0) return 0;

  const cnaePrefix = (cnae || '').substring(0, 2);
  let atividade: 'comercio' | 'servicos' | 'industria' = 'comercio';
  if (['62', '63', '69', '70', '71', '72', '73', '74', '78', '80', '81', '82'].includes(cnaePrefix)) {
    atividade = 'servicos';
  } else {
    const prefixNum = parseInt(cnaePrefix, 10);
    if (prefixNum >= 10 && prefixNum <= 33) atividade = 'industria';
  }

  const icmsInterno = UF_ICMS[uf] || 18;
  const params: ComposicaoParametros = {
    regime, uf, icmsInterno,
    issRate: atividade === 'servicos' ? DEFAULTS.issRate : 0,
    atividade,
    margemLucroPerc: DEFAULTS.margemLucroPerc,
    fretePerc: DEFAULTS.fretePerc,
    despesasAdmPerc: DEFAULTS.despesasAdmPerc,
    rbt12: regime === 'simples_nacional' ? 500000 : undefined,
  };

  const result = calcularComposicao(
    [{ descricao: 'Item', quantidade: 1, unidade: 'UN', custoUnitario: custoAquisicao }],
    params,
  );

  return result.itens[0]?.precoUnitarioSugerido ?? custoAquisicao;
}
