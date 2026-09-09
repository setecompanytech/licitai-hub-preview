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
 *   apura-se por trimestre no consolidado da empresa (Lei 9.430/96) — aqui
 *   entra só como alíquota MARGINAL declarada quando a base presumida anual da
 *   empresa já excede o limite (R$ 240 mil/ano): cada real novo de faturamento
 *   carrega 10% sobre a presunção. A auditoria de 09/2026 pegou exatamente o
 *   erro de tratá-lo como mensal — não repetir.
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
  aliquota_csll?: number | null;
  aliquota_pis?: number | null;
  aliquota_cofins?: number | null;
  aliquota_icms?: number | null;
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

export function estimarImpostoDoContrato(params: {
  regimeCadastro: string | null | undefined;
  config: ConfigTributariaLinha;
  /** Receita bruta da empresa nos últimos 12 meses (contrato incluído). */
  receita12mEmpresa: number;
  /** Faturamento do contrato dentro desses 12 meses. */
  faturadoContrato: number;
}): EstimativaImposto {
  const { config, receita12mEmpresa, faturadoContrato } = params;
  const regime = regimeDaEmpresa(params.regimeCadastro);
  const receitaAntes = Math.max(0, receita12mEmpresa - faturadoContrato);
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
    const alCsll = num(config?.aliquota_csll, 9);
    const alPis = num(config?.aliquota_pis, 0.65);
    const alCofins = num(config?.aliquota_cofins, 3);
    const alIcms = num(config?.aliquota_icms, 0);
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
    if (alIcms > 0) base.componentes.push({ nome: `ICMS (${alIcms}%)`, valor: round2(icms) });
    else premissas.push('ICMS com alíquota zero na configuração — se a operação não for ST/isenta, configure em Apuração.');

    let total = irpj + csll + pis + cofins + icms;

    // Adicional de IRPJ: trimestral e consolidado — atribuível ao contrato só
    // como MARGINAL, quando a base presumida anual da empresa já excede o
    // limite mesmo sem ele (aí cada real novo paga o adicional inteiro).
    const basePresumidaAnualSem = receitaAntes * (presIrpj / 100);
    if (basePresumidaAnualSem >= LIMITE_ADICIONAL_IRPJ_ANUAL) {
      const adicional = faturadoContrato * (presIrpj / 100) * (alAdic / 100);
      base.componentes.push({ nome: `Adicional IRPJ marginal (${alAdic}% × ${presIrpj}%)`, valor: round2(adicional) });
      total += adicional;
      premissas.push('Base presumida da empresa já excede R$ 240 mil/ano sem este contrato — o faturamento dele paga o adicional de IRPJ integralmente (marginal).');
    } else {
      premissas.push('Adicional de IRPJ apura-se por trimestre no consolidado — não atribuído ao contrato porque a base da empresa não excede o limite sem ele.');
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
