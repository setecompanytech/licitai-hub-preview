import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Admin Praefectus › Robô de Lances.
 *
 * O que estes testes guardam:
 *  1. as cinco abas, na ordem, com a aba na URL;
 *  2. cada aba monta as peças técnicas que saíram da tela do cliente — e com
 *     os contratos que só a plataforma usa: `AtivacaoChecklist modo="plataforma"`
 *     e `PedidoDoRobo permitirTelaRemota`;
 *  3. a rota continua fechada a quem não é administrador do sistema.
 *
 * Os componentes reaproveitados têm testes próprios (e falam com rede):
 * aqui são dublês que só dizem quais props receberam.
 */

const autorizacao = vi.hoisted(() => ({ isSystemAdmin: true, loading: false }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => autorizacao }));
vi.mock('@/components/shared/SkeletonPagina', () => ({ default: () => null }));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ rota }: { rota?: string }) => <header data-testid="cabecalho" data-rota={rota} />,
}));

vi.mock('@/components/robo-lances/AgenteExternoConfig', () => ({
  default: () => <div data-testid="agente-externo-config" />,
}));
vi.mock('@/components/robo-lances/PortalHealthcheck', () => ({
  default: () => <div data-testid="portal-healthcheck" />,
}));
vi.mock('@/components/robo-lances/AtivacaoChecklist', () => ({
  default: ({ modo }: { modo?: string }) => <div data-testid="ativacao-checklist" data-modo={modo} />,
}));
vi.mock('@/components/robo-lances/PedidoDoRobo', () => ({
  default: ({ permitirTelaRemota, onAbrirTelaRemota }: { permitirTelaRemota?: boolean; onAbrirTelaRemota?: () => void }) => (
    <button type="button" data-testid="pedido-do-robo" data-tela-remota={String(permitirTelaRemota)} onClick={onAbrirTelaRemota}>
      pedido
    </button>
  ),
}));
vi.mock('@/components/robo-lances/VncWebViewer', () => ({
  default: ({ abrirEm }: { abrirEm?: number }) => <div data-testid="vnc" data-abrir-em={abrirEm} />,
}));
vi.mock('@/components/robo-lances/AcessoManualPortal', () => ({
  default: () => <div data-testid="acesso-manual" />,
}));
vi.mock('@/components/robo-lances/SessoesDoRobo', () => ({
  default: () => <div data-testid="sessoes-do-robo" />,
}));
vi.mock('@/components/robo-lances/AuditTrailViewer', () => ({
  default: () => <div data-testid="audit-trail" />,
}));
vi.mock('@/components/robo-lances/DisputaRealtimePanel', () => ({
  default: () => <div data-testid="disputa-realtime" />,
}));
vi.mock('@/components/admin-robo/DiagnosticoDeSessoes', () => ({
  default: () => <div data-testid="diagnostico-sessoes" />,
}));
vi.mock('@/components/admin-robo/RegistroDeChamadas', () => ({
  default: () => <div data-testid="registro-chamadas" />,
}));
vi.mock('@/components/admin-robo/GestorDeAvisos', () => ({
  default: () => <div data-testid="gestor-avisos" />,
}));

import AdminRoboLances from './AdminRoboLances';
import AdminGuard from '@/components/auth/AdminGuard';

function renderizar(url = '/admin/robo-lances') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AdminRoboLances />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  autorizacao.isSystemAdmin = true;
  autorizacao.loading = false;
});

describe('Admin › Robô de Lances', () => {
  it('mostra as cinco abas da operação, na ordem', () => {
    renderizar();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Agente e infraestrutura',
      'Sessões e tela remota',
      'Diagnóstico',
      'Avisos aos clientes',
      'Auditoria e eventos',
    ]);
    expect(screen.getByTestId('cabecalho')).toHaveAttribute('data-rota', '/admin/robo-lances');
  });

  it('abre em Agente e infraestrutura, com o checklist no modo da plataforma', () => {
    renderizar();
    expect(screen.getByRole('tab', { name: 'Agente e infraestrutura' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('agente-externo-config')).toBeInTheDocument();
    expect(screen.getByTestId('portal-healthcheck')).toBeInTheDocument();
    expect(screen.getByTestId('ativacao-checklist')).toHaveAttribute('data-modo', 'plataforma');
    expect(screen.getByText(/O cliente vê apenas se o robô está disponível/)).toBeInTheDocument();
    // As outras abas não montam — a tela remota não consulta nada fora da própria aba.
    expect(screen.queryByTestId('vnc')).toBeNull();
  });

  it('?tela=abrir (aviso "Assistir o robô ao vivo") já pede a tela remota ao chegar', () => {
    renderizar('/admin/robo-lances?aba=sessoes&tela=abrir');
    expect(screen.getByTestId('vnc')).toHaveAttribute('data-abrir-em', '1');
  });

  it('Sessões e tela remota: libera a tela remota e o pedido do robô a abre', () => {
    renderizar('/admin/robo-lances?aba=sessoes');
    const pedido = screen.getByTestId('pedido-do-robo');
    expect(pedido).toHaveAttribute('data-tela-remota', 'true');
    expect(screen.getByTestId('acesso-manual')).toBeInTheDocument();
    expect(screen.getByTestId('sessoes-do-robo')).toBeInTheDocument();
    expect(screen.getByText('A tela remota é compartilhada entre todas as empresas')).toBeInTheDocument();

    expect(screen.getByTestId('vnc')).toHaveAttribute('data-abrir-em', '0');
    fireEvent.click(pedido);
    expect(screen.getByTestId('vnc')).toHaveAttribute('data-abrir-em', '1');
  });

  it('trocar para Diagnóstico monta sessões e registro de chamadas', () => {
    renderizar();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Diagnóstico' }), { button: 0 });
    expect(screen.getByTestId('diagnostico-sessoes')).toBeInTheDocument();
    expect(screen.getByTestId('registro-chamadas')).toBeInTheDocument();
    expect(screen.queryByTestId('agente-externo-config')).toBeNull();
  });

  it('Avisos aos clientes monta o gestor de avisos', () => {
    renderizar('/admin/robo-lances?aba=avisos');
    expect(screen.getByTestId('gestor-avisos')).toBeInTheDocument();
  });

  it('Auditoria e eventos monta trilha e tempo real, e avisa que são da sua conta', () => {
    renderizar('/admin/robo-lances?aba=auditoria');
    expect(screen.getByTestId('audit-trail')).toBeInTheDocument();
    expect(screen.getByTestId('disputa-realtime')).toBeInTheDocument();
    expect(screen.getByText(/ainda leem só os registros da sua própria conta/)).toBeInTheDocument();
  });

  it('aba desconhecida na URL cai na primeira, em vez de tela vazia', () => {
    renderizar('/admin/robo-lances?aba=inexistente');
    expect(screen.getByTestId('agente-externo-config')).toBeInTheDocument();
  });
});

describe('acesso pela rota', () => {
  function pelaGuarda() {
    return render(
      <MemoryRouter initialEntries={['/admin/robo-lances']}>
        <AdminGuard>
          <AdminRoboLances />
        </AdminGuard>
      </MemoryRouter>,
    );
  }

  it('quem não é administrador do sistema não vê nada da operação', () => {
    autorizacao.isSystemAdmin = false;
    pelaGuarda();
    expect(screen.getByText('Acesso Restrito')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByTestId('agente-externo-config')).toBeNull();
  });

  it('administrador do sistema entra', () => {
    pelaGuarda();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });
});
