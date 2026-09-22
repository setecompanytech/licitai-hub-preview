import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CertidoesNegativas from './CertidoesNegativas';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const limpo = (nome: string) => ({ nome, status: 'limpo', registros: [], total: 0, url: 'https://portaldatransparencia.gov.br/sancoes' });

beforeEach(() => {
  invoke.mockReset();
});

describe('CertidoesNegativas — cada certidão no seu órgão emissor', () => {
  it('sem CNPJ, mostra as federais com o emissor de verdade e nenhuma palavra de raspagem ou IA', () => {
    render(<MemoryRouter><CertidoesNegativas /></MemoryRouter>);
    expect(screen.getByText(/Certidão Negativa de Débitos relativos a Créditos Tributários Federais/)).toBeInTheDocument();
    expect(screen.getByText('Caixa Econômica Federal')).toBeInTheDocument();
    expect(screen.getByText('Tribunal Superior do Trabalho')).toBeInTheDocument();
    expect(screen.queryByText(/Firecrawl|scraping|IA \(extração\)|via API|APIs públicas/)).toBeNull();
    expect(screen.queryByText(/Estadual/)).toBeNull();
  });

  it('com o CNPJ, o domicílio vem da Receita: Belém/PA traz SEFA e a solicitação por e-mail de Belém, nunca São Paulo; as sanções vêm da API', async () => {
    invoke.mockResolvedValue({
      data: {
        cnpj: '24687187000101',
        cadastro: { razaoSocial: 'SANTA ROSA COMERCIO', situacao: 'ATIVA', uf: 'PA', municipio: 'BELEM', cnaePrincipal: 'x', porte: 'ME', nomeFantasia: '', motivoSituacao: '', dataAbertura: '' },
        idoneidade: {
          ceis: { nome: 'CEIS', status: 'encontrado', total: 1, url: 'u', registros: [{ orgaoSancionador: { nome: 'EMPRESA BRASILEIRA DE PESQUISA AGROPECUARIA' }, numeroProcesso: '21159.003125/2025', dataInicioSancao: '01/08/2025', tipoSancao: { descricaoResumida: 'Impedimento' } }] },
          cnep: limpo('CNEP'), cepim: limpo('CEPIM'), leniencia: limpo('Leniência'),
          idonea: false, inconclusiva: false, divergencias: [],
        },
        consultadoEm: '2026-09-22T13:50:00.000Z',
      },
      error: null,
    });
    render(<MemoryRouter><CertidoesNegativas /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '24687187000101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith('certidoes-negativas', { body: { cnpj: '24687187000101' } }));
    expect(await screen.findByText('Com restrições')).toBeInTheDocument();
    expect(screen.getByText(/Impedimento · EMPRESA BRASILEIRA DE PESQUISA AGROPECUARIA · processo 21159.003125\/2025/)).toBeInTheDocument();
    expect(screen.getByText(/domicílio BELEM\/PA \(Receita Federal\)/)).toBeInTheDocument();
    expect(screen.getByText(/Certidão Negativa de Débitos Tributários e Não Tributários do Estado do Pará/)).toBeInTheDocument();
    expect(screen.getByText(/Secretaria de Finanças de Belém atende a solicitação por e-mail/)).toBeInTheDocument();
    // Belém: a certidão de débitos e a ficha cadastral saem pelo mesmo canal — dois e-mails prontos.
    const emails = screen.getAllByRole('link', { name: /Preparar e-mail de solicitação/ });
    expect(emails).toHaveLength(2);
    expect(emails[0]).toHaveAttribute('href', expect.stringContaining('mailto:?subject='));
    expect(decodeURIComponent(emails[0].getAttribute('href') ?? '')).toContain('SANTA ROSA COMERCIO');
    expect(screen.queryByText(/São Paulo/)).toBeNull();
    expect(screen.queryByText(/Complementar|Praefectus IA|Verificação real/)).toBeNull();
  });
});
