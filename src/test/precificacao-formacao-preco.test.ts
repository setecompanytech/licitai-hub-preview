import { describe, it, expect } from 'vitest';
import {
  formarPreco, lucroNoPreco, somaDasCamadas, precoEhPossivel,
  exigeDemonstracaoDeExequibilidade, PrecoImpossivelError,
  type CamadasPreco,
} from '@/lib/precificacao/formacao-preco';

/**
 * O defeito que estes testes guardam: a Calculadora enviava à Proposta
 * `custo × (1 + margem)`, tratando a margem como se incidisse sobre o custo e
 * ignorando imposto e despesa por completo.
 *
 * Em licitação esse erro não aparece como preço alto que se perde. Aparece
 * como preço baixo que se GANHA — e o prejuízo só se descobre na entrega.
 */

const CAMADAS: CamadasPreco = {
  pctImpostos: 19,
  pctDespesasAdmin: 7,
  pctDespesasOperacionais: 3,
  pctMargem: 15,
};

describe('formação de preço pelo divisor', () => {
  it('o preço cobre todas as camadas e ainda deixa a margem pretendida', () => {
    const p = formarPreco(100, 1, CAMADAS);

    // 100 ÷ (1 − 0,44) = 178,571...
    expect(p.precoUnitario).toBeCloseTo(178.5714, 3);

    const { custo, impostos, despesasAdmin, despesasOperacionais, lucro } = p.composicao;
    // A prova: as cinco camadas somam exatamente o preço.
    expect(custo + impostos + despesasAdmin + despesasOperacionais + lucro)
      .toBeCloseTo(p.precoUnitario, 6);
    // E a margem sobra de verdade: 15% do PREÇO, não do custo.
    expect(lucro / p.precoUnitario * 100).toBeCloseTo(15, 6);
  });

  it('mostra o tamanho do erro do multiplicador', () => {
    const peloDivisor = formarPreco(100, 1, CAMADAS).precoUnitario;
    const peloMultiplicador = 100 * (1 + 15 / 100);

    expect(peloMultiplicador).toBeCloseTo(115, 9);  // 100 × 1,15 dá 114.99999999999999
    expect(peloDivisor).toBeGreaterThan(peloMultiplicador);

    // Vendendo a 115, o que sobra depois de imposto, despesas e custo:
    const real = lucroNoPreco(115, 100, {
      pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3,
    });
    expect(real.lucroUnitario).toBeLessThan(0);   // prejuízo, não 15% de lucro
    expect(real.viavel).toBe(false);
  });

  it('multiplica pela quantidade sem perder o unitário', () => {
    const p = formarPreco(15.8, 10000, CAMADAS);
    expect(p.precoTotal).toBeCloseTo(p.precoUnitario * 10000, 4);
    expect(p.quantidade).toBe(10000);
  });

  it('sem camadas, preço é custo', () => {
    const p = formarPreco(100, 1, {
      pctImpostos: 0, pctDespesasAdmin: 0, pctDespesasOperacionais: 0, pctMargem: 0,
    });
    expect(p.precoUnitario).toBe(100);
    expect(p.divisor).toBe(1);
    expect(p.markupEfetivo).toBe(1);
  });

  it('custo zero não quebra e não inventa markup', () => {
    const p = formarPreco(0, 5, CAMADAS);
    expect(p.precoUnitario).toBe(0);
    expect(p.markupEfetivo).toBe(0);
  });
});

describe('o limite dos 100%', () => {
  it('recusa quando as camadas somam 100% — não existe preço', () => {
    const impossivel: CamadasPreco = {
      pctImpostos: 40, pctDespesasAdmin: 30, pctDespesasOperacionais: 10, pctMargem: 20,
    };
    expect(somaDasCamadas(impossivel)).toBe(100);
    expect(precoEhPossivel(impossivel)).toBe(false);
    expect(() => formarPreco(100, 1, impossivel)).toThrow(PrecoImpossivelError);
  });

  it('recusa acima de 100% — preço negativo não é preço grande, é resposta errada', () => {
    const absurdo: CamadasPreco = {
      pctImpostos: 50, pctDespesasAdmin: 40, pctDespesasOperacionais: 20, pctMargem: 30,
    };
    expect(() => formarPreco(100, 1, absurdo)).toThrow(PrecoImpossivelError);
    // A mensagem tem de dizer o que fazer, não só que falhou.
    try { formarPreco(100, 1, absurdo); } catch (e) {
      expect((e as Error).message).toContain('reduza a margem');
    }
  });

  it('99,99% ainda é possível, e produz preço enorme — que é a verdade', () => {
    const p = formarPreco(100, 1, {
      pctImpostos: 99, pctDespesasAdmin: 0.5, pctDespesasOperacionais: 0.4, pctMargem: 0.09,
    });
    expect(p.precoUnitario).toBeGreaterThan(100000);
  });
});

describe('lucro num preço imposto de fora', () => {
  it('responde em reais a pergunta do pregão: a esse preço eu ganho?', () => {
    const r = lucroNoPreco(200, 100, {
      pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3,
    });
    // 200 − 100 − 58 = 42
    expect(r.lucroUnitario).toBeCloseTo(42, 6);
    expect(r.margemPct).toBeCloseTo(21, 6);
    expect(r.viavel).toBe(true);
  });

  it('acusa prejuízo quando o pregão empurrou demais', () => {
    const r = lucroNoPreco(140, 100, {
      pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3,
    });
    expect(r.viavel).toBe(false);
  });

  it('o preço formado devolve exatamente a margem pedida', () => {
    const p = formarPreco(100, 1, CAMADAS);
    const r = lucroNoPreco(p.precoUnitario, 100, {
      pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3,
    });
    expect(r.margemPct).toBeCloseTo(15, 6);
  });
});

describe('exequibilidade', () => {
  it('avisa abaixo do limiar', () => {
    const r = exigeDemonstracaoDeExequibilidade(700_000, 2_123_520, 75);
    expect(r.exige).toBe(true);
    expect(r.percentualDoEstimado).toBeCloseTo(32.96, 1);
  });

  it('não avisa acima', () => {
    expect(exigeDemonstracaoDeExequibilidade(1_800_000, 2_123_520, 75).exige).toBe(false);
  });

  it('o limiar é parâmetro — praxe de edital não vira regra de produto', () => {
    // O mesmo preço, dois editais com exigências diferentes.
    expect(exigeDemonstracaoDeExequibilidade(1_100_000, 2_123_520, 75).exige).toBe(true);
    expect(exigeDemonstracaoDeExequibilidade(1_100_000, 2_123_520, 50).exige).toBe(false);
  });

  it('sem valor estimado não há como comparar — e não se inventa aviso', () => {
    expect(exigeDemonstracaoDeExequibilidade(700_000, 0).exige).toBe(false);
  });
});
