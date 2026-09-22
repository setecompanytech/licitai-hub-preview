import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PrecoDeReferencia from './PrecoDeReferencia';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const editais = [
  { id: 'e1', pncp_id: 'a', cnpj_orgao: '04780953000170', ano_compra: '2025', sequencial_compra: '58', orgao: 'MUNICIPIO DE RONDON DO PARA', objeto: 'REGISTRO DE PREÇOS PARA AQUISIÇÃO DE CARNE BOVINA MOÍDA E CENOURA', uf: 'PA', municipio: 'Rondon do Pará', valor_total_estimado: 498420, data_publicacao_pncp: '2025-08-27', url_pncp: 'https://pncp.gov.br/a', numero_compra: '44', similaridade: 0.42 },
  { id: 'e2', pncp_id: 'b', cnpj_orgao: '04695381000135', ano_compra: '2024', sequencial_compra: '18', orgao: 'MUNICIPIO DE MEDICILANDIA', objeto: 'GÊNEROS ALIMENTÍCIOS', uf: 'PA', municipio: 'Medicilândia', valor_total_estimado: 100000, data_publicacao_pncp: '2024-06-10', url_pncp: 'https://pncp.gov.br/b', numero_compra: '18' },
];
const itens = [
  { pncp_id: 'a', numero_item: 1, descricao: 'CARNE BOVINA MOÍDA CONGELADA', unidade: 'Quilo', quantidade: 15000, valor_unitario_estimado: 30.78, valor_unitario_homologado: 19.96, tem_resultado: true, fornecedor: 'L B DISTRIBUIDORA EIRELI', data_resultado: '2025-10-02', situacao: 'Homologado' },
  { pncp_id: 'b', numero_item: 2, descricao: 'CARNE BOVINA MOIDA 1ª', unidade: 'Quilo', quantidade: 3038, valor_unitario_estimado: 0, valor_unitario_homologado: null, tem_resultado: false, situacao: 'Em andamento' },
];

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (fn: string) => {
    if (fn === 'historico-orgao-pncp') return { data: { resultados: editais, provedor: 'palavras+significado' }, error: null };
    if (fn === 'itens-do-acervo-pncp') return { data: { itens, buscados: 0, cacheados: 2, total_itens: 30 }, error: null };
    return { data: { dados: [] }, error: null };
  });
});

describe('PrecoDeReferencia — a fonte única do preço por objeto', () => {
  it('busca no acervo, mostra o global numa linha só, o unitário só homologado, e os itens embaixo do edital', async () => {
    render(<PrecoDeReferencia termoInicial="carne moída patinho" ufInicial="PA" />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('historico-orgao-pncp', expect.objectContaining({
      body: expect.objectContaining({ objeto: 'carne moída patinho', uf: 'PA', limite: 30, modo: 'qualquer' }),
    })));
    expect(await screen.findByText('Valor global do processo — o edital inteiro (PNCP)')).toBeInTheDocument();
    expect(screen.getByText('Faixa completa').parentElement?.textContent).toMatch(/100\.000,00 a R\$.498\.420,00/);
    expect(screen.getByText('Mediana do valor global').parentElement?.textContent).toContain('299.210,00');

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('itens-do-acervo-pncp', expect.anything()));
    expect(await screen.findByText('L B DISTRIBUIDORA EIRELI · 02/10/2025')).toBeInTheDocument();
    expect(screen.queryByText(/CARNE BOVINA MOIDA 1ª/)).toBeNull();
    expect(screen.getAllByText('Município de Rondon do Pará').length).toBeGreaterThan(0);
    expect(screen.getByText(/homologado R\$.19,96/)).toBeInTheDocument();
  });

  it('com menos de 8 caracteres não consulta e explica', async () => {
    render(<PrecoDeReferencia termoInicial="carne" />);
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText(/pelo menos 8 caracteres/)).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
