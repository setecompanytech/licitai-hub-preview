import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinHomeHub from './FinHomeHub';
import { navGroups } from '@/lib/navegacao/menu';

/**
 * O menu lista as cinco pastas do Financeiro, e a estante as abre.
 *
 * São dois arquivos que precisam concordar: `menu.ts` promete um endereço
 * (`/financeiro?pasta=bancos`) e `FinHomeHub` decide o que fazer com ele. Se
 * um dos dois mudar sozinho, o menu leva para a estante fechada e a pessoa
 * nunca descobre por quê — clicou em "Bancos & Conciliação" e caiu na home.
 */
vi.mock('@/hooks/useFinanceiro', () => ({
  useResumoVisorFinanceiro: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('./FinConferencia', () => ({ default: () => null }));

const montar = (url = '/financeiro') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FinHomeHub onNavigate={vi.fn()} />
    </MemoryRouter>,
  );

const itensDoFinanceiro = () =>
  navGroups.find((g) => g.title === 'Financeiro')?.items ?? [];

describe('as cinco pastas do Financeiro, do menu à estante', () => {
  it('o menu lista as cinco, com os nomes que a estante usa', () => {
    const rotulos = itensDoFinanceiro().map((i) => i.label);
    expect(rotulos).toEqual([
      'Operação Diária',
      'Bancos & Conciliação',
      'Fiscal & Documentos',
      'Análises & Relatórios',
      'Cadastros & Configuração',
    ]);
  });

  it('cada item do menu abre a pasta que promete', () => {
    for (const item of itensDoFinanceiro()) {
      const { unmount } = montar(item.path);
      // Dentro da pasta aberta existe o caminho de volta; na estante, não.
      expect(
        screen.getByText('Voltar às pastas'),
        `"${item.label}" (${item.path}) não abriu nenhuma pasta`,
      ).toBeTruthy();
      unmount();
    }
  });

  it('sem `?pasta=`, a estante abre fechada', () => {
    montar('/financeiro');
    expect(screen.queryByText('Voltar às pastas')).toBeNull();
    expect(screen.getByText('Bancos & Conciliação')).toBeTruthy();
  });

  it('a pasta aberta mora na URL, e voltar às pastas a tira de lá', () => {
    montar('/financeiro?pasta=bancos');
    expect(screen.getByText('Voltar às pastas')).toBeTruthy();
    fireEvent.click(screen.getByText('Voltar às pastas'));
    expect(screen.queryByText('Voltar às pastas')).toBeNull();
  });
});
