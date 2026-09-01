import { describe, it, expect } from 'vitest';
import { validarFaturamento } from '@/lib/contratos/validar-faturamento';

const base = {
  natureza: 'Venda de mercadoria',
  freteValor: '0',
  vuPorItem: { agua: 22.55 },
};

const pedidoOk = {
  id: 'p1', numero_pedido: '006', quantidade: 600, valor_unitario: 22.55,
  contrato_item_id: 'agua', quantidadeDigitada: '600',
};

describe('validarFaturamento', () => {
  it('tudo certo, nenhum erro — a emissão avança', () => {
    expect(validarFaturamento({ ...base, pedidosSelecionados: [pedidoOk] })).toHaveLength(0);
  });

  it('sem natureza, não emite — e o erro aponta o campo', () => {
    const e = validarFaturamento({ ...base, natureza: '', pedidosSelecionados: [pedidoOk] });
    expect(e).toHaveLength(1);
    expect(e[0].campo).toBe('natureza');
  });

  it('preço divergente do contrato BLOQUEIA a emissão', () => {
    // O caso que definiu a política: 22,50 num contrato de 22,55 seguiu "sem
    // intervenção humana". Na emissão, ainda dá tempo — então barra.
    const e = validarFaturamento({
      ...base,
      pedidosSelecionados: [{ ...pedidoOk, valor_unitario: 22.5 }],
    });
    expect(e).toHaveLength(1);
    expect(e[0].campo).toBe('pedido:p1:preco');
    expect(e[0].mensagem).toContain('22,50');
    expect(e[0].mensagem).toContain('22,55');
  });

  it('faturar mais do que o pedido registra é nota sem lastro', () => {
    const e = validarFaturamento({
      ...base,
      pedidosSelecionados: [{ ...pedidoOk, quantidadeDigitada: '700' }],
    });
    expect(e[0].campo).toBe('pedido:p1:quantidade');
    expect(e[0].mensagem).toContain('não pode exceder o pedido');
  });

  it('faturamento parcial dentro do pedido passa', () => {
    expect(validarFaturamento({
      ...base,
      pedidosSelecionados: [{ ...pedidoOk, quantidadeDigitada: '300' }],
    })).toHaveLength(0);
  });

  it('quantidade vazia, zero ou texto: erro no campo', () => {
    for (const q of ['', '0', 'abc', '-5']) {
      const e = validarFaturamento({
        ...base,
        pedidosSelecionados: [{ ...pedidoOk, quantidadeDigitada: q }],
      });
      expect(e[0]?.campo).toBe('pedido:p1:quantidade');
    }
  });

  it('vírgula decimal do jeito brasileiro é aceita', () => {
    expect(validarFaturamento({
      ...base,
      pedidosSelecionados: [{ ...pedidoOk, quantidadeDigitada: '599,5' }],
    })).toHaveLength(0);
  });

  it('pedido sem item vinculado não é conferido por preço — sem referência, sem invenção', () => {
    expect(validarFaturamento({
      ...base,
      pedidosSelecionados: [{ ...pedidoOk, contrato_item_id: null, valor_unitario: 22.5 }],
    })).toHaveLength(0);
  });

  it('frete negativo ou não numérico: erro no campo', () => {
    for (const f of ['-1', 'x']) {
      const e = validarFaturamento({ ...base, freteValor: f, pedidosSelecionados: [pedidoOk] });
      expect(e[0]?.campo).toBe('frete');
    }
  });

  it('vários erros aparecem TODOS de uma vez — corrigir um por um é tortura', () => {
    const e = validarFaturamento({
      natureza: '', freteValor: '-1', vuPorItem: { agua: 22.55 },
      pedidosSelecionados: [{ ...pedidoOk, valor_unitario: 22.5, quantidadeDigitada: '700' }],
    });
    expect(e.map(x => x.campo).sort()).toEqual(
      ['frete', 'natureza', 'pedido:p1:preco', 'pedido:p1:quantidade'],
    );
  });
});
