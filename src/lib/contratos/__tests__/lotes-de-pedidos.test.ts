import { describe, it, expect } from 'vitest';
import { agruparEmLotes, descricaoSemParte, numeroBaseDoPedido, porUnidadeComposta, rotuloDoLote, statusDoLote } from '../lotes-de-pedidos';

const parte = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `p${n}`, numero_pedido: `595-${n}`, descricao: `NF-e 595 · ACUC TRIT 1KG (parte ${n}/3)`, contrato_item_id: `i${n}`,
  quantidade: 10, valor_total: 100 * n, data_pedido: '2024-06-28', status: 'pendente', nota_fiscal: '595', numero_empenho: '0062352024', empenho_id: 'e1', custo_total: null, lote_id: 'L1', ...extra,
});

describe('lote de pedidos', () => {
  it('junta as partes do mesmo lote numa linha, soma o valor e mantém os pedidos soltos', () => {
    const linhas = agruparEmLotes([parte(2), { ...parte(9, { lote_id: null, numero_pedido: 'OF-7', descricao: 'Entrega avulsa' }) }, parte(1), parte(3)]);
    expect(linhas.map((l) => l.tipo)).toEqual(['lote', 'pedido']);
    const lote = linhas[0].tipo === 'lote' ? linhas[0].lote : null;
    expect(lote).toMatchObject({ id: 'L1', numero: '595', valor_total: 600, status: 'pendente', progresso: null, nota_fiscal: '595', numero_empenho: '0062352024' });
    expect(lote!.partes.map((p) => p.numero_pedido)).toEqual(['595-1', '595-2', '595-3']);
    expect(rotuloDoLote(lote!)).toBe('NF-e 595 · 3 itens do contrato');
  });
  it('lote de uma parte só volta a ser pedido comum', () => {
    expect(agruparEmLotes([parte(1)])[0].tipo).toBe('pedido');
  });
  it('situação do conjunto e progresso', () => {
    expect(statusDoLote([{ status: 'pendente' }, { status: 'pendente' }])).toEqual({ status: 'pendente', progresso: null });
    expect(statusDoLote([{ status: 'entregue' }, { status: 'entregue' }])).toEqual({ status: 'entregue', progresso: null });
    expect(statusDoLote([{ status: 'entregue' }, { status: 'pendente' }, { status: 'pendente' }])).toEqual({ status: 'parcial', progresso: '1 de 3 entregue(s)' });
    expect(statusDoLote([{ status: 'cancelado' }, { status: 'cancelado' }])).toEqual({ status: 'cancelado', progresso: null });
    expect(statusDoLote([{ status: 'entregue' }, { status: 'cancelado' }])).toEqual({ status: 'entregue', progresso: '1 de 2 (restante cancelado)' });
    expect(statusDoLote([{ status: 'pendente' }, { status: 'cancelado' }])).toEqual({ status: 'pendente', progresso: '1 de 2 cancelada(s)' });
  });
  it('número base e descrição sem a parte', () => {
    expect(numeroBaseDoPedido('595-18')).toBe('595');
    expect(numeroBaseDoPedido('OF-2026-7')).toBe('OF-2026');
    expect(descricaoSemParte('NF-e 595 · ACUC TRIT 1KG (parte 18/18)')).toBe('NF-e 595 · ACUC TRIT 1KG');
    expect(descricaoSemParte(null)).toBe('');
  });
  it('cesta básica do lote: quantas entregou e o preço, custo e margem por cesta', () => {
    const linhas = agruparEmLotes([parte(1, { unidade_composta: 'cesta básica', unidades_compostas: 100, custo_total: 60 }), parte(2, { custo_total: 90 })]);
    const lote = linhas[0].tipo === 'lote' ? linhas[0].lote : null;
    expect(lote).toMatchObject({ unidade_composta: 'cesta básica', unidades_compostas: 100, valor_total: 300, custo_total: 150 });
    expect(porUnidadeComposta(lote!)).toEqual({ preco: 3, custo: 1.5, margem: 1.5, margemPct: 50 });
    expect(porUnidadeComposta({ valor_total: 300, custo_total: null, unidades_compostas: 100 })).toEqual({ preco: 3, custo: null, margem: null, margemPct: null });
    expect(porUnidadeComposta({ valor_total: 300, custo_total: 10, unidades_compostas: null })).toBeNull();
  });
});
