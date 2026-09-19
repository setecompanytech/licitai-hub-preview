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
 *     o contrato que só a plataforma usa: `PedidoDoRobo permitirTelaRemota`;
 *  3. a rota continua fechada a quem não é administrador do sistema;
 *  4. operação × oficina técnica (19/09/2026): todo admin da plataforma opera
 *     (Sessões, Avisos, Histórico); Agente e Diagnóstico são só da conta de
 *     engenharia.
 *
 * Os componentes reaproveitados têm testes próprios (e falam com rede):
 * aqui são dublês que só dizem quais props receberam.
 */

const autorizacao = vi.hoisted(() => ({ isSystemAdmin: true, loading: false }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => autorizacao }));
const conta = vi.hoisted(() => ({ ehContaDeEngenharia: true, carregando: false }));
vi.mock('@/hooks/useContaDeEngenharia', () => ({ useContaDeEngenharia: () => conta }));
vi.mock('@/components/shared/SkeletonPagina', () => ({ default: () => null }));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ rota, acoes }: { rota?: string; acoes?: ReactNode }) => (
    <header data-testid="cabecalho" data-rota={rota}>
      {acoes}
    </header>
  ),
}));

vi.mock('@/components/robo-lances/AgenteExternoConfig', () => ({
  default: () => <div data-testid="agente-externo-config" />,
}));
vi.mock('@/components/robo-lances/PortalHealthcheck', () => ({
  default: () => <div data-testid="portal-healthcheck" />,
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
vi.mock('@/components/admin-robo/DiagnosticoDeSessoes', () => ({
  default: () => <div data-testid="diagnostico-sessoes" />,
}));
vi.mock('@/components/admin-robo/RegistroDeChamadas', () => ({
  default: () => <div data-testid="registro-chamadas" />,
}));
vi.mock('@/components/admin-robo/GestorDeAvisos', () => ({
  default: () => <div data-testid="gestor-avisos" />,
}));
vi.mock('@/components/admin-robo/HistoricoDoRobo', () => ({
  default: () => <div data-testid="historico-do-robo" />,
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
  conta.ehContaDeEngenharia = true;
  conta.carregando = false;
});

/**
 * Operação × oficina técnica (Rafael, 18/09; Ian, 19/09): o admin da
 * plataforma que opera — a Santa Rosa, login do Rafael — segue com a tela
 * remota, o captcha, os avisos e o histórico, sem segunda conta; a "poluição
 * visual" dos prints (agente, RAM, portais no ar, checklist) e o Diagnóstico
 * são só da conta de engenharia.
 */
describe('admin que opera, sem ser a conta de engenharia', () => {
  beforeEach(() => {
    conta.ehContaDeEngenharia = false;
  });

  it('vê só as três abas da operação, e abre em Sessões e tela remota', () => {
    renderizar();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Sessões e tela remota',
      'Avisos aos clientes',
      'Histórico do robô',
    ]);
    expect(screen.getByRole('tab', { name: 'Sessões e tela remota' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('pedido-do-robo')).toHaveAttribute('data-tela-remota', 'true');
    expect(screen.queryByTestId('agente-externo-config')).toBeNull();
  });

  it('o aviso do captcha (?tela=abrir) abre a tela remota no login de quem opera', () => {
    renderizar('/admin/robo-lances?aba=sessoes&tela=abrir');
    expect(screen.getByTestId('vnc')).toHaveAttribute('data-abrir-em', '1');
  });

  it('?aba=agente e ?aba=diagnostico digitados à mão caem em Sessões, sem montar a oficina', () => {
    for (const aba of ['agente', 'diagnostico']) {
      const { unmount } = renderizar(`/admin/robo-lances?aba=${aba}`);
      expect(screen.getByTestId('sessoes-do-robo')).toBeInTheDocument();
      expect(screen.queryByTestId('agente-externo-config')).toBeNull();
      expect(screen.queryByTestId('portal-healthcheck')).toBeNull();
      expect(screen.queryByTestId('registro-chamadas')).toBeNull();
      unmount();
    }
  });

  it('Avisos e Histórico abrem normalmente', () => {
    const { unmount } = renderizar('/admin/robo-lances?aba=avisos');
    expect(screen.getByTestId('gestor-avisos')).toBeInTheDocument();
    unmount();
    renderizar('/admin/robo-lances?aba=auditoria');
    expect(screen.getByTestId('historico-do-robo')).toBeInTheDocument();
  });

  it('enquanto o papel carrega, esqueleto: não mostra Sessões para pular a Agente depois', () => {
    conta.carregando = true;
    renderizar();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

describe('Admin › Robô de Lances, na conta de engenharia', () => {
  it('mostra as cinco abas, na ordem', () => {
    renderizar();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Agente e infraestrutura',
      'Sessões e tela remota',
      'Diagnóstico',
      'Avisos aos clientes',
      'Histórico do robô',
    ]);
    expect(screen.getByTestId('cabecalho')).toHaveAttribute('data-rota', '/admin/robo-lances');
  });

  it('abre em Agente e infraestrutura; o checklist, que é de uma empresa, vira aviso', () => {
    renderizar();
    expect(screen.getByRole('tab', { name: 'Agente e infraestrutura' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('agente-externo-config')).toBeInTheDocument();
    expect(screen.getByTestId('portal-healthcheck')).toBeInTheDocument();
    expect(screen.getByText(/não aparece na conta de engenharia, que não tem empresa/)).toBeInTheDocument();
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

  it('Histórico do robô (link antigo ?aba=auditoria cai nele); trilha e tempo real, de cada conta, saíram', () => {
    renderizar('/admin/robo-lances?aba=auditoria');
    expect(screen.getByTestId('historico-do-robo')).toBeInTheDocument();
    expect(screen.getByText(/eventos em tempo real de cada conta saíram desta tela/)).toBeInTheDocument();
  });

  it('aba desconhecida na URL cai na primeira, em vez de tela vazia', () => {
    renderizar('/admin/robo-lances?aba=inexistente');
    expect(screen.getByTestId('agente-externo-config')).toBeInTheDocument();
  });
});

/**
 * O atalho de volta (Ian, 17/09/2026): quem chegou pela chamada da tela remota
 * volta com um clique; quem abriu pelo menu vê o estado inicial.
 */
describe('atalho para o Robô de Lances', () => {
  const botao = () => screen.getByRole('link', { name: /Robô de Lances|Voltar para o robô/ });

  it('aberto pelo menu: "Ir para o Robô de Lances", discreto, para a lista', () => {
    renderizar();
    const link = botao();
    expect(link).toHaveTextContent('Ir para o Robô de Lances');
    expect(link).toHaveAttribute('href', '/robo-lances');
    expect(link.className).not.toMatch(/piscar-verde/);
  });

  it('vindo da chamada da tela remota: "Voltar para o robô", piscando verde, para a disputa', () => {
    renderizar('/admin/robo-lances?aba=sessoes&voltar=%2Frobo-lances%2Fdisputa%2Fd1');
    const link = botao();
    expect(link).toHaveTextContent('Voltar para o robô');
    expect(link).toHaveAttribute('href', '/robo-lances/disputa/d1');
    expect(link.className).toMatch(/piscar-verde/);
  });

  it('o atalho sobrevive a abrir a tela remota e a trocar de aba na mesma visita', () => {
    renderizar('/admin/robo-lances?aba=sessoes&tela=abrir&voltar=%2Frobo-lances%2Fdisputa%2Fd1');
    expect(screen.getByTestId('vnc')).toHaveAttribute('data-abrir-em', '1');
    expect(botao()).toHaveTextContent('Voltar para o robô');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Diagnóstico' }), { button: 0 });
    expect(botao()).toHaveTextContent('Voltar para o robô');
  });

  it('endereço de fora na URL não vira botão de volta', () => {
    renderizar('/admin/robo-lances?voltar=https%3A%2F%2Fevil.com');
    const link = botao();
    expect(link).toHaveTextContent('Ir para o Robô de Lances');
    expect(link).toHaveAttribute('href', '/robo-lances');
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
