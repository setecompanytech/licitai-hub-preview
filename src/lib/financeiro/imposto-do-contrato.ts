/**
 * Estimativa do imposto que UM contrato carrega — e do efeito do seu
 * faturamento sobre a carga da empresa ("antes → depois").
 *
 * Regras da casa que este arquivo respeita:
 * - O regime vem do CADASTRO (empresas.regime_tributario) via regimeDaEmpresa;
 *   null é resposta ("ninguém escolheu"), nunca vira padrão inventado.
 * - Simples Nacional: a progressividade é por faixa de RBT12 — o "antes" é a
 *   receita 12m SEM o faturamento do contrato, o "depois" é COM. O imposto do
 *   contrato usa a alíquota efetiva do DEPOIS (é ela que o faturamento novo
 *   paga). Porte acompanha: ME ≤ 360 mil, EPP ≤ 4,8 mi (LC 123/2006, art. 3º);
 *   sublimite de R$ 3,6 mi tira ICMS/ISS do DAS (art. 13-A).
 * - Lucro Presumido: os tributos lineares (IRPJ base, CSLL, PIS, COFINS, ICMS)
 *   são atribuíveis ao contrato na proporção da receita. O ADICIONAL de IRPJ
 *   apura-se por trimestre no consolidado da empresa (Lei 9.430/96, art. 2º,
 *   §1º); aqui entra como MARGINAL: só a parte da base presumida que o
 *   contrato empurra para cima de R$ 240 mil/ano paga os 10% — nem o
 *   consolidado inteiro, nem zero. A auditoria de 09/2026 pegou o erro de
 *   tratá-lo como mensal; a de 22/09 pegou o "tudo ou nada" (o adicional só
 *   entrava quando a empresa já excedia o limite SEM o contrato, e omitia
 *   R$ 57,8 mil no 068/2025).
 * - JANELAS IGUAIS: a receita da empresa é dos últimos 12 meses; o faturado
 *   do contrato nessa conta tem de ser o dos mesmos 12 meses
 *   (`faturadoContrato12m`), não o acumulado desde a assinatura. O imposto
 *   linear continua sobre o faturado inteiro do contrato (é o que a DRE
 *   mostra); o marginal usa a taxa anual e a aplica ao inteiro.
 * - ICMS: a alíquota EFETIVA configurada (após crédito das entradas e
 *   benefício) vence a nominal; sem ela, usa a nominal e declara a premissa.
 * - Tudo é ESTIMATIVA gerencial para leitura de margem; a apuração oficial é a
 *   tela de Apuração. As premissas saem no resultado para a tela declarar.
 */
import { calcularSimples, type AnexoSimples } from '@/lib/financeiro/simples-nacional-2026';
import { regimeDaEmpresa, TETO_SIMPLES_NACIONAL, type RegimeApuracao } from '@/lib/tributario/regime';

export const LIMITE_ME = 360_000;
export const SUBLIMITE_ICMS_ISS = 3_600_000;
export const LIMITE_ADICIONAL_IRPJ_ANUAL = 240_000;

export type PorteEmpresa = 'ME' | 'EPP' | 'Demais';

export function porteDaReceita(receitaAnual: number): PorteEmpresa {
  if (receitaAnual <= LIMITE_ME) return 'ME';
  if (receitaAnual <= TETO_SIMPLES_NACIONAL) return 'EPP';
  return 'Demais';
}

export type ConfigTributariaLinha = {
  anexo_simples?: number | null;
  presuncao_irpj_comercio?: number | null;
  presuncao_csll_comercio?: number | null;
  aliquota_irpj?: number | null;
  adicional_irpj?: number | null;
  /** Limite ANUAL da base presumida a partir do qual incide o adicional (R$ 240 mil por padrão). */
  limite_adicional_irpj?: number | null;
  aliquota_csll?: number | null;
  aliquota_pis?: number | null;
  aliquota_cofins?: number | null;
  aliquota_icms?: number | null;
  /** ICMS efetivo (0–100) já com crédito e benefício; nulo = nominal. */
  aliquota_icms_efetiva?: number | null;
} | null;

export type EstimativaImposto = {
  regime: RegimeApuracao | null;
  rotuloRegime: string;
  /** Carga em R$ estimada sobre o faturado do contrato. */
  imposto: number;
  /** Carga em % sobre o faturado do contrato. */
  aliquotaSobreContrato: number;
  antes: { receita: number; porte: PorteEmpresa; faixa?: number; aliquotaEfetiva?: number };
  depois: { receita: number; porte: PorteEmpresa; faixa?: number; aliquotaEfetiva?: number };
  componentes: Array<{ nome: string; valor: number }>;
  avisos: string[];
  premissas: string[];
};

/**
 * O adicional de IRPJ que o faturamento de 12 meses do contrato empurra para
 * cima do limite anual: 10% sobre a parte da base presumida acima de R$ 240
 * mil que só existe por causa dele. Puro, para o teste provar as bordas.
 */
export function adicionalMarginalAnual(params: {
  receita12mSemContrato: number;
  faturado12mContrato: number;
  presuncaoPct: number;
  adicionalPct: number;
  limiteAnual?: number;
}): number {
  const limite = params.limiteAnual ?? LIMITE_ADICIONAL_IRPJ_ANUAL;
  const pres = params.presuncaoPct / 100;
  const baseSem = Math.max(0, params.receita12mSemContrato) * pres;
  const baseCom = (Math.max(0, params.receita12mSemContrato) + Math.max(0, params.faturado12mContrato)) * pres;
  const excedenteCom = Math.max(0, baseCom - limite);
  const excedenteSem = Math.max(0, baseSem - limite);
  return round2((excedenteCom - excedenteSem) * (params.adicionalPct / 100));
}

export function estimarImpostoDoContrato(params: {
  regimeCadastro: string | null | undefined;
  config: ConfigTributariaLinha;
  /** Receita bruta da empresa nos últimos 12 meses (contrato incluído). */
  receita12mEmpresa: number;
  /** Faturamento do contrato desde o início — a base do imposto linear. */
  faturadoContrato: number;
  /** Faturamento do contrato DENTRO dos mesmos 12 meses da receita; sem ele, assume o faturado inteiro. */
  faturadoContrato12m?: number;
}): EstimativaImposto {
  const { config, receita12mEmpresa, faturadoContrato } = params;
  const faturado12m = Math.min(
    Math.max(0, params.faturadoContrato12m ?? faturadoContrato),
    Math.max(0, faturadoContrato),
  );
  const regime = regimeDaEmpresa(params.regimeCadastro);
  const receitaAntes = Math.max(0, receita12mEmpresa - faturado12m);
  const avisos: string[] = [];
  const premissas: string[] = [];
  const base: EstimativaImposto = {
    regime,
    rotuloRegime:
      regime === 'simples' ? 'Simples Nacional' : regime === 'presumido' ? 'Lucro Presumido' : regime === 'real' ? 'Lucro Real' : 'não definido',
    imposto: 0,
    aliquotaSobreContrato: 0,
    antes: { receita: receitaAntes, porte: porteDaReceita(receitaAntes) },
    depois: { receita: receita12mEmpresa, porte: porteDaReceita(receita12mEmpresa) },
    componentes: [],
    avisos,
    premissas,
  };

  if (faturadoContrato <= 0) {
    premissas.push('Contrato ainda sem faturamento — nada a estimar.');
    return base;
  }

  if (!regime) {
    avisos.push('Regime tributário não definido no cadastro da empresa — defina em Configurações para o painel estimar o imposto.');
    return base;
  }

  if (params.faturadoContrato12m != null && faturado12m < faturadoContrato) {
    premissas.push(`Janelas iguais: dos ${fmt(faturadoContrato)} faturados pelo contrato, ${fmt(faturado12m)} caem nos mesmos 12 meses da receita da empresa — é essa parcela que move faixa, porte e adicional.`);
  }

  if (regime === 'simples') {
    const anexo = (config?.anexo_simples ?? 1) as AnexoSimples;
    if (!config?.anexo_simples) premissas.push('Anexo do Simples não configurado — estimado pelo Anexo I (comércio).');
    // receitaMes serve só ao DAS mensal; aqui o que importa é a AlEf da faixa.
    const antes = calcularSimples(receitaAntes, 0, anexo);
    const depois = calcularSimples(receita12mEmpresa, 0, anexo);
    base.antes = { ...base.antes, faixa: antes.faixa, aliquotaEfetiva: antes.aliquotaEfetiva };
    base.depois = { ...base.depois, faixa: depois.faixa, aliquotaEfetiva: depois.aliquotaEfetiva };
    base.imposto = round2(faturadoContrato * (depois.aliquotaEfetiva / 100));
    base.aliquotaSobreContrato = depois.aliquotaEfetiva;
    base.componentes.push({ nome: `DAS (Anexo ${anexo}, ${depois.faixa}ª faixa, alíquota efetiva ${depois.aliquotaEfetiva.toFixed(2)}%)`, valor: base.imposto });
    premissas.push('Imposto do contrato = faturado × alíquota efetiva do RBT12 COM o contrato — é a alíquota que o faturamento novo paga.');
    if (depois.faixa !== antes.faixa) {
      avisos.push(`O faturamento deste contrato levou a empresa da ${antes.faixa}ª para a ${depois.faixa}ª faixa do Simples (alíquota efetiva de ${antes.aliquotaEfetiva.toFixed(2)}% para ${depois.aliquotaEfetiva.toFixed(2)}%).`);
    }
    if (receitaAntes <= SUBLIMITE_ICMS_ISS && receita12mEmpresa > SUBLIMITE_ICMS_ISS) {
      avisos.push('A receita cruzou o SUBLIMITE de R$ 3,6 mi: ICMS/ISS saem do DAS e passam a ser recolhidos por fora (LC 123/2006, art. 13-A).');
    }
    if (receita12mEmpresa > TETO_SIMPLES_NACIONAL) {
      avisos.push('Receita 12m ACIMA do teto do Simples (R$ 4,8 mi): a empresa está em regra de exclusão — a estimativa perde validade e o enquadramento precisa de revisão.');
    }
    if (base.antes.porte !== base.depois.porte) {
      avisos.push(`Porte: a empresa passa de ${base.antes.porte} para ${base.depois.porte} com o faturamento deste contrato.`);
    }
    return base;
  }

  if (regime === 'presumido') {
    // Contrato de fornecimento = receita de COMÉRCIO (presunção 8%/12%).
    const presIrpj = num(config?.presuncao_irpj_comercio, 8);
    const presCsll = num(config?.presuncao_csll_comercio, 12);
    const alIrpj = num(config?.aliquota_irpj, 15);
    const alAdic = num(config?.adicional_irpj, 10);
    const limiteAdic = num(config?.limite_adicional_irpj, 0) > 0 ? num(config?.limite_adicional_irpj, 0) : LIMITE_ADICIONAL_IRPJ_ANUAL;
    const alCsll = num(config?.aliquota_csll, 9);
    const alPis = num(config?.aliquota_pis, 0.65);
    const alCofins = num(config?.aliquota_cofins, 3);
    const alIcmsNominal = num(config?.aliquota_icms, 0);
    const temEfetiva = config?.aliquota_icms_efetiva != null && !Number.isNaN(Number(config.aliquota_icms_efetiva));
    const alIcms = temEfetiva ? Number(config!.aliquota_icms_efetiva) : alIcmsNominal;
    premissas.push(`Contrato de fornecimento tratado como receita de comércio (presunção IRPJ ${presIrpj}% / CSLL ${presCsll}%).`);

    const irpj = faturadoContrato * (presIrpj / 100) * (alIrpj / 100);
    const csll = faturadoContrato * (presCsll / 100) * (alCsll / 100);
    const pis = faturadoContrato * (alPis / 100);
    const cofins = faturadoContrato * (alCofins / 100);
    const icms = faturadoContrato * (alIcms / 100);
    base.componentes.push(
      { nome: `IRPJ (${presIrpj}% × ${alIrpj}%)`, valor: round2(irpj) },
      { nome: `CSLL (${presCsll}% × ${alCsll}%)`, valor: round2(csll) },
      { nome: `PIS (${alPis}%)`, valor: round2(pis) },
      { nome: `COFINS (${alCofins}%)`, valor: round2(cofins) },
    );
    if (alIcms > 0) {
      base.componentes.push({ nome: temEfetiva ? `ICMS efetivo (${alIcms}%, após crédito e benefício)` : `ICMS (${alIcms}%)`, valor: round2(icms) });
    }
    if (temEfetiva) {
      premissas.push(`ICMS pela alíquota efetiva configurada (${alIcms}%)${alIcmsNominal > 0 && alIcmsNominal !== alIcms ? `; a nominal é ${alIcmsNominal}%` : ''}.`);
    } else if (alIcmsNominal > 0) {
      premissas.push(`ICMS pela alíquota NOMINAL (${alIcmsNominal}%), sem crédito das entradas nem benefício fiscal — configure a alíquota efetiva em Apuração para a estimativa parar de superestimar.`);
    } else {
      premissas.push('ICMS com alíquota zero na configuração — se a operação não for ST/isenta, configure em Apuração.');
    }

    let total = irpj + csll + pis + cofins + icms;

    // Adicional de IRPJ: marginal, sobre a parte da base presumida que o
    // faturamento de 12 meses do contrato empurra acima do limite anual.
    const adicionalAnual = adicionalMarginalAnual({
      receita12mSemContrato: receitaAntes,
      faturado12mContrato: faturado12m,
      presuncaoPct: presIrpj,
      adicionalPct: alAdic,
      limiteAnual: limiteAdic,
    });
    if (adicionalAnual > 0 && faturado12m > 0) {
      // A taxa anual (adicional ÷ faturado nos 12 meses) aplicada ao faturado
      // inteiro do contrato — a mesma base do imposto linear e da DRE.
      const taxa = adicionalAnual / faturado12m;
      const adicional = round2(faturadoContrato * taxa);
      base.componentes.push({
        nome: `Adicional IRPJ marginal (${alAdic}% × ${presIrpj}% sobre a base que o contrato leva acima de ${fmt(limiteAdic)}/ano)`,
        valor: adicional,
      });
      total += adicional;
      premissas.push(`Adicional de IRPJ: só a parte da base presumida que o contrato empurra acima de ${fmt(limiteAdic)}/ano paga os ${alAdic}% — ${fmt(adicionalAnual)} nos 12 meses (${(taxa * 100).toFixed(2)}% do faturado no período). A apuração oficial é trimestral e consolidada.`);
    } else {
      premissas.push(`Adicional de IRPJ apura-se por trimestre no consolidado — não atribuído ao contrato porque a base presumida da empresa, com ele, não passa de ${fmt(limiteAdic)}/ano.`);
    }

    base.imposto = round2(total);
    base.aliquotaSobreContrato = round2((total / faturadoContrato) * 100);
    return base;
  }

  // Lucro Real: depende do lucro efetivo — sem estimativa honesta por contrato.
  avisos.push('Lucro Real apura sobre o lucro efetivo consolidado — use a margem deste painel e a tela de Apuração; estimativa por contrato seria chute.');
  return base;
}

function num(v: number | null | undefined, padrao: number): number {
  return v == null || Number.isNaN(Number(v)) ? padrao : Number(v);
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function fmt(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
}
