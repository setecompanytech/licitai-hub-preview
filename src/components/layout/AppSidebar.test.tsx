import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { navGroups } from '@/lib/navegacao/menu';

/**
 * A navegação foi para o topo na manhã de 13/09 e voltou para a coluna à
 * tarde, com o comando de reestruturação do Gestão e suas 22 referências.
 * Estes casos travam o que não pode se perder em NENHUMA das duas formas:
 *
 *  - todo grupo permitido aparece;
 *  - grupo cujas rotas o membro não pode abrir some inteiro;
 *  - existe UMA busca, e ela é a mesma do Ctrl+K;
 *  - a coluna recolhe.
 *
 * Existem porque a verificação visual desta coluna depende de uma conta COM
 * permissões — na captura automatizada `canAccessRoute` nega tudo e a coluna
 * aparece (corretamente) vazia, o que não prova nada.
 */
const permissoes = { canAccessRoute: (_: string) => true, isAdmin: true };

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));

const montar = (rota = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <AppSidebar />
    </MemoryRouter>,
  );

describe('AppSidebar — a coluna de navegação', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
    window.localStorage.clear();
  });

  it('mostra todos os grupos do menu quando tudo é permitido', () => {
    montar();
    for (const grupo of navGroups) {
      const rotulo = grupo.curto ?? grupo.title;
      expect(screen.getAllByText(rotulo).length).toBeGreaterThan(0);
    }
  });

  it('esconde o grupo cujas rotas o membro não pode acessar', () => {
    permissoes.canAccessRoute = (path) => !path.startsWith('/admin');
    permissoes.isAdmin = false;
    montar();
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getAllByText('Inteligência').length).toBeGreaterThan(0);
  });

  it('abre o grupo da rota atual, para a pessoa se ver no menu', () => {
    montar('/gestao-contratos');
    expect(screen.getByText('Contratos')).toBeTruthy();
  });

  it('tem UMA busca, e ela dispara o mesmo diálogo do Ctrl+K', () => {
    const ouvinte = vi.fn();
    window.addEventListener('praefectus:abrir-busca', ouvinte);
    montar();
    const buscas = screen.getAllByLabelText('Buscar no sistema');
    expect(buscas).toHaveLength(1);
    fireEvent.click(buscas[0]);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener('praefectus:abrir-busca', ouvinte);
  });

  it('recolhe e lembra a escolha entre sessões', () => {
    montar();
    fireEvent.click(screen.getByLabelText('Recolher navegação'));
    expect(screen.getByLabelText('Expandir navegação')).toBeTruthy();
    expect(window.localStorage.getItem('praefectus:barra-recolhida')).toBe('1');
  });
});
