/**
 * Margem sugerida na ENTRADA da mercadoria: do custo da NF ao preço de venda.
 *
 *   preço = custo ÷ (1 − (tributos% + despesas operacionais% + margem alvo%)/100)
 *
 * As três parcelas vêm da realidade da empresa, nunca de chute:
 * - tributos%: estimados pelo MESMO motor do painel de contratos
 *   (imposto-do-contrato — regime do cadastro, Simples por faixa efetiva,
 *   Presumido com adicional marginal; Lucro Real devolve 0 com aviso);
 * - despesas operacionais%: DRE realizada — despesas que não são CMV nem
 *   movimentação, sobre a receita (mesma régua da Calculadora de Margem:
 *   transferência entre contas fica FORA das duas pontas);
 * - margem alvo%: configuração da empresa (financeiro_config_custos).
 *
 * O preço MÍNIMO (break-even) usa margem alvo 0: abaixo dele, vender é pagar
 * para entregar.
 */
import { LIMITE_ADICIONAL_IRPJ_ANUAL, type ConfigTributariaLinha } from '@/lib/financeiro/imposto-do-contrato';
import { calcularSimples, type AnexoSimples } from '@/lib/financeiro/simples-nacional-2026';
import { regimeDaEmpresa, TETO_SIMPLES_NACIONAL } from '@/lib/tributario/regime';

export type ParametrosPrecificacao = {
  cargaTributariaPerc: number;      // % 0–100
  despesaOperacionalPerc: number;   // % 0–100
  margemAlvoPerc: number;           // % 0–100
};

export type PrecoSugerido = {
  precoMinimo: number | null;    // break-even (margem 0)
  precoSugerido: number | null;  // com a margem alvo
  markupPerc: number | null;     // sobre o custo, do preço sugerido
  /** Soma trib+desp+alvo ≥ 100% — não existe preço que feche. */
  inviavel: boolean;
};

export function precificarEntrada(custo: number, p: ParametrosPrecificacao): PrecoSugerido {
  if (!(custo > 0)) return { precoMinimo: null, precoSugerido: null, markupPerc: null, inviavel: false };
  const fatorMinimo = 1 - (p.cargaTributariaPerc + p.despesaOperacionalPerc) / 100;
  const fatorAlvo = fatorMinimo - p.margemAlvoPerc / 100;
  const precoMinimo = fatorMinimo > 0 ? round2(custo / fatorMinimo) : null;
  const precoSugerido = fatorAlvo > 0 ? round2(custo / fatorAlvo) : null;
  return {
    precoMinimo,
    precoSugerido,
    markupPerc: precoSugerido ? round2(((precoSugerido - custo) / custo) * 100) : null,
    inviavel: fatorAlvo <= 0,
  };
}

export type SituacaoPrecoContrato = 'acima_sugerido' | 'entre_minimo_e_sugerido' | 'abaixo_minimo' | 'sem_referencia';

/** Confronta o preço praticado num contrato com a régua mínima/sugerida. */
export function situacaoDoPrecoContratado(precoContrato: number, s: PrecoSugerido): SituacaoPrecoContrato {
  if (!(precoContrato > 0) || s.precoMinimo == null) return 'sem_referencia';
  if (precoContrato < s.precoMinimo) return 'abaixo_minimo';
  if (s.precoSugerido != null && precoContrato >= s.precoSugerido) return 'acima_sugerido';
  return 'entre_minimo_e_sugerido';
}

export type AnaliseMargemEmpresa = {
  receita12m: number;
  despesaOperacionalPerc: number;
  cargaTributariaPerc: number;
  regimeRotulo: string;
  avisos: string[];
};

type LancParaAnalise = {
  natureza: string | null;
  valor: number;
  categoria: { grupo_dre?: string | null; natureza?: string | null } | null;
};

/**
 * Reduz lançamentos realizados (a_receber/a_pagar, 12 meses) aos percentuais
 * da fórmula. Regras herdadas da Calculadora de Margem/auditoria:
 * receita financeira fora do faturamento; CMV (grupo_dre cmv_cps) fora das
 * despesas operacionais — ele é o próprio custo que está sendo precificado;
 * movimentação fora de tudo.
 */
export function analisarParaMargem(
  lancamentos: LancParaAnalise[],
  regimeCadastro: string | null | undefined,
  configTributaria: ConfigTributariaLinha,
): AnaliseMargemEmpresa {
  let receita = 0, despesa = 0;
  for (const l of lancamentos) {
    const v = Number(l.valor) || 0;
    const grupo = l.categoria?.grupo_dre ?? null;
    const natCat = l.categoria?.natureza ?? null;
    if (natCat === 'movimentacao' || grupo === 'movimentacao') continue;
    if (l.natureza === 'receita') {
      if (grupo !== 'receita_financeira') receita += v;
    } else if (l.natureza === 'despesa') {
      if (grupo !== 'cmv_cps') despesa += v;
    }
  }

  // Carga tributária MÉDIA sobre a receita — diferente do motor marginal do
  // painel de contratos ("um contrato a mais"): aqui o adicional de IRPJ do
  // Presumido incide sobre o EXCEDENTE anual da base presumida, rateado pela
  // receita inteira. Reutilizar o marginal zerava o adicional (o "antes" da
  // empresa sem a própria receita é zero) e o preço sugerido nascia baixo.
  const regime = regimeDaEmpresa(regimeCadastro);
  const avisos: string[] = [];
  let carga = 0;
  let rotulo = 'não definido';
  if (!regime) {
    avisos.push('Regime tributário não definido no cadastro da empresa — defina em Configurações para a sugestão incluir tributos.');
  } else if (regime === 'simples') {
    rotulo = 'Simples Nacional';
    const anexo = (configTributaria?.anexo_simples ?? 1) as AnexoSimples;
    carga = receita > 0 ? calcularSimples(receita, 0, anexo).aliquotaEfetiva : 0;
    if (receita > TETO_SIMPLES_NACIONAL) {
      avisos.push('Receita 12m acima do teto do Simples (R$ 4,8 mi) — o enquadramento precisa de revisão e a carga estimada perde validade.');
    }
  } else if (regime === 'presumido') {
    rotulo = 'Lucro Presumido';
    const presIrpj = num(configTributaria?.presuncao_irpj_comercio, 8);
    const presCsll = num(configTributaria?.presuncao_csll_comercio, 12);
    const lineares =
      (presIrpj / 100) * (num(configTributaria?.aliquota_irpj, 15) / 100) +
      (presCsll / 100) * (num(configTributaria?.aliquota_csll, 9) / 100) +
      num(configTributaria?.aliquota_pis, 0.65) / 100 +
      num(configTributaria?.aliquota_cofins, 3) / 100 +
      num(configTributaria?.aliquota_icms, 0) / 100;
    const basePresumida = receita * (presIrpj / 100);
    const adicionalMedio = receita > 0
      ? (Math.max(0, basePresumida - LIMITE_ADICIONAL_IRPJ_ANUAL) * (num(configTributaria?.adicional_irpj, 10) / 100)) / receita
      : 0;
    carga = round2((lineares + adicionalMedio) * 100);
  } else {
    rotulo = 'Lucro Real';
    avisos.push('Lucro Real apura sobre o lucro efetivo — a sugestão sai sem parcela tributária; confira na Apuração.');
  }

  return {
    receita12m: round2(receita),
    despesaOperacionalPerc: receita > 0 ? round2((despesa / receita) * 100) : 0,
    cargaTributariaPerc: carga,
    regimeRotulo: rotulo,
    avisos,
  };
}

function num(v: number | null | undefined, padrao: number): number {
  return v == null || Number.isNaN(Number(v)) ? padrao : Number(v);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
