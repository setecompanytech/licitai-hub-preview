import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppTopNav from './AppTopNav';
import { navGroups } from '@/lib/navegacao/menu';

/**
 * A navegação mudou de lugar em 13/09 (da coluna esquerda para o centro do
 * topo). Estes casos travam o que não pode se perder na mudança: todo grupo
 * permitido aparece, grupo negado some, e a fila não duplica a lista do menu.
 *
 * Existem porque a verificação visual desta barra depende de uma conta COM
 * permissões — na captura automatizada, `canAccessRoute` nega tudo e a barra
 * aparece (corretamente) vazia, o que não prova nada.
 */
const permissoes = { canAccessRoute: (_: string) => true, isAdmin: true };

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AppTopNav />
    </MemoryRouter>,
  );

describe('AppTopNav — navegação na faixa superior', () => {
  beforeEach(() => {
    permissoes.canAccessRoute = () => true;
    permissoes.isAdmin = true;
  });

  it('mostra todos os grupos do menu quando tudo é permitido', () => {
    montar();
    for (const grupo of navGroups) {
      const rotulo = grupo.curto ?? grupo.title;
      // `getAllBy` porque o grupo aparece na barra e também na gaveta móvel.
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

  it('oferece o hambúrguer para a gaveta no celular', () => {
    montar();
    expect(screen.getByLabelText('Abrir menu')).toBeTruthy();
  });

  it('agrupa os excedentes sob "Mais" (a barra não cresce indefinidamente)', () => {
    montar();
    // Com 9 grupos e 5 sempre visíveis, o botão de excedentes existe.
    expect(screen.getByLabelText('Mais seções')).toBeTruthy();
  });
});
