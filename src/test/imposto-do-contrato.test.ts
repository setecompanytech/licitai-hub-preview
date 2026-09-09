import { describe, expect, it } from 'vitest';
import { estimarImpostoDoContrato, porteDaReceita } from '@/lib/financeiro/imposto-do-contrato';

describe('porteDaReceita', () => {
  it('classifica ME, EPP e Demais nos limites da LC 123', () => {
    expect(porteDaReceita(360_000)).toBe('ME');
    expect(porteDaReceita(360_000.01)).toBe('EPP');
    expect(porteDaReceita(4_800_000)).toBe('EPP');
    expect(porteDaReceita(4_800_000.01)).toBe('Demais');
  });
});

describe('estimarImpostoDoContrato — Simples Nacional', () => {
  it('usa a alíquota efetiva do RBT12 COM o contrato (o "depois")', () => {
    // Santa Rosa-like: receita 12m 1.971.304,46, contrato faturou 869.063,20.
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'simples_nacional',
      config: { anexo_simples: 1 },
      receita12mEmpresa: 1_971_304.46,
      faturadoContrato: 869_063.2,
    });
    // Depois: 5ª faixa (1,8–3,6 mi), AlEf = (RBT12×14,3% − 87.300)/RBT12
    const alEfEsperada = ((1_971_304.46 * 0.143 - 87_300) / 1_971_304.46) * 100;
    expect(r.depois.faixa).toBe(5);
    expect(r.depois.aliquotaEfetiva).toBeCloseTo(alEfEsperada, 2);
    expect(r.imposto).toBeCloseTo(869_063.2 * (alEfEsperada / 100), 0);
    // Antes: 1.102.241,26 → 4ª faixa — o aviso de mudança de faixa dispara.
    expect(r.antes.faixa).toBe(4);
    expect(r.avisos.some(a => a.includes('4ª para a 5ª'))).toBe(true);
  });

  it('avisa quando o contrato cruza o sublimite de ICMS/ISS e muda o porte', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'simples_nacional',
      config: { anexo_simples: 1 },
      receita12mEmpresa: 3_700_000,
      faturadoContrato: 3_500_000,
    });
    expect(r.avisos.some(a => a.includes('SUBLIMITE'))).toBe(true);
    expect(r.antes.porte).toBe('ME'); // 200 mil sem o contrato
    expect(r.depois.porte).toBe('EPP');
    expect(r.avisos.some(a => a.includes('Porte'))).toBe(true);
  });

  it('avisa exclusão acima do teto de 4,8 mi', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'simples_nacional',
      config: { anexo_simples: 1 },
      receita12mEmpresa: 5_000_000,
      faturadoContrato: 1_000_000,
    });
    expect(r.avisos.some(a => a.includes('teto do Simples'))).toBe(true);
  });
});

describe('estimarImpostoDoContrato — Lucro Presumido', () => {
  it('soma tributos lineares e adicional marginal quando a base já excede 240 mil/ano', () => {
    // ETHOS-like: receita 12m 12,4 mi (base presumida 8% ≈ 992 mil > 240 mil
    // mesmo sem o contrato) — adicional marginal integral.
    const fat = 8_083_744.58;
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'lucro_presumido',
      config: null, // padrões: 8/12, 15/10, 9, 0,65, 3, ICMS 0
      receita12mEmpresa: 12_413_249.13,
      faturadoContrato: fat,
    });
    const esperado =
      fat * 0.08 * 0.15 + // IRPJ 1,2%
      fat * 0.12 * 0.09 + // CSLL 1,08%
      fat * 0.0065 +      // PIS
      fat * 0.03 +        // COFINS
      fat * 0.08 * 0.10;  // adicional marginal 0,8%
    expect(r.imposto).toBeCloseTo(esperado, 0);
    expect(r.aliquotaSobreContrato).toBeCloseTo(6.73, 1);
    expect(r.componentes.some(c => c.nome.includes('Adicional'))).toBe(true);
  });

  it('não atribui adicional quando a empresa fica abaixo do limite sem o contrato', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'lucro_presumido',
      config: null,
      receita12mEmpresa: 2_500_000,
      faturadoContrato: 1_000_000, // sem o contrato: 1,5 mi × 8% = 120 mil < 240 mil
    });
    expect(r.componentes.some(c => c.nome.includes('Adicional'))).toBe(false);
    expect(r.premissas.some(p => p.includes('trimestre'))).toBe(true);
  });
});

describe('estimarImpostoDoContrato — bordas', () => {
  it('regime não definido é resposta, não padrão inventado', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: null,
      config: null,
      receita12mEmpresa: 1_000_000,
      faturadoContrato: 100_000,
    });
    expect(r.imposto).toBe(0);
    expect(r.avisos.some(a => a.includes('não definido'))).toBe(true);
  });

  it('Lucro Real não finge estimativa por contrato', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'lucro_real',
      config: null,
      receita12mEmpresa: 10_000_000,
      faturadoContrato: 1_000_000,
    });
    expect(r.imposto).toBe(0);
    expect(r.avisos.some(a => a.includes('Lucro Real'))).toBe(true);
  });

  it('contrato sem faturamento não estima nada', () => {
    const r = estimarImpostoDoContrato({
      regimeCadastro: 'simples_nacional',
      config: { anexo_simples: 1 },
      receita12mEmpresa: 1_000_000,
      faturadoContrato: 0,
    });
    expect(r.imposto).toBe(0);
  });
});
