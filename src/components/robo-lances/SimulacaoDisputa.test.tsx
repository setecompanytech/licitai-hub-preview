import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { LanceConfig } from './ConfigurarLanceDialog';

/**
 * A simulação não escreve no mural real.
 *
 * Até 14/09/2026 ela publicava "🤖 Lance Automático #n" em
 * `licitacao_mensagens` — o mural do processo, onde chegam as mensagens do
 * pregoeiro. Quem abria o processo lia lances que nunca existiram.
 */

const dubles = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      dubles.from(tabela);
      return { insert: dubles.insert };
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});

import SimulacaoDisputa from './SimulacaoDisputa';

const LANCE: LanceConfig = {
  id: 'disputa-1',
  edital: 'PE 90001/2026',
  portal: 'Compras.gov',
  valorReferencia: 10000,
  valorInicial: 9000,
  valorMinimo: 7000,
  decrementoMin: 50,
  decrementoPercentual: 1.5,
  intervaloSegundos: 5,
  maxLances: 20,
  modoAutomatico: false,
  status: 'aguardando',
  horario: '09:00',
  meuLance: 0,
  valorAtual: 0,
  itens: [],
  tipoDisputa: 'item',
  licitacaoId: 'licitacao-1',
};

afterEach(() => {
  vi.useRealTimers();
});

describe('SimulacaoDisputa', () => {
  it('roda várias rodadas sem tocar em licitacao_mensagens nem em tabela nenhuma', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <SimulacaoDisputa lance={LANCE} onUpdate={() => {}} licitacaoId="licitacao-1" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Iniciar/ }));
    act(() => {
      vi.advanceTimersByTime(LANCE.intervaloSegundos * 1000 * 3);
    });

    // A simulação andou…
    expect(screen.getByText(/Lance simulado #1 \(nosso\)/)).toBeInTheDocument();
    expect(screen.getByText(/Lance simulado #4 \(concorrente\)/)).toBeInTheDocument();
    // …e nada saiu desta tela.
    expect(dubles.from).not.toHaveBeenCalledWith('licitacao_mensagens');
    expect(dubles.from).not.toHaveBeenCalled();
    expect(dubles.insert).not.toHaveBeenCalled();

    unmount();
  });

  it('diz o tempo todo que é simulação, e não oferece publicar no mural', () => {
    render(<SimulacaoDisputa lance={LANCE} onUpdate={() => {}} licitacaoId="licitacao-1" />);

    expect(screen.getByText(/Simulação — nada é enviado ao portal/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mural/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/publicados no Mural/i)).not.toBeInTheDocument();
  });
});
