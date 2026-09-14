import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * O aceite não registra uma verificação que não aconteceu.
 *
 * O código do Nível 3 é sorteado e conferido no navegador — é confirmação
 * por digitação, não segundo fator. Até 14/09/2026 o aceite gravava
 * `dupla_autenticacao_verificada: true` mesmo assim, numa tabela que é
 * trilha de auditoria.
 */

const dubles = vi.hoisted(() => ({
  insert: vi.fn(),
  registrar: vi.fn(async () => undefined),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: (payload: unknown) => {
        dubles.insert(payload);
        return { select: () => ({ single: async () => ({ data: { id: 'aceite-1' }, error: null }) }) };
      },
    }),
  },
}));

// MESMO objeto a cada render — ver o aviso em src/pages/RoboLances.test.tsx.
vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});
vi.mock('@/hooks/useAuditLog', () => {
  const valor = { registrar: dubles.registrar };
  return { useAuditLog: () => valor };
});
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(),
  }),
}));
// Dublês de peças de UI que dependem de APIs que o jsdom não tem.
vi.mock('@/components/ui/money-input', () => ({
  MoneyInput: ({ id, onValueChange }: { id?: string; onValueChange: (v: number) => void }) => (
    <input id={id} onChange={(e) => onValueChange(Number(e.target.value))} />
  ),
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import AceiteTermosDialog from './AceiteTermosDialog';

function preencherTermos() {
  fireEvent.change(screen.getByLabelText(/Limite Financeiro/), { target: { value: '5000' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Política de Uso/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /responsável legal/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AceiteTermosDialog', () => {
  it('Nível 3: pede o código digitado, mas grava dupla_autenticacao_verificada = false', async () => {
    const onAceite = vi.fn();
    render(<AceiteTermosDialog open onOpenChange={() => {}} nivel={3} onAceite={onAceite} />);

    // O rótulo não finge ser segundo fator.
    expect(screen.getAllByText(/não é autenticação de dois fatores/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/código de verificação/i)).not.toBeInTheDocument();

    preencherTermos();
    const botao = screen.getByRole('button', { name: /Aceitar e Prosseguir/ });
    // Sem o código, não prossegue.
    expect(botao).toBeDisabled();

    const codigo = screen.getByTestId('codigo-confirmacao').textContent || '';
    expect(codigo).toMatch(/^\d{6}$/);
    fireEvent.change(screen.getByLabelText(/Código de confirmação/), { target: { value: codigo } });
    expect(botao).toBeEnabled();

    fireEvent.click(botao);

    await waitFor(() => expect(dubles.insert).toHaveBeenCalledTimes(1));
    const payload = dubles.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.dupla_autenticacao_verificada).toBe(false);
    expect(payload.nivel_automacao).toBe(3);

    await waitFor(() => expect(onAceite).toHaveBeenCalledWith('aceite-1'));
    expect(dubles.registrar).toHaveBeenCalledWith(
      'aceite_termos',
      expect.objectContaining({ dupla_autenticacao: false, confirmacao_digitada: true }),
      expect.anything(),
    );
  });

  it('Nível 2: não pede código e também grava false', async () => {
    render(<AceiteTermosDialog open onOpenChange={() => {}} nivel={2} onAceite={() => {}} />);

    expect(screen.queryByLabelText(/Código de confirmação/)).not.toBeInTheDocument();
    preencherTermos();
    fireEvent.click(screen.getByRole('button', { name: /Aceitar e Prosseguir/ }));

    await waitFor(() => expect(dubles.insert).toHaveBeenCalledTimes(1));
    expect((dubles.insert.mock.calls[0][0] as Record<string, unknown>).dupla_autenticacao_verificada).toBe(false);
  });
});
