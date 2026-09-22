import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CertidoesNegativas from './CertidoesNegativas';

const { invoke, banco } = vi.hoisted(() => ({
  invoke: vi.fn(),
  banco: {
    /** Os órgãos cadastrados pela empresa (`certidoes_orgaos_da_empresa`). */
    orgaos: [] as Record<string, unknown>[],
    /** As escritas que a aba tentou. */
    gravadas: [] as Array<{ tabela: string; op: string; valores: unknown }>,
  },
}));
vi.mock('@/integrations/supabase/client', () => {
  const consulta = (tabela: string) => {
    const elo: Record<string, unknown> = {};
    let escrita = false;
    ['select', 'eq', 'order', 'limit'].forEach((m) => { elo[m] = () => elo; });
    ['insert', 'update', 'delete'].forEach((op) => {
      elo[op] = (valores?: unknown) => { escrita = true; banco.gravadas.push({ tabela, op, valores }); return elo; };
    });
    elo.then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: escrita ? [{ id: 'gravada' }] : (tabela === 'certidoes_orgaos_da_empresa' ? banco.orgaos : []), error: null }).then(ok);
    return elo;
  };
  return {
    supabase: {
      functions: { invoke: (...a: unknown[]) => invoke(...a) },
      from: (tabela: string) => consulta(tabela),
    },
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1', razao_social: 'SANTA ROSA COMERCIO', nome_fantasia: null } }),
}));

const limpo = (nome: string) => ({ nome, status: 'limpo', registros: [], total: 0, url: 'https://portaldatransparencia.gov.br/sancoes' });

/** Um cadastro consultado que caiu num município fora do mapa. */
const cadastroForaDoMapa = () => ({
  data: {
    cnpj: '24687187000101',
    cadastro: { razaoSocial: 'SANTA ROSA COMERCIO', situacao: 'ATIVA', uf: 'PA', municipio: 'CUMARU DO NORTE', cnaePrincipal: 'x', porte: 'ME', nomeFantasia: '', motivoSituacao: '', dataAbertura: '' },
    idoneidade: { ceis: limpo('CEIS'), cnep: limpo('CNEP'), cepim: limpo('CEPIM'), leniencia: limpo('Leniência'), idonea: true, inconclusiva: false, divergencias: [] },
    consultadoEm: '2026-09-23T13:50:00.000Z',
  },
  error: null,
});

beforeEach(() => {
  invoke.mockReset();
  banco.orgaos = [];
  banco.gravadas = [];
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

  it('município fora do mapa: "Órgão a cadastrar" com o nome dele, e a empresa cadastra o órgão pelo formulário', async () => {
    invoke.mockResolvedValue(cadastroForaDoMapa());
    render(<MemoryRouter><CertidoesNegativas /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '24687187000101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText(/domicílio CUMARU DO NORTE\/PA/)).toBeInTheDocument();
    expect(screen.getAllByText('Órgão a cadastrar').length).toBeGreaterThan(0);
    // A Receita escreve em caixa alta; a lista de cidades escreve "Cumaru do Norte" — o nome é o dele, em qualquer caixa.
    expect(screen.getAllByText(/Prefeitura Municipal de Cumaru do Norte/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Belém/)).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: /Cadastrar órgão/ })[0]);
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Cumaru do Norte\/PA/i)).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Nome do órgão'), { target: { value: 'Prefeitura de Cumaru do Norte · Tributos' } });
    fireEvent.change(within(dialogo).getByLabelText('Site de emissão'), { target: { value: 'cumarudonorte.pa.gov.br/cnd' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar órgão' }));

    await waitFor(() => expect(banco.gravadas).toHaveLength(1));
    expect(banco.gravadas[0]).toEqual({
      tabela: 'certidoes_orgaos_da_empresa',
      op: 'insert',
      valores: expect.objectContaining({
        empresa_id: 'e1', user_id: 'u1', esfera: 'municipal', uf: 'PA', municipio: expect.stringMatching(/^cumaru do norte$/i),
        nome_orgao: 'Prefeitura de Cumaru do Norte · Tributos', site: 'https://cumarudonorte.pa.gov.br/cnd',
      }),
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('com o órgão cadastrado pela empresa, o cartão aponta para ele — e diz que veio da empresa, não do mapa', async () => {
    banco.orgaos = [{
      id: 'o1', empresa_id: 'e1', esfera: 'municipal', uf: 'PA', municipio: 'Cumaru do Norte',
      nome_orgao: 'Prefeitura de Cumaru do Norte · Tributos', site: 'https://cumarudonorte.pa.gov.br/cnd',
      email: 'tributos@cumarudonorte.pa.gov.br', instrucoes: 'Sai na hora pelo CNPJ.', validade_dias: 90,
      user_id: 'u1', created_at: '2026-09-23T12:00:00Z', updated_at: '2026-09-23T12:00:00Z',
    }];
    invoke.mockResolvedValue(cadastroForaDoMapa());
    render(<MemoryRouter><CertidoesNegativas /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('CNPJ'), { target: { value: '24687187000101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByText(/domicílio CUMARU DO NORTE\/PA/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Prefeitura de Cumaru do Norte · Tributos').length).toBe(2));
    expect(screen.queryByText('Órgão a cadastrar')).toBeNull();
    expect(screen.getAllByText('Órgão informado pela empresa')).toHaveLength(2);
    const links = screen.getAllByRole('link', { name: /Emitir no órgão/ }).filter((l) => l.getAttribute('href')?.includes('cumarudonorte'));
    expect(links).toHaveLength(2);
    expect(screen.getAllByText('90 dias').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Editar órgão/ })).toHaveLength(2);
  });
});
