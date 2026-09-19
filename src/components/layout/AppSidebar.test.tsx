import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppSidebar from './AppSidebar';
import { itemAtivo } from '@/lib/navegacao/sidebar';

/**
 * A navegação lateral do Design System v3 (19/09/2026). O que se trava:
 *
 *  - os grupos vêm de `menu.ts` e o da tela atual abre sozinho;
 *  - rota que o membro não pode abrir não aparece;
 *  - os favoritos da pessoa ganham seção própria;
 *  - o trilho recolhido continua dando acesso a tudo, com rótulo acessível.
 */
const permissoes = {
  canAccessRoute: (_: string) => true,
  isAdmin: true,
  loading: false,
};

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'rafael@praefectus.com.br' } }),
}));

const preferencias = vi.hoisted(() => ({ favoritos: [] as string[] }));

vi.mock('@/hooks/usePreferenciasDeNavegacao', () => ({
  usePreferenciasDeNavegacao: () => ({
    favoritos: preferencias.favoritos,
    recentes: [],
    alternarFavorito: vi.fn(),
    registrarAcesso: vi.fn(),
    ehFavorito: (id: string) => preferencias.favoritos.includes(id),
  }),
}));

const aoAbrirFerramentas = vi.fn();
const aoAlternarRecolhida = vi.fn();

const montar = (rota = '/dashboard', props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <TooltipProvider>
        <AppSidebar
          aoAbrirFerramentas={aoAbrirFerramentas}
          aoAlternarRecolhida={aoAlternarRecolhida}
          aoAbrirBusca={vi.fn()}
          {...props}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('AppSidebar — a navegação lateral', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    preferencias.favoritos = [];
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('"Painel" leva à rota real do painel e acende quando é a tela atual', () => {
    montar('/dashboard');
    const painel = screen.getByRole('link', { name: 'Painel' });
    expect(painel.getAttribute('href')).toBe('/dashboard');
    expect(painel.getAttribute('aria-current')).toBe('page');
    expect(screen.getByLabelText('Praefectus — página inicial').getAttribute('href')).toBe('/dashboard');
  });

  it('abre o grupo da tela atual e mantém os outros recolhidos', () => {
    montar('/kanban');
    const kanban = screen.getByRole('link', { name: 'Kanban' });
    expect(kanban.getAttribute('aria-current')).toBe('page');
    // "Documentos" mora em Jurídico & Contábil, que começa fechado.
    expect(screen.queryByRole('link', { name: 'Documentos' })).toBeNull();
    expect(screen.getByRole('button', { name: /Jurídico/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('clicar no cabeçalho de um grupo mostra os itens dele', () => {
    montar('/kanban');
    fireEvent.click(screen.getByRole('button', { name: /Jurídico/ }));
    expect(screen.getByRole('link', { name: 'Documentos' }).getAttribute('href')).toBe('/documentos');
  });

  it('rota que o membro não pode abrir não aparece; grupo vazio some inteiro', () => {
    permissoes.canAccessRoute = (path) => path !== '/kanban' && !path.startsWith('/admin');
    montar('/calendario');
    expect(screen.getByRole('link', { name: 'Calendário' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Kanban' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Admin/ })).toBeNull();
  });

  it('os favoritos da pessoa ganham seção própria, acima dos grupos', () => {
    preferencias.favoritos = ['/kanban'];
    montar('/documentos');
    const secao = screen.getByRole('region', { name: 'Favoritos' });
    expect(secao).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Kanban' }).length).toBeGreaterThanOrEqual(1);
  });

  it('recolhida, vira trilho: Painel, grupos e ferramentas continuam acessíveis por rótulo', () => {
    montar('/kanban', { recolhida: true });
    expect(screen.getByLabelText('Painel').getAttribute('href')).toBe('/dashboard');
    expect(screen.getByLabelText('Gestão de Processos')).toBeTruthy();
    expect(screen.getByLabelText('Todas as ferramentas')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Expandir menu'));
    expect(aoAlternarRecolhida).toHaveBeenCalledTimes(1);
  });

  it('"Todas as ferramentas" pede a abertura do diretório', () => {
    montar('/kanban');
    fireEvent.click(screen.getByRole('button', { name: /Todas as ferramentas/ }));
    expect(aoAbrirFerramentas).toHaveBeenCalledTimes(1);
  });
});

describe('itemAtivo — a rota atual contra o item do menu', () => {
  it('casa a rota base e os filhos dela', () => {
    expect(itemAtivo('/gestao-contratos', '/gestao-contratos', '')).toBe(true);
    expect(itemAtivo('/robo-lances', '/robo-lances/disputa/abc', '')).toBe(true);
    expect(itemAtivo('/kanban', '/kanban-outro', '')).toBe(false);
  });

  it('o Painel só acende na própria rota', () => {
    expect(itemAtivo('/dashboard', '/dashboard', '')).toBe(true);
    expect(itemAtivo('/dashboard', '/dashboard/x', '')).toBe(false);
  });

  it('as pastas do Financeiro se distinguem pela consulta', () => {
    expect(itemAtivo('/financeiro?pasta=bancos', '/financeiro', '?pasta=bancos')).toBe(true);
    expect(itemAtivo('/financeiro?pasta=bancos', '/financeiro', '?pasta=fiscal')).toBe(false);
    expect(itemAtivo('/financeiro?pasta=bancos', '/financeiro/lancamentos', '')).toBe(false);
  });
});
