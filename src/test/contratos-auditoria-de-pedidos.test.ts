import { describe, it, expect } from 'vitest';
import { auditarPedidos } from '@/lib/contratos/auditoria-de-pedidos';

/** O caso real do 149/2024, que definiu a política. */
const CASO_149 = [
  { id: '1', numero_pedido: '001', quantidade: 597, valor_unitario: 22.55, valor_total: 13462.35, data_pedido: '2025-01-16', contrato_item_id: 'agua' },
  { id: '2', numero_pedido: '002', quantidade: 500, valor_unitario: 22.5, valor_total: 11250, data_pedido: '2025-02-26', contrato_item_id: 'agua' },
  { id: '3', numero_pedido: '003', quantidade: 500, valor_unitario: 22.55, valor_total: 11275, data_pedido: '2025-03-14', contrato_item_id: 'agua' },
  { id: '4', numero_pedido: '004', quantidade: 1000, valor_unitario: 22.5, valor_total: 22500, data_pedido: '2025-04-15', contrato_item_id: 'agua' },
  { id: '5', numero_pedido: '005', quantidade: 1000, valor_unitario: 22.55, valor_total: 22550, data_pedido: '2025-04-17', contrato_item_id: 'agua' },
  { id: '6', numero_pedido: '006', quantidade: 600, valor_unitario: 22.55, valor_total: 13530, data_pedido: '2025-07-22', contrato_item_id: 'agua' },
];

describe('auditarPedidos — dupla versão', () => {
  it('acha os DOIS pares do caso real, e mais nenhum', () => {
    const s = auditarPedidos(CASO_149).filter(x => x.tipo === 'dupla_versao');
    expect(s).toHaveLength(2);
    expect(s[0].pedidos).toEqual(['002', '003']);
    expect(s[1].pedidos).toEqual(['004', '005']);
  });

  it('o impacto é o valor que sairia do consumo ao excluir a duplicata', () => {
    const s = auditarPedidos(CASO_149).filter(x => x.tipo === 'dupla_versao');
    expect(s[0].impacto).toBe(11250);
    expect(s[1].impacto).toBe(22500);
  });

  it('mesma quantidade em datas DISTANTES não é suspeita — é reposição', () => {
    const s = auditarPedidos([
      { id: '1', numero_pedido: '001', quantidade: 500, valor_unitario: 22.55, valor_total: 11275, data_pedido: '2025-01-10', contrato_item_id: 'a' },
      { id: '2', numero_pedido: '007', quantidade: 500, valor_unitario: 22.55, valor_total: 11275, data_pedido: '2025-06-10', contrato_item_id: 'a' },
    ]);
    expect(s.filter(x => x.tipo === 'dupla_versao')).toHaveLength(0);
  });

  it('quantidades diferentes nunca formam par', () => {
    const s = auditarPedidos([
      { id: '1', numero_pedido: '001', quantidade: 500, valor_unitario: 22.55, valor_total: 11275, data_pedido: '2025-03-01', contrato_item_id: 'a' },
      { id: '2', numero_pedido: '002', quantidade: 600, valor_unitario: 22.55, valor_total: 13530, data_pedido: '2025-03-02', contrato_item_id: 'a' },
    ]);
    expect(s.filter(x => x.tipo === 'dupla_versao')).toHaveLength(0);
  });

  it('pedido cancelado fica fora da conta', () => {
    const s = auditarPedidos([
      { id: '1', numero_pedido: '001', quantidade: 500, valor_unitario: 22.5, valor_total: 11250, data_pedido: '2025-03-01', contrato_item_id: 'a', status: 'cancelado' },
      { id: '2', numero_pedido: '002', quantidade: 500, valor_unitario: 22.55, valor_total: 11275, data_pedido: '2025-03-02', contrato_item_id: 'a' },
    ]);
    expect(s.filter(x => x.tipo === 'dupla_versao')).toHaveLength(0);
  });
});

describe('auditarPedidos — preço divergente do contratado', () => {
  it('a nota a 22,50 num contrato de 22,55 é apontada, com o impacto', () => {
    const s = auditarPedidos(CASO_149, 22.55).filter(x => x.tipo === 'preco_divergente');
    // 002 (500 un) e 004 (1.000 un), a −R$ 0,05/un.
    expect(s.map(x => x.pedidos[0])).toEqual(['002', '004']);
    expect(s[0].impacto).toBeCloseTo(-25, 2);
    expect(s[1].impacto).toBeCloseTo(-50, 2);
    expect(s[0].providencia).toContain('ABAIXO');
  });

  it('acima do contratado, a providência fala em cobrança indevida', () => {
    const s = auditarPedidos([
      { id: '1', numero_pedido: '001', quantidade: 100, valor_unitario: 23.0, valor_total: 2300, data_pedido: '2025-01-01', contrato_item_id: 'a' },
    ], 22.55).filter(x => x.tipo === 'preco_divergente');
    expect(s[0].impacto).toBeCloseTo(45, 2);
    expect(s[0].providencia).toContain('ACIMA');
  });

  it('sem preço de referência, não inventa divergência', () => {
    expect(auditarPedidos(CASO_149, null).filter(x => x.tipo === 'preco_divergente')).toHaveLength(0);
  });

  it('meio centavo de arredondamento não vira alerta', () => {
    const s = auditarPedidos([
      { id: '1', numero_pedido: '001', quantidade: 100, valor_unitario: 22.554, valor_total: 2255.4, data_pedido: '2025-01-01', contrato_item_id: 'a' },
    ], 22.55);
    expect(s.filter(x => x.tipo === 'preco_divergente')).toHaveLength(0);
  });
});
