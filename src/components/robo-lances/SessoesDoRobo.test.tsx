import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * O freio de UMA sessão diz o que de fato aconteceu.
 *
 * Até 14/09/2026 o botão chamava a função com a ação no corpo, recebia 404 e
 * mostrava "já não estava mais rodando". Estes testes prendem as três
 * respostas honestas — e, sobretudo, que "solicitada" nunca vira "parada".
 *
 * Nada aqui fala com rede: `solicitarParada` e o supabase são dublês.
 */

const dubles = vi.hoisted(() => ({
  solicitarParada: vi.fn(),
  invoke: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// `causaDoErro` (ler o motivo no corpo da resposta, e não o "non-2xx") mora em
// `comandos.ts` e é testado lá. Aqui só importa o que a tela faz com o
// resultado da parada.
vi.mock('@/lib/robo/comandos', () => ({
  solicitarParada: dubles.solicitarParada,
  causaDoErro: async (e: { message?: string }) => e?.message ?? '',
}));

vi.mock('@/integrations/supabase/client', () => {
  const resposta = {
    data: [
      {
        id: 's-1',
        edital: 'PE 90001/2026',
        portal_nome: 'Compras.gov',
        status: 'ativo',
        erro: null,
        rodada_atual: 3,
        valor_atual: 9000,
        created_at: '2026-09-14T15:00:00.000Z',
        updated_at: '2026-09-14T15:30:00.000Z',
      },
    ],
    error: null,
  };
  const cadeia = {
    select: () => cadeia,
    order: () => cadeia,
    limit: async () => resposta,
  };
  return { supabase: { from: () => cadeia, functions: { invoke: dubles.invoke } } };
});

// MESMO objeto a cada render: um literal novo por chamada redispararia efeitos.
vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), dubles.toast) }));

import SessoesDoRobo from './SessoesDoRobo';

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <SessoesDoRobo />
    </QueryClientProvider>,
  );
}

async function clicarParar() {
  fireEvent.click(await screen.findByRole('button', { name: /Parar robô nesta disputa/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SessoesDoRobo — parar uma sessão', () => {
  it('pede a parada por solicitarParada, com o id da sessão', async () => {
    dubles.solicitarParada.mockResolvedValue({
      estado: 'confirmada', sessaoId: 's-1', solicitadaEm: null,
      confirmadaEm: '2026-09-14T15:34:56.000Z', motivo: null,
    });
    renderizar();
    await clicarParar();

    await waitFor(() => expect(dubles.solicitarParada).toHaveBeenCalledWith('s-1'));
  });

  it('solicitada: diz "aguardando confirmação" e NUNCA que parou', async () => {
    dubles.solicitarParada.mockResolvedValue({
      estado: 'solicitada', sessaoId: 's-1',
      solicitadaEm: '2026-09-14T15:34:50.000Z', confirmadaEm: null,
      motivo: 'Agente Cloud: sem resposta',
    });
    renderizar();
    await clicarParar();

    expect(
      await screen.findByText(/Parada solicitada — aguardando confirmação do serviço/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Agente Cloud: sem resposta/)).toBeInTheDocument();
    expect(screen.queryByText(/Parada confirmada/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bparado\b|robô parou/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/interrompido|já não estava/i)).not.toBeInTheDocument();
    expect(dubles.toast.success).not.toHaveBeenCalled();
    // O freio continua à mão: a sessão pode seguir no portal.
    expect(screen.getByRole('button', { name: /Pedir a parada de novo/ })).toBeEnabled();
  });

  it('confirmada: diz a hora da confirmação no horário de Brasília', async () => {
    dubles.solicitarParada.mockResolvedValue({
      estado: 'confirmada', sessaoId: 's-1',
      solicitadaEm: '2026-09-14T15:34:50.000Z',
      confirmadaEm: '2026-09-14T15:34:56.000Z',
      motivo: null,
    });
    renderizar();
    await clicarParar();

    expect(
      await screen.findByText('Parada confirmada às 12:34:56 (horário de Brasília)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/aguardando confirmação/)).not.toBeInTheDocument();
  });

  it('falhou: mostra o motivo REAL do servidor e oferece tentar de novo', async () => {
    // O motivo já chega extraído do corpo da resposta (`causaDoErro`, testado
    // em comandos.test.ts). A tela precisa mostrá-lo como veio.
    dubles.solicitarParada.mockResolvedValue({
      estado: 'falhou', sessaoId: 's-1', solicitadaEm: null, confirmadaEm: null,
      motivo: 'Você não pode parar esta sessão',
    });
    renderizar();
    await clicarParar();

    expect(
      await screen.findByText(/Não foi possível pedir a parada: Você não pode parar esta sessão/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/non-2xx/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    await waitFor(() => expect(dubles.solicitarParada).toHaveBeenCalledTimes(2));
  });

  it('avisa, junto do botão, que parar não cancela lance já aceito', async () => {
    renderizar();
    expect(
      await screen.findByText(/Parar não cancela lances já aceitos pelo portal/),
    ).toBeInTheDocument();
  });
});
