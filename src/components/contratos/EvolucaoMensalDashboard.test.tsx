import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Contrato 17/2025 em 18/09: dois pedidos, os dois em abril — e o cartão
 * "Variação MoM" dizia "0,0%", verde, com seta para cima, "vs mês anterior".
 * Não há mês anterior. Ausência de comparação é traço, não estabilidade.
 */

vi.mock('recharts', () => {
  const Nada = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: Nada, BarChart: Nada, AreaChart: Nada, Bar: Nada, Line: Nada, Area: Nada,
    XAxis: Nada, YAxis: Nada, CartesianGrid: Nada, Tooltip: Nada, Legend: Nada,
  };
});

import EvolucaoMensalDashboard from './EvolucaoMensalDashboard';

const pedido = (id: string, data_pedido: string, valor_total: number) =>
  ({ id, data_pedido, valor_total, custo_total: 0, status: 'entregue' });

describe('EvolucaoMensalDashboard — variação mês a mês', () => {
  it('com um mês só, a variação é traço e diz que não há mês anterior', () => {
    render(
      <EvolucaoMensalDashboard
        pedidos={[pedido('p1', '2026-04-23', 7600), pedido('p2', '2026-04-23', 13140)]}
        podeVerCustos
      />,
    );
    expect(screen.getByText('sem mês anterior para comparar')).toBeTruthy();
    expect(screen.getByTitle(/não há mês anterior/)).toBeTruthy();
    expect(screen.queryByText('0.0%')).toBeNull();
    expect(screen.queryByText('vs mês anterior')).toBeNull();
  });

  it('com dois meses, a variação é calculada sobre o penúltimo', () => {
    render(
      <EvolucaoMensalDashboard
        pedidos={[pedido('p1', '2026-03-10', 10000), pedido('p2', '2026-04-10', 12000)]}
        podeVerCustos
      />,
    );
    expect(screen.getByText('20.0%')).toBeTruthy();
    expect(screen.getByText('vs mês anterior')).toBeTruthy();
  });
});
