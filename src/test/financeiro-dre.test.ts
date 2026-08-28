import { describe, it, expect } from 'vitest';
import { montarDRE, type DRELinhaRaw } from '@/lib/financeiro/dre';

const linha = (p: Partial<DRELinhaRaw>): DRELinhaRaw => ({
  empresa_id: 'e1',
  competencia: '2026-08-01',
  grupo_dre: null,
  categoria_id: 'c1',
  categoria_nome: 'Categoria',
  natureza: 'despesa',
  total: 0,
  ...p,
});

describe('montarDRE', () => {
  it('não funde receita e despesa do mesmo grupo num total só', () => {
    // O caso real: em agosto/2026 o grupo sem classificação tinha
    // R$ 126.727,41 de despesa, R$ 61.044,72 de receita e R$ 62.725,61 de
    // movimentação. A chave antiga era só o grupo, então os três viravam UM
    // número, com o sinal herdado da primeira linha que chegasse.
    const dre = montarDRE(
      [
        linha({ natureza: 'despesa', total: 126727.41 }),
        linha({ natureza: 'receita', total: 61044.72 }),
        linha({ natureza: 'movimentacao', total: 62725.61 }),
      ],
      '2026-08',
    );

    expect(dre.semClassificacao.despesa).toBe(126727.41);
    expect(dre.semClassificacao.receita).toBe(61044.72);
    // Movimentação não conta como nenhuma das duas.
    expect(dre.movimentacaoExcluida.total).toBe(62725.61);
    expect(dre.movimentacaoExcluida.linhas).toBe(1);
  });

  it('a ordem das linhas não muda o resultado', () => {
    // O PostgREST não garante ordem. Com a chave antiga, inverter a ordem
    // invertia o sinal do grupo inteiro.
    const linhas = [
      linha({ natureza: 'receita', total: 100 }),
      linha({ natureza: 'despesa', total: 40 }),
    ];
    const a = montarDRE(linhas, '2026-08');
    const b = montarDRE([...linhas].reverse(), '2026-08');
    expect(a.semClassificacao).toEqual(b.semClassificacao);
  });

  it('o CMV entra no Lucro Bruto — o grupo é cmv_cps, não "custos"', () => {
    // `sumGrupo("custos")` nunca casou com nada, e não havia atalho de
    // reserva: o Lucro Bruto era sempre igual à Receita Líquida.
    const dre = montarDRE(
      [
        linha({ grupo_dre: 'receita_bruta', natureza: 'receita', total: 1000 }),
        linha({ grupo_dre: 'cmv_cps', natureza: 'despesa', total: 400 }),
      ],
      '2026-08',
    );
    expect(dre.custos).toBe(400);
    expect(dre.lucroBruto).toBe(600);
    expect(dre.lucroBruto).not.toBe(dre.receitaLiquida);
  });

  it('despesa operacional vem de desp_operacional', () => {
    const dre = montarDRE(
      [
        linha({ grupo_dre: 'receita_bruta', natureza: 'receita', total: 1000 }),
        linha({ grupo_dre: 'desp_operacional', natureza: 'despesa', total: 250 }),
      ],
      '2026-08',
    );
    expect(dre.despesasOperacionais).toBe(250);
    expect(dre.resultadoOperacional).toBe(750);
  });

  it('resultado financeiro é receita financeira menos despesa financeira', () => {
    const dre = montarDRE(
      [
        linha({ grupo_dre: 'receita_financeira', natureza: 'receita', total: 300 }),
        linha({ grupo_dre: 'desp_financeira', natureza: 'despesa', total: 120 }),
      ],
      '2026-08',
    );
    expect(dre.resultadoFinanceiro).toBe(180);
    expect(dre.outrosResultados).toBe(180);
  });

  it('categoria sem grupo não vira receita nem despesa do resultado', () => {
    // O atalho antigo somava tudo que tinha natureza receita quando não
    // encontrava `receita_bruta` — e varria as 445 categorias sem grupo para
    // dentro do faturamento.
    const dre = montarDRE(
      [linha({ grupo_dre: null, natureza: 'receita', total: 55505.3 })],
      '2026-08',
    );
    expect(dre.receitaBruta).toBe(0);
    expect(dre.resultadoLiquido).toBe(0);
    expect(dre.semClassificacao.receita).toBe(55505.3);
    expect(dre.semClassificacao.linhas).toBe(1);
  });

  it('movimentação sai pelo grupo e também pela natureza', () => {
    // As duas marcações existem e nem sempre concordam. Basta uma.
    const porGrupo = montarDRE(
      [linha({ grupo_dre: 'movimentacao', natureza: 'despesa', total: 5157.24 })],
      '2026-08',
    );
    const porNatureza = montarDRE(
      [linha({ grupo_dre: 'desp_operacional', natureza: 'movimentacao', total: 5157.24 })],
      '2026-08',
    );
    expect(porGrupo.movimentacaoExcluida.linhas).toBe(1);
    expect(porGrupo.despesasOperacionais).toBe(0);
    expect(porNatureza.movimentacaoExcluida.linhas).toBe(1);
    expect(porNatureza.despesasOperacionais).toBe(0);
  });

  it('a cascata fecha: receita líquida − custos − despesas + financeiro', () => {
    const dre = montarDRE(
      [
        linha({ grupo_dre: 'receita_bruta', natureza: 'receita', total: 10000 }),
        linha({ grupo_dre: 'deducoes', natureza: 'despesa', total: 1000 }),
        linha({ grupo_dre: 'cmv_cps', natureza: 'despesa', total: 3000 }),
        linha({ grupo_dre: 'desp_operacional', natureza: 'despesa', total: 2000 }),
        linha({ grupo_dre: 'desp_financeira', natureza: 'despesa', total: 500 }),
      ],
      '2026-08',
    );
    expect(dre.receitaLiquida).toBe(9000);
    expect(dre.lucroBruto).toBe(6000);
    expect(dre.resultadoOperacional).toBe(4000);
    expect(dre.resultadoLiquido).toBe(3500);
    expect(dre.margemLiquida).toBeCloseTo(3500 / 9000, 10);
  });

  it('margem não divide por zero quando não há receita', () => {
    const dre = montarDRE(
      [linha({ grupo_dre: 'desp_operacional', natureza: 'despesa', total: 800 })],
      '2026-08',
    );
    expect(dre.receitaLiquida).toBe(0);
    expect(dre.margemLiquida).toBe(0);
    expect(dre.resultadoLiquido).toBe(-800);
  });
});
