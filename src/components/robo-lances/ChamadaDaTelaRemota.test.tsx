import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { chamarTelaRemota, chamadaAtual, fecharChamadaDaTelaRemota, SEGUNDOS_DA_CHAMADA } from '@/lib/robo/chamada-da-tela-remota';

/**
 * O toast grande da tela remota (Ian, 17/09/2026): só para a equipe Praefectus,
 * leva a Configurações do Robô de Lances › Sessões e tela remota, fecha no
 * botão, some sozinho e some quando o robô para.
 */
const { papel, sessao } = vi.hoisted(() => ({
  papel: { isSystemAdmin: true },
  sessao: { linha: null as Record<string, unknown> | null },
}));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => papel }));
vi.mock('@/integrations/supabase/client', () => {
  const cadeia: Record<string, unknown> = new Proxy(
    {},
    {
      get(_a, prop) {
        if (prop === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve({ data: sessao.linha ? [sessao.linha] : [], error: null }).then(ok);
        return () => cadeia;
      },
    },
  );
  return { supabase: { from: () => cadeia } };
});

import ChamadaDaTelaRemota from './ChamadaDaTelaRemota';

function Local() {
  const { pathname, search } = useLocation();
  return <span data-testid="local">{pathname + search}</span>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/robo-lances/disputa/d1']}>
      <ChamadaDaTelaRemota />
      <Routes>
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );

const chamar = (extra: Record<string, unknown> = {}) =>
  act(() => {
    chamarTelaRemota({ motivo: 'entrando', titulo: 'Robô entrando — 07/2026', mensagem: 'O robô está entrando.', disputaId: 'd1', sessaoDesde: null, ...extra });
  });

describe('ChamadaDaTelaRemota', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    papel.isSystemAdmin = true;
    sessao.linha = null;
    fecharChamadaDaTelaRemota();
  });
  afterEach(() => {
    act(() => fecharChamadaDaTelaRemota());
    vi.useRealTimers();
  });

  it('"Abrir a tela remota" leva ao admin do robô já abrindo a tela, carregando a volta para a disputa', () => {
    montar();
    chamar();

    expect(screen.getByRole('heading', { name: 'Robô entrando — 07/2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Abrir a tela remota/ }));
    expect(screen.getByTestId('local')).toHaveTextContent(
      '/admin/robo-lances?aba=sessoes&tela=abrir&voltar=%2Frobo-lances%2Fdisputa%2Fd1',
    );
    expect(chamadaAtual()).toBeNull();
  });

  it('aviso sem disputa, fora da tela do robô: leva ao admin sem atalho de volta', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ChamadaDaTelaRemota />
        <Routes>
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>,
    );
    chamar({ disputaId: null, motivo: 'captcha' });
    fireEvent.click(screen.getByRole('button', { name: /Abrir a tela remota/ }));
    expect(screen.getByTestId('local')).toHaveTextContent('/admin/robo-lances?aba=sessoes&tela=abrir');
  });

  it('quem não é da equipe Praefectus não vê nada', () => {
    papel.isSystemAdmin = false;
    montar();
    chamar();
    expect(screen.queryByRole('heading', { name: 'Robô entrando — 07/2026' })).not.toBeInTheDocument();
  });

  it('fecha no X e em "Agora não"', () => {
    montar();
    chamar();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o aviso da tela remota' }));
    expect(chamadaAtual()).toBeNull();

    chamar();
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(chamadaAtual()).toBeNull();
  });

  it('some sozinho depois do tempo, e o mouse em cima segura', () => {
    montar();
    chamar({ disputaId: null });
    const caixa = screen.getByRole('region', { name: 'Tela remota do robô' });

    fireEvent.mouseEnter(caixa);
    act(() => { vi.advanceTimersByTime((SEGUNDOS_DA_CHAMADA + 5) * 1000); });
    expect(chamadaAtual()).not.toBeNull();

    fireEvent.mouseLeave(caixa);
    act(() => { vi.advanceTimersByTime((SEGUNDOS_DA_CHAMADA + 1) * 1000); });
    expect(chamadaAtual()).toBeNull();
  });

  it('some quando o robô para', async () => {
    montar();
    chamar();
    sessao.linha = { status: 'encerrado', parada_confirmada_em: null };
    await act(async () => { vi.advanceTimersByTime(5_000); });
    await act(async () => {});
    expect(chamadaAtual()).toBeNull();
  });
});
