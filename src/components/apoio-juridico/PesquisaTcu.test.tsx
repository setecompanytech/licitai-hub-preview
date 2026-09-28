import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PesquisaTcu from './PesquisaTcu';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const RESPOSTA = {
  total: 20536, inicio: 0, filtro: '', alerta: null, sugestao: null, na_base: ['Acórdão 2991/2025-Plenário'], so_sumario: [],
  documentos: [
    { key: 'ACORDAO-COMPLETO-1', tipo: 'ACÓRDÃO DE RELAÇÃO', titulo: 'ACÓRDÃO DE RELAÇÃO 2991/2025', numero: '2991', ano: '2025', colegiado: 'Plenário', relator: 'BRUNO DANTAS', data_sessao: '2025-12-08', data_sessao_br: '08/12/2025', numero_ata: '50/2025', processo: '021.706/2025-5', situacao: 'OFICIALIZADO', fragmentos: ['...seu <em>atestado</em> de capacidade...'], url_pdf: 'https://contas.tcu.gov.br/x.pdf', url_doc: null, url_portal: 'https://pesquisa.apps.tcu.gov.br/1' },
    { key: 'ACORDAO-COMPLETO-2', tipo: 'ACÓRDÃO', titulo: 'ACÓRDÃO 1116/2025', numero: '1116', ano: '2025', colegiado: 'Plenário', relator: 'BENJAMIN ZYMLER', data_sessao: '2025-05-21', data_sessao_br: '21/05/2025', numero_ata: '18/2025', processo: null, situacao: 'OFICIALIZADO', fragmentos: [], url_pdf: null, url_doc: null, url_portal: 'https://pesquisa.apps.tcu.gov.br/2' },
  ],
  facetas: { tipo: [{ valor: 'ACÓRDÃO', quantidade: 18524 }], colegiado: [{ valor: 'Plenário', quantidade: 8747 }, { valor: 'Primeira Câmara', quantidade: 5543 }], relator: [{ valor: 'BENJAMIN ZYMLER', quantidade: 1920, grupo: 'Ativos' }, { valor: 'UBIRATAN AGUIAR', quantidade: 500, grupo: 'Aposentados' }], ano: [{ valor: '2025', quantidade: 823 }] },
};

describe('PesquisaTcu', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('pesquisa pela edge, mostra total, trecho marcado, "na base" e facetas; a faceta refaz a pesquisa com o filtro', async () => {
    invoke.mockResolvedValue({ data: RESPOSTA, error: null });
    render(<PesquisaTcu termoInicial="atestado" />);
    fireEvent.click(screen.getByRole('button', { name: /pesquisar no tcu/i }));
    await waitFor(() => expect(screen.getByTestId('resultado-tcu')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith('tcu-pesquisa', { body: expect.objectContaining({ acao: 'pesquisar', termo: 'atestado', pagina: 1, porPagina: 20 }) });
    expect(screen.getByText(/20\.536 acórdão\(s\) · página 1 de 1\.027/)).toBeInTheDocument();
    expect(screen.getByText('Acórdão 2991/2025-Plenário')).toBeInTheDocument();
    expect(screen.getByText('atestado').tagName).toBe('MARK');
    expect(screen.getByText('na base')).toBeInTheDocument();
    expect(screen.getByText(/TC 021\.706\/2025-5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Na base$/ })).toBeDisabled();

    expect(screen.getByText('Ativos')).toBeInTheDocument();
    expect(screen.getByText('Aposentados')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Primeira Câmara/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(invoke.mock.calls[1][1].body.filtros.colegiado).toEqual(['Primeira Câmara']);
    // O filtro vira ficha; a ficha remove o filtro e pesquisa de novo.
    const ficha = await screen.findByRole('button', { name: /^Primeira Câmara$/ });
    expect(ficha.closest('[data-testid="fichas-ativas"]')).not.toBeNull();
    fireEvent.click(ficha);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
    expect(invoke.mock.calls[2][1].body.filtros.colegiado).toEqual([]);
  });

  it('"Ler aqui" busca o acórdão inteiro uma vez e mostra sumário e dispositivo', async () => {
    invoke.mockResolvedValueOnce({ data: RESPOSTA, error: null }).mockResolvedValueOnce({ data: { ok: true, titulo: 'ACÓRDÃO 1116/2025', assunto: 'Pedido de reexame', sumario: 'LICITAÇÃO. ATESTADO.', acordao: '9.1. conhecer do pedido', voto: 'Voto.', voto_cortado: false, tipo_processo: 'PR' }, error: null });
    render(<PesquisaTcu termoInicial="atestado" />);
    fireEvent.click(screen.getByRole('button', { name: /pesquisar no tcu/i }));
    await waitFor(() => expect(screen.getByTestId('resultado-tcu')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /ler aqui/i })[1]);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('tcu-pesquisa', { body: { acao: 'ler', key: 'ACORDAO-COMPLETO-2' } }));
    expect(await screen.findByText(/LICITAÇÃO\. ATESTADO\./)).toBeInTheDocument();
    expect(screen.getByText(/9\.1\. conhecer do pedido/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /ler aqui/i })[1]);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('a tela vazia oferece exemplos; clicar num exemplo pesquisa com ele', async () => {
    invoke.mockResolvedValue({ data: RESPOSTA, error: null });
    render(<PesquisaTcu />);
    expect(screen.getByTestId('tcu-vazio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reajust\$ e "data-base"/ }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('tcu-pesquisa', { body: expect.objectContaining({ termo: 'reajust$ e "data-base"' }) }));
  });

  it('guardar na base chama a edge com a chave e marca o acórdão', async () => {
    invoke.mockResolvedValueOnce({ data: RESPOSTA, error: null }).mockResolvedValueOnce({ data: { ok: true, identificador: 'Acórdão 1116/2025-Plenário', situacao: 'novo' }, error: null });
    render(<PesquisaTcu termoInicial="atestado" />);
    fireEvent.click(screen.getByRole('button', { name: /pesquisar no tcu/i }));
    await waitFor(() => expect(screen.getByTestId('resultado-tcu')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /guardar na base/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('tcu-pesquisa', { body: { acao: 'guardar', key: 'ACORDAO-COMPLETO-2' } }));
    await waitFor(() => expect(screen.getAllByText('na base')).toHaveLength(2));
  });

  it('sem termo nem filtro não chama a edge; Enter no campo de número pesquisa (é um formulário)', async () => {
    invoke.mockResolvedValue({ data: RESPOSTA, error: null });
    render(<PesquisaTcu />);
    fireEvent.click(screen.getByRole('button', { name: /pesquisar no tcu/i }));
    expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
    const numero = screen.getByLabelText('Número');
    fireEvent.change(numero, { target: { value: '2991' } });
    fireEvent.submit(numero.closest('form')!);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('tcu-pesquisa', { body: expect.objectContaining({ filtros: expect.objectContaining({ numero: '2991' }), ordem: 'recentes' }) }));
  });
});
