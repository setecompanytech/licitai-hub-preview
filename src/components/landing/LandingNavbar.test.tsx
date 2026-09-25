import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingNavbar, { ITENS_DO_MENU } from './LandingNavbar';

/**
 * O cabeçalho das páginas públicas era transparente com texto branco até a
 * primeira rolagem — invisível na /contato, que abre em fundo claro (25/09).
 */
describe('LandingNavbar', () => {
  const montar = () => render(<MemoryRouter initialEntries={['/contato']}><LandingNavbar /></MemoryRouter>);

  it('nasce sólido, sem depender de rolagem', () => {
    montar();
    const nav = screen.getByTestId('landing-navbar');
    expect(nav.className).toContain('bg-background/95');
    expect(nav.className).not.toContain('bg-transparent');
    expect(nav.innerHTML).not.toContain('text-white');
  });

  it('o menu leva a páginas e âncoras que existem', () => {
    montar();
    for (const item of ITENS_DO_MENU) {
      const link = screen.getAllByRole('link', { name: item.label })[0];
      expect(link).toHaveAttribute('href', 'to' in item ? item.to : item.href);
    }
    expect(screen.queryByRole('link', { name: 'Planos' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Segmentos' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Conta' })).toBeInTheDocument();
  });
});
