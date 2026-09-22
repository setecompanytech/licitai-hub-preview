import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProspeccaoFederal from './ProspeccaoFederal';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

beforeEach(() => {
  invoke.mockReset();
});

describe('ProspeccaoFederal — dinheiro liberado vira compra', () => {
  it('convênios liberados: pede a UF, os dias e a função, e lista o convenente com a última liberação', async () => {
    invoke.mockResolvedValue({
      data: { dados: [{
        id: 1, dimConvenio: { numero: '912345/2025', objeto: 'Alimentação escolar' }, convenente: { nome: 'MUNICIPIO DE BELEM' },
        municipioConvenente: { nomeIBGE: 'Belém', uf: 'PA' }, orgao: { nome: 'FNDE' }, valor: 1000000, valorLiberado: 400000,
        valorDaUltimaLiberacao: 100000, dataUltimaLiberacao: '20/09/2026', dataFinalVigencia: '31/12/2026',
      }] },
      error: null,
    });
    render(<ProspeccaoFederal ufInicial="PA" />);
    fireEvent.click(screen.getByRole('button', { name: /Convênios liberados/ }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('consulta-transparencia', {
      body: { tipo: 'convenios-liberados', uf: 'PA', dias: 7, funcao: '12' },
    }));
    expect(await screen.findByText('MUNICIPIO DE BELEM')).toBeInTheDocument();
    expect(screen.getByText('Alimentação escolar')).toBeInTheDocument();
  });

  it('emendas: só as com gasto na UF ficam', async () => {
    invoke.mockResolvedValue({
      data: { dados: [
        { codigoEmenda: '1', nomeAutor: 'DEPUTADO A', localidadeDoGasto: 'BELÉM - PA', funcao: 'Educação', valorPago: 10 },
        { codigoEmenda: '2', nomeAutor: 'DEPUTADO B', localidadeDoGasto: 'CAMPINAS - SP', funcao: 'Educação', valorPago: 20 },
      ] },
      error: null,
    });
    render(<ProspeccaoFederal ufInicial="PA" />);
    fireEvent.click(screen.getByRole('button', { name: /Emendas pagas/ }));
    expect(await screen.findByText('DEPUTADO A')).toBeInTheDocument();
    expect(screen.queryByText('DEPUTADO B')).toBeNull();
  });
});
