import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NotificacaoDoRobo } from '@/lib/robo/avisos-do-robo';
import { chamadaAtual, fecharChamadaDaTelaRemota } from '@/lib/robo/chamada-da-tela-remota';

/**
 * A caixinha do robô aparece e some sozinha (pedido do Ian, 17/09): 8 s o
 * aviso comum, 15 s o urgente, e o mouse em cima segura enquanto a pessoa lê.
 */

const estado: { notificacoes: NotificacaoDoRobo[] } = { notificacoes: [] };

// Usuário ESTÁVEL entre renderizações, como o AuthContext real: um objeto novo a
// cada chamada refaria o efeito de carga em laço.
const USUARIO = { id: 'u-1', email: 'teste@exemplo.test' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: USUARIO }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const consulta = () => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'order']) q[m] = () => q;
    q.limit = async () => ({ data: estado.notificacoes, error: null });
    return q;
  };
  const canal: Record<string, unknown> = {};
  canal.on = () => canal;
  canal.subscribe = () => canal;
  return { supabase: { from: consulta, channel: () => canal, removeChannel: () => {} } };
});

import LembreteDoRobo from './LembreteDoRobo';

const aviso = (id: string, extra: Partial<NotificacaoDoRobo> = {}): NotificacaoDoRobo => ({
  id,
  titulo: `Aviso ${id}`,
  mensagem: 'O robô entrou na disputa.',
  tipo: 'info',
  link: '/robo-lances/disputa/d-1',
  lida: false,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...extra,
});

const dispensados = () => JSON.parse(localStorage.getItem('praefectus:avisos-do-robo-dispensados:u-1') || '[]') as string[];

async function montar() {
  render(
    <MemoryRouter>
      <LembreteDoRobo />
    </MemoryRouter>,
  );
  // a leitura inicial é assíncrona
  await act(async () => {});
  await act(async () => {});
}

const passar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('LembreteDoRobo — aparece e some sozinho', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('o aviso comum some depois de 8 s e não volta na próxima abertura', async () => {
    estado.notificacoes = [aviso('a1')];
    await montar();
    expect(screen.getByText('Aviso a1')).toBeInTheDocument();

    passar(7_900);
    expect(screen.getByText('Aviso a1')).toBeInTheDocument();
    passar(200);
    expect(screen.queryByText('Aviso a1')).not.toBeInTheDocument();
    expect(dispensados()).toContain('a1');
  });

  it('o urgente fica 15 s', async () => {
    estado.notificacoes = [aviso('u1', { tipo: 'urgente' })];
    await montar();
    passar(10_000);
    expect(screen.getByText('Aviso u1')).toBeInTheDocument();
    passar(5_100);
    expect(screen.queryByText('Aviso u1')).not.toBeInTheDocument();
  });

  it('o mouse em cima segura a caixinha; ao sair, conta só o que faltava', async () => {
    estado.notificacoes = [aviso('a2')];
    await montar();
    passar(5_000);
    fireEvent.mouseEnter(screen.getByText('Aviso a2').closest('div.rounded-lg')!);
    passar(20_000);
    expect(screen.getByText('Aviso a2')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByText('Aviso a2').closest('div.rounded-lg')!);
    passar(2_900);
    expect(screen.getByText('Aviso a2')).toBeInTheDocument();
    passar(200);
    expect(screen.queryByText('Aviso a2')).not.toBeInTheDocument();
  });

  it('com a aba escondida o tempo não corre — o aviso espera a pessoa voltar', async () => {
    let escondida = true;
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => escondida });
    try {
      estado.notificacoes = [aviso('h1')];
      await montar();
      passar(60_000);
      expect(screen.getByText('Aviso h1')).toBeInTheDocument();

      escondida = false;
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      passar(7_900);
      expect(screen.getByText('Aviso h1')).toBeInTheDocument();
      passar(200);
      expect(screen.queryByText('Aviso h1')).not.toBeInTheDocument();
    } finally {
      delete (document as unknown as { hidden?: boolean }).hidden;
      if (original) Object.defineProperty(Document.prototype, 'hidden', original);
    }
  });

  it('aviso que leva à tela remota (captcha) não vira caixinha: vira a chamada grande, uma vez só', async () => {
    fecharChamadaDaTelaRemota();
    estado.notificacoes = [
      aviso('captcha', {
        titulo: '🧑 Robô esperando uma pessoa — 07/2026',
        mensagem: 'O robô parou esperando o clique no captcha do gov.br. Tela remota: https://agente.exemplo/vnc/',
        tipo: 'urgente',
        link: '/admin/robo-lances',
      }),
    ];
    await montar();

    expect(screen.queryByText('🧑 Robô esperando uma pessoa — 07/2026')).not.toBeInTheDocument();
    expect(chamadaAtual()).toMatchObject({ motivo: 'captcha', titulo: 'Robô esperando uma pessoa — 07/2026' });
    expect(chamadaAtual()?.mensagem).not.toMatch(/https/);
    expect(dispensados()).toContain('captcha');
    fecharChamadaDaTelaRemota();
  });

  it('pedido de captcha de meia hora atrás não chama ao abrir o sistema: já expirou', async () => {
    fecharChamadaDaTelaRemota();
    estado.notificacoes = [
      aviso('velho', { link: '/admin/robo-lances', tipo: 'urgente', created_at: new Date(Date.now() - 30 * 60_000).toISOString() }),
    ];
    await montar();
    expect(chamadaAtual()).toBeNull();
    expect(screen.queryByText('Aviso velho')).not.toBeInTheDocument();
  });

  it('ao abrir o sistema com vários avisos, mostra só os 3 mais recentes; os outros ficam no sininho', async () => {
    estado.notificacoes = [1, 2, 3, 4, 5].map((i) =>
      aviso(`v${i}`, { created_at: new Date(Date.now() - (10 - i) * 60_000).toISOString() }),
    );
    await montar();
    expect(screen.getAllByText(/^Aviso v/).map((e) => e.textContent)).toEqual(['Aviso v5', 'Aviso v4', 'Aviso v3']);
    expect(dispensados().sort()).toEqual(['v1', 'v2']);
    expect(screen.queryByText(/e mais/)).not.toBeInTheDocument();
  });
});
