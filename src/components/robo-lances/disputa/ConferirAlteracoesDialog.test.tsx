import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LanceConfig } from '@/components/robo-lances/ConfigurarLanceDialog';
import type { CompraDoComprasGov } from '@/lib/robo/compra-comprasgov';

/**
 * "Conferir alterações da licitação" — o que substitui "Definir nova data" com a
 * sessão passada (Rafael, 17/09/2026). Nada aqui fala com a rede.
 */
const { busca } = vi.hoisted(() => ({ busca: vi.fn() }));
vi.mock('@/lib/robo/compra-comprasgov', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/robo/compra-comprasgov')>()),
  buscarCompraDoComprasGov: busca,
}));
vi.mock('./disputa-do-robo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./disputa-do-robo')>()),
  gravarFase: vi.fn(async () => ({ ok: true })),
}));

import ConferirAlteracoesDialog from './ConferirAlteracoesDialog';

const LANCE = {
  id: 'd1', edital: '90029/2026', portal: 'Compras.gov.br', uasg: '925448', valorReferencia: 0, valorInicial: 900,
  valorMinimo: 700, decrementoMin: 0, decrementoPercentual: 0, intervaloSegundos: 30, maxLances: null,
  modoAutomatico: true, status: 'aguardando', horario: '09:30', dataSessao: '2026-07-30', meuLance: 0, valorAtual: 0,
  tipoDisputa: 'item',
  itens: [
    { id: 'a', numero: 1, descricao: 'Microcomputador', quantidade: 100, unidade: 'Unidade', valorReferencia: 10, valorMinimo: 8, origem: 'comprasgov' },
  ],
} as unknown as LanceConfig;

const compra = (extra: Partial<CompraDoComprasGov> = {}): CompraDoComprasGov => ({
  idCompra: '92544805900292026', uasg: '925448', numero: 90029, ano: 2026, modalidade: 'Pregão - Eletrônico',
  orgao: null, unidade: null, uf: null, municipio: null, objeto: null, srp: false, modoDisputa: 'Aberto', criterio: null,
  situacao: 'Divulgada no PNCP', processo: null, aberturaPropostas: null, encerramentoPropostas: '2026-07-30T12:30:00Z',
  numeroControlePncp: null, urlPncp: null, cnpjOrgao: null, anoPncp: null, sequencialPncp: null,
  itens: [{
    numero: 1, descricao: 'Microcomputador', quantidade: 100, unidade: 'Unidade', valorUnitarioEstimado: 10, sigiloso: false,
    grupo: null, beneficio: null, situacao: 'Em andamento', criterio: null, materialOuServico: null, resultado: null,
  }],
  ...extra,
});

const abrir = (lance: LanceConfig, props: Partial<Parameters<typeof ConferirAlteracoesDialog>[0]> = {}) => {
  const aoSalvar = vi.fn(async (_lance: LanceConfig) => {});
  const aoCadastrarNova = vi.fn();
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <ConferirAlteracoesDialog
        lance={lance}
        aberto
        aoMudarAberto={() => {}}
        aoSalvar={aoSalvar}
        aoAlterar={() => {}}
        aoCadastrarNova={aoCadastrarNova}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { aoSalvar, aoCadastrarNova };
};

beforeEach(() => busca.mockReset());

describe('ConferirAlteracoesDialog', () => {
  it('a licitação mudou: lista o que mudou, e atualizar tira o piso do item alterado e desliga o Modo Automático', async () => {
    const c = compra({ encerramentoPropostas: '2999-09-25T12:30:00Z' });
    c.itens[0] = { ...c.itens[0], quantidade: 50 };
    busca.mockResolvedValue({ ok: true, compras: [c] });
    const { aoSalvar } = abrir(LANCE);

    expect(await screen.findByText('A licitação mudou')).toBeInTheDocument();
    expect(screen.getByText('Item 1: quantidade 100 → 50')).toBeInTheDocument();
    expect(screen.queryByText(/Definir nova data/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar a disputa com a licitação/ }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    const salvo = aoSalvar.mock.calls[0][0] as LanceConfig;
    expect(salvo.itens[0]).toMatchObject({ quantidade: 50, valorMinimo: null });
    expect(salvo.modoAutomatico).toBe(false);
    expect(salvo.dataSessao).toBe('2999-09-25');
  });

  it('só a data mudou: "Atualizar a data" mantém o piso e o Modo Automático', async () => {
    busca.mockResolvedValue({ ok: true, compras: [compra({ encerramentoPropostas: '2999-09-25T12:30:00Z' })] });
    const { aoSalvar } = abrir(LANCE);

    fireEvent.click(await screen.findByRole('button', { name: /Atualizar a data/ }));
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    const salvo = aoSalvar.mock.calls[0][0] as LanceConfig;
    expect(salvo.itens[0]).toMatchObject({ valorMinimo: 8 });
    expect(salvo.modoAutomatico).toBe(true);
    expect(salvo.dataSessao).toBe('2999-09-25');
  });

  it('licitação revogada: nada a atualizar, só encerrar', async () => {
    busca.mockResolvedValue({ ok: true, compras: [compra({ situacao: 'Revogada' })] });
    abrir(LANCE);

    expect(await screen.findByText('A licitação consta como "Revogada"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar a disputa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Atualizar/ })).not.toBeInTheDocument();
  });

  it('não foi remarcada: diz que não há o que atualizar', async () => {
    busca.mockResolvedValue({ ok: true, compras: [compra()] });
    abrir(LANCE);

    expect(await screen.findByText('A licitação não foi remarcada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Atualizar/ })).not.toBeInTheDocument();
  });

  it('portal sem leitura da licitação: não troca a data — leva a cadastrar uma nova disputa', async () => {
    const { aoCadastrarNova } = abrir({ ...LANCE, portal: 'Portal de Compras Públicas', uasg: undefined });

    expect(await screen.findByText(/O sistema ainda não lê a licitação em Portal de Compras Públicas/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar nova disputa/ }));
    expect(aoCadastrarNova).toHaveBeenCalled();
    expect(busca).not.toHaveBeenCalled();
  });
});
