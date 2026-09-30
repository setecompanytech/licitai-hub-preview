import { describe, it, expect } from 'vitest';
import { auditarPedidos } from '../auditoria-de-pedidos';

const parte = (lote: string, n: number, extra: Record<string, unknown> = {}) => ({
  id: `${lote}-${n}`, numero_pedido: `595-${n}`, quantidade: n % 2 ? 100 : 200, valor_unitario: 5, valor_total: (n % 2 ? 100 : 200) * 5,
  data_pedido: '2024-06-28', contrato_item_id: `item${n}`, status: 'pendente', lote_id: lote, ...extra,
});

describe('auditoria de pedidos — lote repetido', () => {
  it('o mesmo lote duas vezes é UM aviso, não um por parte', () => {
    const pedidos = [...Array.from({ length: 18 }, (_, i) => parte('A', i + 1)), ...Array.from({ length: 18 }, (_, i) => parte('B', i + 1))];
    const s = auditarPedidos(pedidos);
    expect(s.filter((x) => x.tipo === 'lote_duplicado')).toHaveLength(1);
    expect(s.filter((x) => x.tipo === 'dupla_versao')).toHaveLength(0);
    expect(s[0].frase).toMatch(/nota 595 entrou como lote DUAS vezes \(2 × 18 partes/);
    expect(s[0].impacto).toBe(pedidos.slice(0, 18).reduce((t, p) => t + p.valor_total, 0));
  });
  it('lotes de notas diferentes não se confundem, e partes sem lote seguem a régua antiga', () => {
    const outros = Array.from({ length: 3 }, (_, i) => parte('C', i + 1, { numero_pedido: `651-${i + 1}` }));
    const s = auditarPedidos([...Array.from({ length: 3 }, (_, i) => parte('A', i + 1)), ...outros]);
    expect(s.filter((x) => x.tipo === 'lote_duplicado')).toHaveLength(0);
    const soltos = auditarPedidos([parte('', 1, { lote_id: null, numero_pedido: '002' }), parte('', 1, { lote_id: null, numero_pedido: '003', id: 'x' })]);
    expect(soltos.filter((x) => x.tipo === 'dupla_versao')).toHaveLength(1);
  });
});
