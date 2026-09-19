import { describe, expect, it } from 'vitest';
import { ehMovimentacao, sinalEconomico } from './movimentacao';

describe('ehMovimentacao — a régua única dos painéis', () => {
  it('a perna a_pagar de uma transferência entre contas próprias não é despesa', () => {
    // O caso de 19/09 (ETHOS): 43 lançamentos a_pagar com a categoria
    // "Transferências Recebidas Entre Contas Próprias" (natureza movimentacao).
    expect(ehMovimentacao({
      tipo: 'a_pagar', natureza: 'despesa',
      categoria: { natureza: 'movimentacao', grupo_dre: 'movimentacao' },
    })).toBe(true);
  });

  it('imobilizado (despesa na linha, movimentação no grupo do DRE) sai do resultado', () => {
    expect(ehMovimentacao({
      tipo: 'a_pagar', natureza: 'despesa',
      categoria: { natureza: 'despesa', grupo_dre: 'movimentacao' },
    })).toBe(true);
  });

  it('tipo transferencia e natureza movimentacao são movimentação mesmo sem categoria', () => {
    expect(ehMovimentacao({ tipo: 'transferencia', natureza: 'despesa', categoria: null })).toBe(true);
    expect(ehMovimentacao({ tipo: 'a_receber', natureza: 'movimentacao', categoria: null })).toBe(true);
  });

  it('venda e compra de mercadoria continuam resultado', () => {
    expect(ehMovimentacao({ tipo: 'a_receber', natureza: 'receita', categoria: { natureza: 'receita', grupo_dre: 'receita_bruta' } })).toBe(false);
    expect(ehMovimentacao({ tipo: 'a_pagar', natureza: 'despesa', categoria: { natureza: 'despesa', grupo_dre: 'cmv_cps' } })).toBe(false);
    // Sem categoria não se presume movimentação: é receita/despesa sem classificar.
    expect(ehMovimentacao({ tipo: 'a_receber', natureza: 'receita', categoria: null })).toBe(false);
  });

  it('sinalEconomico: +1 receita, −1 despesa, 0 movimentação', () => {
    expect(sinalEconomico({ natureza: 'receita' })).toBe(1);
    expect(sinalEconomico({ natureza: 'despesa' })).toBe(-1);
    expect(sinalEconomico({ natureza: 'receita', categoria: { natureza: 'movimentacao' } })).toBe(0);
  });
});
