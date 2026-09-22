import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransparenciaPA from './TransparenciaPA';

/**
 * Transparência estadual em Análise de mercado (22/09): um "Ano" só para a
 * busca por credor e para o panorama por órgão; o panorama tem nome e, sem
 * dado, mostra só o convite compacto com o caminho certo para cada portal.
 */
type Linha = Record<string, unknown>;

const { dados, invoke } = vi.hoisted(() => ({
  dados: { linhas: [] as Linha[] },
  invoke: vi.fn(),
}));

/** Builder encadeável e "thenável" da consulta ao Supabase. */
function consulta() {
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'order', 'delete', 'insert']) builder[metodo] = () => builder;
  builder.then = (aoResolver: (v: { data: Linha[]; error: null }) => unknown) =>
    Promise.resolve({ data: dados.linhas, error: null }).then(aoResolver);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: () => consulta(),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => ({ empresaAtiva: null }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/excel-utils', () => ({ readExcelFile: vi.fn(), writeExcelFromJson: vi.fn() }));
vi.mock('@/lib/download-utils', () => ({ downloadCSV: vi.fn(), downloadPDF: vi.fn() }));
// Os gráficos medem o contêiner com ResizeObserver, que o jsdom não tem — o
// teste é sobre o ano e o vazio, não sobre o desenho (mesmo mock de
// EvolucaoMensalDashboard.test).
vi.mock('recharts', () => {
  const Nada = () => null;
  return {
    ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    BarChart: Nada, Bar: Nada, XAxis: Nada, YAxis: Nada, CartesianGrid: Nada, Tooltip: Nada,
    PieChart: Nada, Pie: Nada, Cell: Nada,
  };
});

const para = { nome: 'Pará', sigla: 'PA', url: 'https://www.sistemas.pa.gov.br/portaltransparencia', tipo: 'estado' as const, uf: 'PA' };
const bahia = { nome: 'Bahia', sigla: 'BA', url: 'https://www.transparencia.ba.gov.br/', tipo: 'estado' as const, uf: 'BA' };
const anoAtual = new Date().getFullYear();

beforeEach(() => {
  dados.linhas = [];
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { achados: [], totais: null }, error: null });
});

describe('TransparenciaPA — um ano só', () => {
  it('há um único seletor de ano, e a busca por credor usa esse ano', async () => {
    render(<TransparenciaPA portal={para} />);
    await screen.findByText('Empenhos por órgão — Pará');

    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByLabelText('Ano')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Credor'), { target: { value: 'ETHOS' } });
    fireEvent.click(screen.getByRole('button', { name: `Buscar em ${anoAtual}` }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(
      'transparencia-pa-oficial',
      expect.objectContaining({ body: expect.objectContaining({ modo: 'empenhos', ano: anoAtual, credor: 'ETHOS' }) }),
    ));
  });

  it('sem dado importado, o panorama por órgão não mostra zeros — só o convite, com o caminho do Pará', async () => {
    render(<TransparenciaPA portal={para} />);
    await screen.findByText('Nenhum dado importado');

    expect(screen.queryByText('R$ 0,00')).toBeNull();
    expect(screen.queryByText('Órgãos')).toBeNull();
    expect(screen.getByText(/API oficial do Estado/)).toBeInTheDocument();
  });

  it('em portal sem API oficial, o convite manda à planilha e não há busca por credor', async () => {
    render(<TransparenciaPA portal={bahia} />);
    await screen.findByText('Nenhum dado importado');

    expect(screen.getByText(/baixe a planilha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Buscar em/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Extração oficial/ })).toBeNull();
  });

  it('com dados, o ano recorta KPIs e ranking, e a evolução anual enxerga todos os anos', async () => {
    dados.linhas = [
      { id: '1', orgao: 'SEDUC', ano: anoAtual, valor_total: 1000, quantidade_empenhos: 1 },
      { id: '2', orgao: 'SESPA', ano: anoAtual - 1, valor_total: 500, quantidade_empenhos: 1 },
    ];
    render(<TransparenciaPA portal={para} />);
    await screen.findByText('SEDUC');

    expect(screen.getByText('Órgãos').parentElement?.textContent).toContain('1');
    expect(screen.queryByText('SESPA')).toBeNull();
    expect(screen.getByText('Evolução anual do volume de empenhos')).toBeInTheDocument();
  });
});
