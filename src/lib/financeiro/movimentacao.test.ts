import { describe, expect, it } from 'vitest';
import { ehMovimentacao, ehTransferenciaEntreContasProprias, sinalEconomico } from './movimentacao';

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

describe('ehTransferenciaEntreContasProprias — a régua do CAIXA, que não é a do DRE', () => {
  // O caso de 21/09 (ETHOS): 56 parcelas "PAGAMENTO ACORDO - BRADESCO"
  // (consórcio), a_pagar com a categoria "Transferências Enviadas Entre
  // Contas Próprias" (natureza movimentacao). Não é resultado — mas o
  // dinheiro sai da conta para um terceiro.
  const parcelaDoConsorcio = {
    tipo: 'a_pagar', natureza: 'despesa', conta_destino_id: null,
    categoria: { natureza: 'movimentacao', grupo_dre: 'movimentacao' },
  };

  it('dívida com terceiro categorizada como movimentação fica FORA do DRE e DENTRO do caixa', () => {
    expect(ehMovimentacao(parcelaDoConsorcio)).toBe(true);
    expect(ehTransferenciaEntreContasProprias(parcelaDoConsorcio)).toBe(false);
  });

  it('a perna de um par (tipo transferencia) sai do caixa, com ou sem categoria', () => {
    expect(ehTransferenciaEntreContasProprias({ tipo: 'transferencia', conta_destino_id: 'itau' })).toBe(true);
    expect(ehTransferenciaEntreContasProprias({ tipo: 'transferencia', conta_destino_id: null })).toBe(true);
  });

  it('linha com conta de destino é transferência própria, seja qual for o tipo gravado', () => {
    // Legado: a_pagar com conta_destino_id apontando a outra conta da empresa.
    expect(ehTransferenciaEntreContasProprias({ tipo: 'a_pagar', conta_destino_id: 'banpara' })).toBe(true);
  });

  it('título comum e resgate lançado como a_receber sem destino continuam no caixa', () => {
    expect(ehTransferenciaEntreContasProprias({ tipo: 'a_receber', conta_destino_id: null })).toBe(false);
    expect(ehTransferenciaEntreContasProprias({ tipo: 'a_pagar' })).toBe(false);
  });
});
