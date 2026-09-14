import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

/**
 * Ligar e desligar o robô da empresa.
 *
 * O que estes testes prendem:
 *  1. Desligar PEDE CONFIRMAÇÃO antes de gravar qualquer coisa, e o texto da
 *     confirmação diz que lance aceito pelo portal não é cancelado.
 *  2. Confirmado, grava `ligado = false` ANTES de pedir a parada ao freio —
 *     parar primeiro deixaria uma janela para sessão nova.
 *  3. Parada sem confirmação do agente é dita "SOLICITADA", nunca "parada".
 *  4. Ligar só grava; não chama o agente.
 *  5. Migration pendente e visualizador: botão indisponível, com o motivo.
 *
 * Nada aqui fala com rede: supabase, `causaDoErro` e o toast são dublês.
 */

const dubles = vi.hoisted(() => ({
  upsert: vi.fn(),
  select: vi.fn(),
  invoke: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/integrations/supabase/client', () => {
  // MESMO objeto a cada chamada de `from`.
  const cadeia = {
    upsert: (...args: unknown[]) => {
      dubles.upsert(...args);
      return { select: dubles.select };
    },
  };
  return {
    supabase: {
      from: (tabela: string) => {
        dubles.upsert.mockName(tabela);
        return cadeia;
      },
      functions: { invoke: dubles.invoke },
    },
  };
});

vi.mock('@/lib/robo/comandos', () => ({
  causaDoErro: async (e: { message?: string }) => e?.message ?? '',
}));

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), dubles.toast) }));

import LigarDesligarRobo from './LigarDesligarRobo';
import type { EstadoDoRoboDaEmpresa } from './useRoboDaEmpresa';

const LIGADO: EstadoDoRoboDaEmpresa = {
  ligado: true,
  confirmado: true,
  carregando: false,
  migracaoPendente: false,
  erro: null,
  motivo: null,
  alteradoEm: null,
};

function renderizar(estado: Partial<EstadoDoRoboDaEmpresa> = {}, podeOperar = true) {
  const aoAlterar = vi.fn();
  render(
    <LigarDesligarRobo
      empresaId="empresa-1"
      estado={{ ...LIGADO, ...estado }}
      podeOperar={podeOperar}
      aoAlterar={aoAlterar}
    />,
  );
  return { aoAlterar };
}

beforeEach(() => {
  vi.clearAllMocks();
  dubles.select.mockResolvedValue({
    data: [{ ligado: false, motivo: 'Desligado na tela do robô de lances', alterado_em: '2026-09-14T13:00:00Z' }],
    error: null,
  });
  dubles.invoke.mockResolvedValue({
    data: { sessoes_alvo: 2, sessoes_confirmadas: 2, sessoes_aguardando: 0 },
    error: null,
  });
});

async function confirmarDesligamento() {
  fireEvent.click(screen.getByRole('button', { name: /Desligar o robô/ }));
  const dialogo = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Desligar o robô' }));
}

describe('LigarDesligarRobo — desligar', () => {
  it('pede confirmação antes de gravar, e diz que lance aceito não é cancelado', async () => {
    renderizar();

    fireEvent.click(screen.getByRole('button', { name: /Desligar o robô/ }));
    const dialogo = await screen.findByRole('alertdialog');

    expect(within(dialogo).getByText(/Desligar impede iniciar novas sessões/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Lances já aceitos pelo portal não são cancelados/)).toBeInTheDocument();
    expect(dubles.upsert).not.toHaveBeenCalled();
    expect(dubles.invoke).not.toHaveBeenCalled();
  });

  it('confirmado, grava ligado=false e só então pede a parada ao freio', async () => {
    const { aoAlterar } = renderizar();
    await confirmarDesligamento();

    await waitFor(() => expect(dubles.invoke).toHaveBeenCalled());
    expect(dubles.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ empresa_id: 'empresa-1', ligado: false }),
      { onConflict: 'empresa_id' },
    );
    expect(dubles.invoke).toHaveBeenCalledWith('robo-lances-webhook/kill-switch', expect.anything());
    // Ordem: gravar primeiro, parar depois.
    expect(dubles.upsert.mock.invocationCallOrder[0]).toBeLessThan(dubles.invoke.mock.invocationCallOrder[0]);
    expect(aoAlterar).toHaveBeenCalledWith(expect.objectContaining({ ligado: false }));
    await waitFor(() =>
      expect(dubles.toast.warning).toHaveBeenCalledWith(expect.stringMatching(/Parada confirmada/), expect.anything()),
    );
  });

  it('parada sem confirmação do agente é "SOLICITADA", nunca "parada"', async () => {
    dubles.invoke.mockResolvedValue({
      data: { sessoes_alvo: 3, sessoes_confirmadas: 1, sessoes_aguardando: 2 },
      error: null,
    });
    renderizar();
    await confirmarDesligamento();

    await waitFor(() =>
      expect(dubles.toast.error).toHaveBeenCalledWith(expect.stringMatching(/SOLICITADA/), expect.anything()),
    );
    expect(dubles.toast.warning).not.toHaveBeenCalledWith(expect.stringMatching(/Parada confirmada/), expect.anything());
    expect(await screen.findByText(/2 de 3 sessão\(ões\) aguardando confirmação/)).toBeInTheDocument();
  });

  it('se a gravação falhar, diz que não desligou e pede a parada mesmo assim', async () => {
    dubles.select.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const { aoAlterar } = renderizar();
    await confirmarDesligamento();

    await waitFor(() => expect(dubles.invoke).toHaveBeenCalled());
    expect(aoAlterar).not.toHaveBeenCalled();
    expect(dubles.toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/O robô não foi desligado/),
      expect.anything(),
    );
  });
});

describe('LigarDesligarRobo — ligar e estados sem controle', () => {
  it('ligar só grava ligado=true, sem chamar o agente', async () => {
    dubles.select.mockResolvedValue({ data: [{ ligado: true, motivo: null, alterado_em: null }], error: null });
    const { aoAlterar } = renderizar({ ligado: false });

    fireEvent.click(screen.getByRole('button', { name: /Ligar o robô/ }));

    await waitFor(() => expect(aoAlterar).toHaveBeenCalledWith(expect.objectContaining({ ligado: true })));
    expect(dubles.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ empresa_id: 'empresa-1', ligado: true }),
      { onConflict: 'empresa_id' },
    );
    expect(dubles.invoke).not.toHaveBeenCalled();
  });

  it('migration pendente: botão indisponível, com a nota discreta', () => {
    renderizar({ migracaoPendente: true });

    expect(screen.getByRole('button', { name: /Desligar o robô/ })).toBeDisabled();
    expect(screen.getByText('Liga/desliga disponível após atualização do banco')).toBeInTheDocument();
  });

  it('visualizador vê o estado e o motivo de não poder mudar', () => {
    renderizar({}, false);

    expect(screen.getByRole('button', { name: /Desligar o robô/ })).toBeDisabled();
    expect(screen.getByText(/exige o papel de operador/)).toBeInTheDocument();
  });
});
