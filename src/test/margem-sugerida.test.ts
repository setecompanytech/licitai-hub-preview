import { describe, expect, it } from 'vitest';
import { analisarParaMargem, precificarEntrada, situacaoDoPrecoContratado } from '@/lib/financeiro/margem-sugerida';

describe('precificarEntrada', () => {
  it('resma de R$ 25 com trib 6,73% + desp 12% + alvo 10% → preço pela fórmula do markup divisor', () => {
    const s = precificarEntrada(25, { cargaTributariaPerc: 6.73, despesaOperacionalPerc: 12, margemAlvoPerc: 10 });
    // preço = 25 / (1 − 0,2873) = 35,08; mínimo = 25 / (1 − 0,1873) = 30,76
    expect(s.precoSugerido).toBeCloseTo(25 / (1 - 0.2873), 2);
    expect(s.precoMinimo).toBeCloseTo(25 / (1 - 0.1873), 2);
    expect(s.inviavel).toBe(false);
    expect(s.markupPerc).toBeCloseTo(((s.precoSugerido! - 25) / 25) * 100, 2);
  });

  it('soma ≥ 100% é inviável — nenhum preço fecha, e a tela deve dizer isso', () => {
    const s = precificarEntrada(25, { cargaTributariaPerc: 40, despesaOperacionalPerc: 55, margemAlvoPerc: 10 });
    expect(s.precoSugerido).toBeNull();
    expect(s.inviavel).toBe(true);
    expect(s.precoMinimo).not.toBeNull(); // mínimo (sem alvo) ainda existe: 40+55 < 100
  });

  it('custo zero não sugere nada', () => {
    const s = precificarEntrada(0, { cargaTributariaPerc: 10, despesaOperacionalPerc: 10, margemAlvoPerc: 10 });
    expect(s.precoSugerido).toBeNull();
    expect(s.precoMinimo).toBeNull();
  });
});

describe('situacaoDoPrecoContratado', () => {
  const s = precificarEntrada(20, { cargaTributariaPerc: 6.73, despesaOperacionalPerc: 10, margemAlvoPerc: 10 });
  // mínimo ≈ 24,02 · sugerido ≈ 27,29
  it('classifica acima do sugerido, entre as réguas e abaixo do break-even', () => {
    expect(situacaoDoPrecoContratado(28, s)).toBe('acima_sugerido');
    expect(situacaoDoPrecoContratado(25, s)).toBe('entre_minimo_e_sugerido');
    expect(situacaoDoPrecoContratado(23, s)).toBe('abaixo_minimo');
    expect(situacaoDoPrecoContratado(0, s)).toBe('sem_referencia');
  });
});

describe('analisarParaMargem', () => {
  const cat = (grupo: string | null, natureza?: string) => ({ grupo_dre: grupo, natureza: natureza ?? 'despesa' });
  it('separa receita, exclui CMV das despesas e ignora movimentação e receita financeira', () => {
    const a = analisarParaMargem(
      [
        { natureza: 'receita', valor: 1_000_000, categoria: cat(null, 'receita') },
        { natureza: 'receita', valor: 50_000, categoria: cat('receita_financeira', 'receita') }, // fora
        { natureza: 'despesa', valor: 400_000, categoria: cat('cmv_cps') },                      // CMV: fora das operacionais
        { natureza: 'despesa', valor: 120_000, categoria: cat('despesas_operacionais') },
        { natureza: 'despesa', valor: 999_999, categoria: cat(null, 'movimentacao') },           // transferência: fora
      ],
      'lucro_presumido',
      null,
    );
    expect(a.receita12m).toBe(1_000_000);
    expect(a.despesaOperacionalPerc).toBe(12);
    // Presumido, base presumida 80 mil < 240 mil/ano → só lineares: 1,2+1,08+0,65+3 = 5,93%
    expect(a.cargaTributariaPerc).toBeCloseTo(5.93, 2);
    expect(a.regimeRotulo).toBe('Lucro Presumido');
  });

  it('presumido grande inclui o adicional MÉDIO sobre o excedente anual', () => {
    const a = analisarParaMargem(
      [{ natureza: 'receita', valor: 12_000_000, categoria: { grupo_dre: null, natureza: 'receita' } }],
      'lucro_presumido',
      null,
    );
    // base presumida 960 mil; excedente 720 mil × 10% = 72 mil ÷ 12 mi = 0,6%
    expect(a.cargaTributariaPerc).toBeCloseTo(5.93 + 0.6, 2);
  });

  it('regime ausente devolve carga 0 com aviso — a tela pede a configuração em vez de inventar', () => {
    const a = analisarParaMargem(
      [{ natureza: 'receita', valor: 100_000, categoria: null }],
      null,
      null,
    );
    expect(a.cargaTributariaPerc).toBe(0);
    expect(a.avisos.some(x => x.includes('não definido'))).toBe(true);
  });
});
