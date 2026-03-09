/**
 * Motor Determinístico de Composição de Custo e Formação de Preço
 * Conforme Lei nº 14.133/2021, LC 123/2006, Acórdãos TCU
 *
 * Metodologia: Mark-up Divisor (cálculo "por dentro")
 * Fórmula: Preço = Custo / (1 - Σ alíquotas%)
 *
 * O usuário pode sobrescrever o preço final e o motor recalcula
 * automaticamente a margem de lucro resultante.
 */

import {
  ANEXOS_SIMPLES, getAnexoById, calcularSimplesNacional, getPartilhaSimplesReal,
  type AnexoSimples,
} from '@/data/simples-nacional-anexos';

// ── Financial rounding ──
const r2 = (v: number): number => Math.round(v * 100) / 100;

// ── Types ──

export interface ComposicaoItemInput {
  descricao: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number; // cost of acquisition per unit
}

export interface ComposicaoParametros {
  regime: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
  uf: string;
  icmsInterno: number;
  issRate: number;
  atividade: 'comercio' | 'servicos' | 'industria';
  margemLucroPerc: number;
  fretePerc: number;
  despesasAdmPerc: number;
  // Simples Nacional specific
  rbt12?: number;
  anexoId?: string;
}

export interface ComponenteCusto {
  id: string;
  componente: string;
  baseCalculo: number;
  aliquota: number | null;
  valor: number;
  editavel: boolean; // can user override this value?
  formula: string;   // audit trail
}

export interface ItemComposicaoResult {
  descricao: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
  componentes: ComponenteCusto[];
  subtotalCusto: number;
  totalTributos: number;
  totalFrete: number;
  totalDespAdm: number;
  totalMargem: number;
  bdiPercentual: number;
  bdiValor: number;
  precoUnitarioSugerido: number;
  precoUnitarioFinal: number; // user can override
  precoTotal: number;
  modoPreco: 'sugerido' | 'manual';
  margemResultante: number; // recalculated if manual
}

export interface TributoDetalhe {
  imposto: string;
  aliquota: number;
  valor: number;
  info: string;
}

export interface ResumoComposicao {
  custoTotalMateriais: number;
  totalTributos: number;
  tributosPorImposto: TributoDetalhe[];
  bdiTotal: number;
  bdiPercentual: number;
  fretePercentual: number;
  freteTotal: number;
  despesasAdmPercentual: number;
  despesasAdm: number;
  margemLucroSugerida: number;
  margemLucroResultante: number;
  precoTotalFormado: number;
}

export interface ParecerComposicao {
  viabilidade: 'VIÁVEL' | 'ATENÇÃO' | 'INVIÁVEL';
  margemLiquida: number;
  alertaInexequibilidade: boolean;
  observacoes: string;
  fundamentacaoLegal: string[];
}

export interface ComposicaoResult {
  itens: ItemComposicaoResult[];
  resumo: ResumoComposicao;
  parecer: ParecerComposicao;
  parametros: ComposicaoParametros;
}

// ── Tax rate resolver ──

interface TributoConfig {
  nome: string;
  aliquota: number;
  info: string;
}

function getTributosRegime(params: ComposicaoParametros): TributoConfig[] {
  const { regime, uf, icmsInterno, issRate, atividade, rbt12, anexoId } = params;

  if (regime === 'simples_nacional') {
    const anexo = getAnexoById(anexoId || 'anexo_i') || ANEXOS_SIMPLES[0];
    const faturamento = rbt12 || 0;
    if (faturamento > 0) {
      const partilha = getPartilhaSimplesReal(faturamento, anexo, icmsInterno, issRate);
      if (partilha) {
        // Filter out the "DAS Total" summary entry and map to TributoConfig
        return partilha
          .filter(t => t.nome !== 'DAS Total')
          .map(t => ({ nome: t.nome, aliquota: t.aliquota, info: t.info }));
      }
    }
    // Fallback: use DAS effective rate
    const simples = calcularSimplesNacional(faturamento || 180000, anexo);
    return [{ nome: 'DAS (Unificado)', aliquota: simples.aliquotaEfetiva, info: `Alíquota efetiva do Simples Nacional` }];
  }

  if (regime === 'lucro_presumido') {
    const baseIRPJ = atividade === 'servicos' ? 32 : 8;
    const baseCSLL = atividade === 'servicos' ? 32 : 12;
    const tributos: TributoConfig[] = [
      { nome: 'IRPJ', aliquota: r2(15 * baseIRPJ / 100), info: `15% sobre base presumida de ${baseIRPJ}% = ${r2(15 * baseIRPJ / 100)}%` },
      { nome: 'CSLL', aliquota: r2(9 * baseCSLL / 100), info: `9% sobre base presumida de ${baseCSLL}% = ${r2(9 * baseCSLL / 100)}%` },
      { nome: 'COFINS', aliquota: 3, info: 'Regime cumulativo: 3%' },
      { nome: 'PIS/PASEP', aliquota: 0.65, info: 'Regime cumulativo: 0,65%' },
    ];
    if (atividade === 'servicos') {
      tributos.push({ nome: 'ISS', aliquota: issRate, info: `ISS municipal: ${issRate}%` });
    } else {
      tributos.push({ nome: 'ICMS', aliquota: icmsInterno, info: `ICMS ${uf}: ${icmsInterno}%` });
    }
    return tributos;
  }

  // Lucro Real
  const tributos: TributoConfig[] = [
    { nome: 'COFINS', aliquota: 7.6, info: 'Não-cumulativo: 7,6%' },
    { nome: 'PIS/PASEP', aliquota: 1.65, info: 'Não-cumulativo: 1,65%' },
  ];
  if (atividade === 'servicos') {
    tributos.push({ nome: 'ISS', aliquota: issRate, info: `ISS municipal: ${issRate}%` });
  } else {
    tributos.push({ nome: 'ICMS', aliquota: icmsInterno, info: `ICMS ${uf}: ${icmsInterno}%` });
  }
  // IRPJ and CSLL on Lucro Real are on profit, not revenue — simplified as effective rates
  tributos.push({ nome: 'IRPJ', aliquota: 2.28, info: 'Estimativa s/ receita (~15% sobre margem ~15,2%)' });
  tributos.push({ nome: 'CSLL', aliquota: 1.08, info: 'Estimativa s/ receita (~9% sobre margem ~12%)' });
  return tributos;
}

// ══════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ══════════════════════════════════════════════════════════════════

export function calcularComposicao(
  itens: ComposicaoItemInput[],
  params: ComposicaoParametros,
  overrides?: Record<number, number> // index -> manual precoUnitarioFinal
): ComposicaoResult {
  const tributos = getTributosRegime(params);
  const somaAliquotasTributos = tributos.reduce((s, t) => s + t.aliquota, 0);
  const { margemLucroPerc, fretePerc, despesasAdmPerc } = params;

  // Total percentage of indirect costs applied "por dentro"
  const somaPercentuais = somaAliquotasTributos + fretePerc + despesasAdmPerc + margemLucroPerc;

  // Divisor for mark-up calculation: Preço = Custo / (1 - soma%)
  const divisor = 1 - somaPercentuais / 100;
  const divisorSafe = divisor > 0.01 ? divisor : 0.01; // prevent division by zero

  const itensResult: ItemComposicaoResult[] = itens.map((item, idx) => {
    const custo = item.custoUnitario;
    const qtd = item.quantidade;

    // Suggested price using mark-up divisor
    const precoSugerido = r2(custo / divisorSafe);

    // Check for manual override
    const hasOverride = overrides && overrides[idx] !== undefined && overrides[idx] > 0;
    const precoFinal = hasOverride ? overrides[idx] : precoSugerido;
    const modoPreco = hasOverride ? 'manual' as const : 'sugerido' as const;

    // Calculate components based on final price (always "por dentro")
    const componentes: ComponenteCusto[] = [];

    // 1. Custo direto do material
    componentes.push({
      id: `${idx}_custo`,
      componente: 'Custo Direto do Material',
      baseCalculo: custo,
      aliquota: null,
      valor: custo,
      editavel: false,
      formula: `Custo de aquisição = R$ ${custo.toFixed(2)}`,
    });

    // 2. Tributos (calculated on the final price)
    let totalTributos = 0;
    tributos.forEach((trib, ti) => {
      const valor = r2(precoFinal * (trib.aliquota / 100));
      totalTributos += valor;
      componentes.push({
        id: `${idx}_trib_${ti}`,
        componente: `${trib.nome} (${trib.aliquota.toFixed(2)}%)`,
        baseCalculo: precoFinal,
        aliquota: trib.aliquota,
        valor,
        editavel: false,
        formula: `${precoFinal.toFixed(2)} × ${trib.aliquota}% = ${valor.toFixed(2)} — ${trib.info}`,
      });
    });

    // 3. Frete
    const valorFrete = r2(precoFinal * (fretePerc / 100));
    if (fretePerc > 0) {
      componentes.push({
        id: `${idx}_frete`,
        componente: `Frete (${fretePerc}%)`,
        baseCalculo: precoFinal,
        aliquota: fretePerc,
        valor: valorFrete,
        editavel: false,
        formula: `${precoFinal.toFixed(2)} × ${fretePerc}% = ${valorFrete.toFixed(2)}`,
      });
    }

    // 4. Despesas Administrativas
    const valorDespAdm = r2(precoFinal * (despesasAdmPerc / 100));
    if (despesasAdmPerc > 0) {
      componentes.push({
        id: `${idx}_despadm`,
        componente: `Despesas Administrativas (${despesasAdmPerc}%)`,
        baseCalculo: precoFinal,
        aliquota: despesasAdmPerc,
        valor: valorDespAdm,
        editavel: false,
        formula: `${precoFinal.toFixed(2)} × ${despesasAdmPerc}% = ${valorDespAdm.toFixed(2)}`,
      });
    }

    // 5. Margem de Lucro — this is what adjusts when user overrides
    const margemValor = r2(precoFinal - custo - totalTributos - valorFrete - valorDespAdm);
    const margemResultante = precoFinal > 0 ? r2((margemValor / precoFinal) * 100) : 0;

    componentes.push({
      id: `${idx}_margem`,
      componente: hasOverride
        ? `Margem de Lucro Resultante (${margemResultante.toFixed(2)}%)`
        : `Margem de Lucro (${margemLucroPerc}%)`,
      baseCalculo: precoFinal,
      aliquota: margemResultante,
      valor: margemValor,
      editavel: true,
      formula: hasOverride
        ? `Preço Manual R$ ${precoFinal.toFixed(2)} − Custo R$ ${custo.toFixed(2)} − Tributos R$ ${totalTributos.toFixed(2)} − Frete R$ ${valorFrete.toFixed(2)} − Desp. Adm. R$ ${valorDespAdm.toFixed(2)} = R$ ${margemValor.toFixed(2)}`
        : `${precoFinal.toFixed(2)} × ${margemLucroPerc}% = ${r2(precoFinal * margemLucroPerc / 100).toFixed(2)}`,
    });

    // BDI = everything above cost / cost
    const bdiValor = r2(precoFinal - custo);
    const bdiPercentual = custo > 0 ? r2((bdiValor / custo) * 100) : 0;

    return {
      descricao: item.descricao,
      quantidade: qtd,
      unidade: item.unidade,
      custoUnitario: custo,
      componentes,
      subtotalCusto: custo,
      totalTributos,
      totalFrete: valorFrete,
      totalDespAdm: valorDespAdm,
      totalMargem: margemValor,
      bdiPercentual,
      bdiValor,
      precoUnitarioSugerido: precoSugerido,
      precoUnitarioFinal: precoFinal,
      precoTotal: r2(precoFinal * qtd),
      modoPreco,
      margemResultante,
    };
  });

  // ── Resumo ──
  const custoTotalMateriais = r2(itensResult.reduce((s, i) => s + i.custoUnitario * i.quantidade, 0));
  const totalTributos = r2(itensResult.reduce((s, i) => s + i.totalTributos * i.quantidade, 0));
  const freteTotal = r2(itensResult.reduce((s, i) => s + i.totalFrete * i.quantidade, 0));
  const despesasAdmTotal = r2(itensResult.reduce((s, i) => s + i.totalDespAdm * i.quantidade, 0));
  const margemTotal = r2(itensResult.reduce((s, i) => s + i.totalMargem * i.quantidade, 0));
  const precoTotalFormado = r2(itensResult.reduce((s, i) => s + i.precoTotal, 0));
  const bdiTotalValor = r2(precoTotalFormado - custoTotalMateriais);
  const bdiTotalPerc = custoTotalMateriais > 0 ? r2((bdiTotalValor / custoTotalMateriais) * 100) : 0;
  const margemResultanteGlobal = precoTotalFormado > 0 ? r2((margemTotal / precoTotalFormado) * 100) : 0;

  const tributosPorImposto: TributoDetalhe[] = tributos.map(t => {
    const valor = r2(itensResult.reduce((s, i) => {
      const comp = i.componentes.find(c => c.componente.startsWith(t.nome));
      return s + (comp ? comp.valor * i.quantidade : 0);
    }, 0));
    return { imposto: t.nome, aliquota: t.aliquota, valor, info: t.info };
  });

  const resumo: ResumoComposicao = {
    custoTotalMateriais,
    totalTributos,
    tributosPorImposto,
    bdiTotal: bdiTotalValor,
    bdiPercentual: bdiTotalPerc,
    fretePercentual: fretePerc,
    freteTotal,
    despesasAdmPercentual: despesasAdmPerc,
    despesasAdm: despesasAdmTotal,
    margemLucroSugerida: margemLucroPerc,
    margemLucroResultante: margemResultanteGlobal,
    precoTotalFormado,
  };

  // ── Parecer ──
  const alerta = margemResultanteGlobal < 5;
  const inviavel = margemResultanteGlobal < 0;
  const parecer: ParecerComposicao = {
    viabilidade: inviavel ? 'INVIÁVEL' : alerta ? 'ATENÇÃO' : 'VIÁVEL',
    margemLiquida: margemResultanteGlobal,
    alertaInexequibilidade: alerta,
    observacoes: inviavel
      ? `Margem líquida de ${margemResultanteGlobal.toFixed(2)}% indica operação com prejuízo. O preço final não cobre custos + tributos.`
      : alerta
      ? `Margem líquida de ${margemResultanteGlobal.toFixed(2)}% está abaixo de 5%. Risco de inexequibilidade conforme Art. 59, §4º, Lei 14.133/21.`
      : `Margem líquida de ${margemResultanteGlobal.toFixed(2)}%. Precificação dentro dos parâmetros de viabilidade.`,
    fundamentacaoLegal: [
      'Lei 14.133/21, Art. 59, §4º',
      'Acórdão TCU 2.622/2013 (BDI referencial)',
      ...(params.regime === 'simples_nacional' ? ['LC 123/2006, Resolução CGSN nº 140/2018'] : []),
      ...(params.regime === 'lucro_presumido' ? ['Lei 9.430/96 (Lucro Presumido)'] : []),
      ...(params.regime === 'lucro_real' ? ['Lei 9.718/98 (Lucro Real)'] : []),
    ],
  };

  return { itens: itensResult, resumo, parecer, parametros: params };
}

/**
 * Recalcula a composição quando o usuário altera o preço final de um item.
 * Mantém todos os parâmetros originais mas aplica o override de preço,
 * recalculando a margem de lucro resultante.
 */
export function recalcularComOverride(
  result: ComposicaoResult,
  itemIndex: number,
  novoPrecoUnitario: number
): ComposicaoResult {
  const inputs = result.itens.map(i => ({
    descricao: i.descricao,
    quantidade: i.quantidade,
    unidade: i.unidade,
    custoUnitario: i.custoUnitario,
  }));

  // Collect existing overrides
  const overrides: Record<number, number> = {};
  result.itens.forEach((item, idx) => {
    if (item.modoPreco === 'manual') {
      overrides[idx] = item.precoUnitarioFinal;
    }
  });

  // Apply new override
  if (novoPrecoUnitario > 0) {
    overrides[itemIndex] = novoPrecoUnitario;
  } else {
    delete overrides[itemIndex]; // revert to suggested
  }

  return calcularComposicao(inputs, result.parametros, overrides);
}
