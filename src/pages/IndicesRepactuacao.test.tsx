import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Índices e repactuação (27/09):
 *  1. um índice por sigla, o mês mais novo — a base guarda INPC de jul e de
 *     ago em linhas próprias e a tela mostrava os dois;
 *  2. no Simulador, índice + as duas datas preenchem o percentual com a série
 *     oficial, e o campo continua editável, com "usar o oficial" para voltar;
 *  3. o estudo é montado sem IA e sai para impressão e Word.
 * O Supabase é falso: a série é a do 772/2024 (IPCA, 06/2024 → 06/2025).
 */

const dados = vi.hoisted(() => ({
  indices: [
    { id: 'i1', nome: 'Índice Nacional de Preços ao Consumidor', sigla: 'INPC', fonte: 'IBGE · BCB/SGS 188', periodo: 'jul/2026', valor: -0.01, variacao_mensal: -0.01, variacao_anual: 3.5, acumulado_12m: 4.1, categoria: 'inflacao' },
    { id: 'i2', nome: 'Índice Nacional de Preços ao Consumidor', sigla: 'INPC', fonte: 'IBGE · BCB/SGS 188', periodo: 'ago/2026', valor: -0.32, variacao_mensal: -0.32, variacao_anual: 3.17, acumulado_12m: 3.98, categoria: 'inflacao' },
    { id: 'i3', nome: 'Índice Nacional de Preços ao Consumidor Amplo', sigla: 'IPCA', fonte: 'IBGE · BCB/SGS 433', periodo: 'ago/2026', valor: -0.32, variacao_mensal: -0.32, variacao_anual: 3.44, acumulado_12m: 4.22, categoria: 'inflacao' },
  ],
  serie: {
    success: true, indice: 'IPCA', fonte: 'IBGE · BCB/SGS 433', data_base: '2024-06-11', data_alvo: '2025-06-11',
    meses: [{ competencia: '07/2024', variacao: 0.38, fator: 1.0038 }, { competencia: '06/2025', variacao: 0.24, fator: 1.0024 }],
    meses_esperados: 12, completo: true, serie_ate: '06/2025', fator: 1.053512, percentual: 5.3512,
  },
  invocacoes: [] as unknown[],
}));

vi.mock('@/integrations/supabase/client', () => {
  const consulta = (tabela: string) => {
    const linhas = tabela === 'indices_economicos' ? dados.indices : [];
    const encadeia: Record<string, unknown> = {
      select: () => encadeia,
      order: () => encadeia,
      eq: () => encadeia,
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: linhas, error: null }).then(ok),
    };
    return encadeia;
  };
  return {
    supabase: {
      from: (tabela: string) => consulta(tabela),
      functions: {
        invoke: async (_fn: string, opts: { body: unknown }) => {
          dados.invocacoes.push(opts.body);
          return { data: dados.serie, error: null };
        },
      },
    },
  };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import IndicesRepactuacao from './IndicesRepactuacao';

const montar = () => render(<MemoryRouter initialEntries={['/indices-repactuacao']}><IndicesRepactuacao /></MemoryRouter>);

beforeEach(() => { dados.invocacoes.length = 0; });

describe('Índices e repactuação', () => {
  it('mostra um índice por sigla, o mês mais novo', async () => {
    montar();
    await waitFor(() => expect(screen.getAllByText('ago/2026').length).toBeGreaterThan(0));
    expect(screen.queryByText('jul/2026')).not.toBeInTheDocument();
    // Cartões: INPC e IPCA, um de cada.
    const cartoes = screen.getAllByText(/^(INPC|IPCA)$/, { selector: 'p' });
    expect(cartoes.map((c) => c.textContent).sort()).toEqual(['INPC', 'IPCA']);
  });

  it('no Simulador, índice e datas preenchem o percentual pela série oficial; editado, dá para voltar ao oficial', async () => {
    montar();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Simulador' }), { button: 0 });
    fireEvent.change(await screen.findByLabelText(/Data-base/), { target: { value: '2024-06-11' } });
    fireEvent.change(screen.getByLabelText(/Data de incidência/), { target: { value: '2025-06-11' } });
    const perc = screen.getByLabelText('Percentual de reajuste (%)') as HTMLInputElement;
    await waitFor(() => expect(perc.value).toBe('5,35'));
    expect(dados.invocacoes[0]).toMatchObject({ action: 'calculo_reajuste', indice: 'IPCA', data_base: '2024-06-11', data_alvo: '2025-06-11' });
    expect(screen.getByTestId('serie-oficial').textContent).toContain('IBGE · BCB/SGS 433');

    fireEvent.change(perc, { target: { value: '4,5' } });
    expect(perc.value).toBe('4,5');
    fireEvent.click(screen.getByRole('button', { name: 'usar o oficial' }));
    expect(perc.value).toBe('5,35');
  });

  it('monta o estudo sem IA, com a conta certa, e oferece impressão e Word', async () => {
    montar();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Simulador' }), { button: 0 });
    fireEvent.change(await screen.findByLabelText(/Data-base/), { target: { value: '2024-06-11' } });
    fireEvent.change(screen.getByLabelText(/Data de incidência/), { target: { value: '2025-06-11' } });
    const perc = screen.getByLabelText('Percentual de reajuste (%)') as HTMLInputElement;
    await waitFor(() => expect(perc.value).toBe('5,35'));
    fireEvent.change(screen.getByLabelText('Base de cálculo (R$)'), { target: { value: '123689122' } });
    fireEvent.click(screen.getByRole('button', { name: /Calcular e montar o estudo/ }));

    const estudo = await screen.findByTestId('estudo-de-reajuste');
    expect(within(estudo).getByText('R$ 1.303.064,90')).toBeInTheDocument();
    expect(within(estudo).getByText('R$ 66.173,68')).toBeInTheDocument();
    expect(within(estudo).getByRole('button', { name: /Imprimir \/ salvar em PDF/ })).toBeInTheDocument();
    expect(within(estudo).getByRole('button', { name: /Baixar Word/ })).toBeInTheDocument();
    expect(within(estudo).getByText('Memória de cálculo')).toBeInTheDocument();
    expect(within(estudo).getByText('07/2024')).toBeInTheDocument();
    // Só uma chamada ao servidor: a da série. O estudo não pede nada a IA.
    expect(dados.invocacoes.every((b) => (b as { action: string }).action === 'calculo_reajuste')).toBe(true);
    expect(estudo.textContent).not.toMatch(/art\. 65\b/);
    expect(estudo.textContent).toContain('art. 136, I');
  });
});
