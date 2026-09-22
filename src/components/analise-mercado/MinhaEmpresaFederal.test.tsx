import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MinhaEmpresaFederal from './MinhaEmpresaFederal';

const { invoke, estado } = vi.hoisted(() => ({
  invoke: vi.fn(),
  estado: { empresaAtiva: null as null | { cnpj: string; razao_social: string } },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => ({ empresaAtiva: estado.empresaAtiva }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const ano = new Date().getFullYear();

beforeEach(() => {
  invoke.mockReset();
  estado.empresaAtiva = { cnpj: '33.734.346/0001-72', razao_social: 'ETHOS ESTRATEGIA' };
});

describe('MinhaEmpresaFederal — a empresa como credora da União', () => {
  it('pede os pagamentos do ano ao CNPJ da empresa ativa e soma o que veio', async () => {
    invoke.mockResolvedValue({
      data: { dados: [
        { data: '10/09/' + ano, documento: 'A', documentoResumido: `${ano}OB000001`, orgao: 'IFPA', especie: 'Original', valor: 1500 },
        { data: '12/09/' + ano, documento: 'B', documentoResumido: `${ano}OB000002`, orgao: 'UFPA', especie: 'Original', valor: 500, favorecidoIntermediario: 'Sim' },
      ] },
      error: null,
    });
    render(<MinhaEmpresaFederal />);
    fireEvent.click(screen.getByRole('button', { name: `Pagamentos de ${ano}` }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('consulta-transparencia', {
      body: { tipo: 'despesas-favorecido', cnpj: '33734346000172', fase: 3, ano, pagina: 1 },
    }));
    expect(await screen.findByText(`${ano}OB000001`)).toBeInTheDocument();
    expect(screen.getByText('Total pagamentos').parentElement?.textContent).toContain('2.000,00');
    expect(screen.getByText('Via intermediário').parentElement?.textContent).toContain('1');
  });

  it('sem empresa ativa, pede para escolher a empresa e não chama a API', () => {
    estado.empresaAtiva = null;
    render(<MinhaEmpresaFederal />);
    expect(screen.getByText('Sem empresa ativa')).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
