import { describe, it, expect } from 'vitest';
import { adicionalMarginalAnual, estimarImpostoDoContrato, LIMITE_ADICIONAL_IRPJ_ANUAL } from './imposto-do-contrato';
import { regimeParaCadastro } from '@/lib/tributario/regime';

/** O texto que o CADASTRO da empresa guarda para o presumido. */
const PRESUMIDO = regimeParaCadastro('presumido');

/** Configuração do presumido como a ETHOS tem (22/09): 8/12, 15 + 10, 9, 0,65, 3, ICMS 18. */
const presumido = {
  presuncao_irpj_comercio: 8, presuncao_csll_comercio: 12, aliquota_irpj: 15, adicional_irpj: 10,
  aliquota_csll: 9, aliquota_pis: 0.65, aliquota_cofins: 3, aliquota_icms: 18,
};
const componente = (e: ReturnType<typeof estimarImpostoDoContrato>, inicio: string) =>
  e.componentes.find((c) => c.nome.startsWith(inicio))?.valor ?? 0;

describe('adicional de IRPJ marginal', () => {
  it('base abaixo do limite mesmo com o contrato: nada', () => {
    expect(adicionalMarginalAnual({ receita12mSemContrato: 1_000_000, faturado12mContrato: 1_000_000, presuncaoPct: 8, adicionalPct: 10 })).toBe(0);
    // 2 mi × 8% = 160 mil < 240 mil
  });
  it('só a parte que o contrato leva acima do limite paga os 10%', () => {
    // sem: 2 mi × 8% = 160 mil (abaixo); com: 6 mi × 8% = 480 mil → excedente 240 mil → 24 mil
    expect(adicionalMarginalAnual({ receita12mSemContrato: 2_000_000, faturado12mContrato: 4_000_000, presuncaoPct: 8, adicionalPct: 10 })).toBe(24_000);
    // a empresa já excedia: cada real novo paga inteiro — 4 mi × 8% × 10% = 32 mil
    expect(adicionalMarginalAnual({ receita12mSemContrato: 5_000_000, faturado12mContrato: 4_000_000, presuncaoPct: 8, adicionalPct: 10 })).toBe(32_000);
    expect(LIMITE_ADICIONAL_IRPJ_ANUAL).toBe(240_000);
  });
  it('limite configurado pela empresa vence o padrão', () => {
    expect(adicionalMarginalAnual({ receita12mSemContrato: 0, faturado12mContrato: 1_000_000, presuncaoPct: 8, adicionalPct: 10, limiteAnual: 60_000 })).toBe(2_000);
  });
});

describe('estimativa do presumido', () => {
  it('o 068/2025 (22/09): o adicional que antes era omitido entra como marginal', () => {
    // Receita 12m da empresa 10,2 mi, toda do contrato: sem ele a base é zero;
    // com ele 10.229.184 × 8% = 818.334,72 → excedente 578.334,72 × 10% = 57.833,47.
    const e = estimarImpostoDoContrato({
      regimeCadastro: PRESUMIDO, config: presumido,
      receita12mEmpresa: 10_229_184, faturadoContrato: 10_229_184,
    });
    expect(componente(e, 'Adicional IRPJ marginal')).toBe(57_833.47);
    expect(componente(e, 'IRPJ (8% × 15%)')).toBe(122_750.21);
    expect(componente(e, 'ICMS (18%)')).toBe(1_841_253.12);
    expect(e.premissas.some((p) => p.includes('NOMINAL'))).toBe(true);
  });

  it('janelas iguais: contrato mais velho que a janela só move a base com o que faturou nos 12 meses', () => {
    const e = estimarImpostoDoContrato({
      regimeCadastro: PRESUMIDO, config: presumido,
      receita12mEmpresa: 3_000_000, faturadoContrato: 10_000_000, faturadoContrato12m: 3_000_000,
    });
    expect(e.antes.receita).toBe(0);
    expect(e.depois.receita).toBe(3_000_000);
    // marginal anual: 3 mi × 8% = 240 mil → excedente 0 → sem adicional
    expect(componente(e, 'Adicional IRPJ marginal')).toBe(0);
    expect(e.premissas.some((p) => p.startsWith('Janelas iguais'))).toBe(true);
    // o linear continua sobre os 10 mi inteiros
    expect(componente(e, 'PIS (0.65%)')).toBe(65_000);
  });

  it('a taxa anual do marginal aplica-se ao faturado inteiro', () => {
    const e = estimarImpostoDoContrato({
      regimeCadastro: PRESUMIDO, config: presumido,
      receita12mEmpresa: 6_000_000, faturadoContrato: 8_000_000, faturadoContrato12m: 4_000_000,
    });
    // sem: 2 mi × 8% = 160 mil; com: 6 mi × 8% = 480 mil → 24 mil no ano sobre 4 mi = 0,6% → 48 mil nos 8 mi
    expect(componente(e, 'Adicional IRPJ marginal')).toBe(48_000);
  });

  it('ICMS efetivo configurado vence o nominal e a premissa diz os dois', () => {
    const e = estimarImpostoDoContrato({
      regimeCadastro: PRESUMIDO, config: { ...presumido, aliquota_icms_efetiva: 7 },
      receita12mEmpresa: 1_000_000, faturadoContrato: 1_000_000,
    });
    expect(componente(e, 'ICMS efetivo (7%')).toBe(70_000);
    expect(e.componentes.some((c) => c.nome === 'ICMS (18%)')).toBe(false);
    expect(e.premissas.some((p) => p.includes('efetiva configurada (7%)') && p.includes('nominal é 18%'))).toBe(true);
  });

  it('sem regime não estima; sem faturamento não estima', () => {
    expect(estimarImpostoDoContrato({ regimeCadastro: null, config: presumido, receita12mEmpresa: 1, faturadoContrato: 1 }).imposto).toBe(0);
    expect(estimarImpostoDoContrato({ regimeCadastro: PRESUMIDO, config: presumido, receita12mEmpresa: 1, faturadoContrato: 0 }).imposto).toBe(0);
  });
});
