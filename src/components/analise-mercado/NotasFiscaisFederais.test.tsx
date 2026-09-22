import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotasFiscaisFederais from './NotasFiscaisFederais';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const nota = (chave: string, itens: Array<Record<string, unknown>>) => ({
  chaveNotaFiscal: chave, dataEmissao: '10/09/2026', nomeFornecedor: 'FRIGO LTDA', orgaoDestinatario: 'IFPA', itens,
});

beforeEach(() => {
  invoke.mockReset();
});

describe('NotasFiscaisFederais — preço por item', () => {
  it('busca as notas do produto e resume o valor unitário dos itens que falam dele', async () => {
    invoke.mockResolvedValue({
      data: {
        notas: [
          nota('1', [{ descricaoProdutoServico: 'CARNE MOIDA PATINHO KG', valorUnitario: 32.9, quantidade: 100, unidade: 'KG', codigoNcmSh: '02013000' }]),
          nota('2', [{ descricaoProdutoServico: 'CARNE MOÍDA PATINHO', valorUnitario: 35.1, quantidade: 10, unidade: 'KG' }, { descricaoProdutoServico: 'ARROZ', valorUnitario: 5 }]),
        ],
      },
      error: null,
    });
    render(<NotasFiscaisFederais termo="carne moída patinho" />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar notas de/ }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('consulta-transparencia', {
      body: { tipo: 'notas-fiscais-itens', termo: 'carne moída patinho', pagina: 1 },
    }));
    expect(await screen.findByText('Mediana do valor unitário')).toBeInTheDocument();
    expect(screen.getByText('Mediana do valor unitário').parentElement?.textContent).toContain('34,00');
    expect(screen.getByText('CARNE MOIDA PATINHO KG')).toBeInTheDocument();
    expect(screen.queryByText('ARROZ')).toBeNull();
  });

  it('sem produto, o botão fica desligado; erro da API aparece como veio', async () => {
    const { rerender } = render(<NotasFiscaisFederais termo="" />);
    expect(screen.getByRole('button')).toBeDisabled();
    invoke.mockResolvedValue({ data: { error: 'A API recusou' }, error: null });
    rerender(<NotasFiscaisFederais termo="toner" />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar notas de/ }));
    expect(await screen.findByText('A API recusou')).toBeInTheDocument();
  });
});
