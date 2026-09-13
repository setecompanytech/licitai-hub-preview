import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinHomeHub, { HUB_ITEMS } from './FinHomeHub';

/**
 * O hub do Financeiro virou estante de pastas em 13/09: eram 40+ módulos
 * empilhados por categoria numa página que rolava sem fim. Estes casos
 * travam o comportamento da estante — e existem porque a captura
 * automatizada não chega aqui: a tela exige empresa ativa, que a conta de
 * teste não tem, e para antes do hub.
 */
vi.mock('@/hooks/useFinanceiro', () => ({
  useResumoVisorFinanceiro: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('./FinConferencia', () => ({ default: () => null }));

const montar = () => render(<FinHomeHub onNavigate={vi.fn()} />);

describe('FinHomeHub — estante de pastas', () => {
  it('abre com as pastas fechadas, uma por categoria mais os recentes', () => {
    montar();
    for (const nome of [
      'Acessados recentemente',
      'Operação Diária',
      'Bancos & Conciliação',
      'Fiscal & Documentos',
      'Análises & Relatórios',
      'Cadastros & Configuração',
    ]) {
      expect(screen.getByText(nome)).toBeTruthy();
    }
  });

  it('não despeja os módulos na tela antes de a pasta ser aberta', () => {
    montar();
    // "Lançamentos" é módulo de dentro de Operação Diária.
    expect(screen.queryByText('Lançamentos')).toBeNull();
  });

  it('abre a pasta e mostra só o que está dentro dela', () => {
    montar();
    fireEvent.click(screen.getByText('Bancos & Conciliação'));
    const daPasta = HUB_ITEMS.filter((i) => i.group === 'bancos');
    for (const item of daPasta) expect(screen.getAllByText(item.label).length).toBeGreaterThan(0);
    // Módulo de outra pasta continua fora de vista.
    expect(screen.queryByText('Emissor de NF-e')).toBeNull();
  });

  it('volta para a estante', () => {
    montar();
    fireEvent.click(screen.getByText('Operação Diária'));
    fireEvent.click(screen.getByText('Voltar às pastas'));
    expect(screen.getByText('Fiscal & Documentos')).toBeTruthy();
  });

  it('a busca passa por cima das pastas — quem digita já sabe o que quer', () => {
    montar();
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'concilia' } });
    expect(screen.getByText(/Resultados para/)).toBeTruthy();
  });
});
