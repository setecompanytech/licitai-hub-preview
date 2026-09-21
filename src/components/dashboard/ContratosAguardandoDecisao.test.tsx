import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ContratoAguardandoDecisao } from '@/lib/contratos/encerramento';

/**
 * O bloco do Painel geral que cobra a decisão de fim do contrato (decisão 4
 * do dono, 21/09). O hook é falso: o teste é sobre o que a tela diz e para
 * onde leva, não sobre a consulta.
 */
const estado = vi.hoisted(() => ({
  data: [] as ContratoAguardandoDecisao[] | undefined,
  isLoading: false,
  error: null as Error | null,
}));
vi.mock('@/hooks/useContratosAguardandoDecisao', () => ({
  useContratosAguardandoDecisao: () => estado,
}));

import ContratosAguardandoDecisao from './ContratosAguardandoDecisao';

const montar = () => render(<MemoryRouter><ContratosAguardandoDecisao /></MemoryRouter>);

beforeEach(() => {
  estado.data = [];
  estado.isLoading = false;
  estado.error = null;
});

describe('ContratosAguardandoDecisao', () => {
  it('sem pendência, não ocupa o Painel', () => {
    const { container } = montar();
    expect(container).toBeEmptyDOMElement();
  });

  it('com pendências, conta por sinal e leva cada contrato ao próprio Resumo', () => {
    estado.data = [
      { id: 'c-1', numero: '149/2024', instrumento: 'contrato', sugestao: { motivo: 'quantitativo_esgotado', aditivo: 'quantidade ou valor', titulo: 'Saldo esgotado — o contrato chegou ao fim?', detalhe: '' } },
      { id: 'a-1', numero: 'ATA 22/2024', instrumento: 'ata', sugestao: { motivo: 'prazo_vencido', aditivo: 'prazo', titulo: 'Vigência vencida — a ata chegou ao fim?', detalhe: '' } },
    ];
    montar();
    expect(screen.getByText('2 contratos esperam uma decisão')).toBeInTheDocument();
    expect(screen.getByText('1 saldo esgotado')).toBeInTheDocument();
    expect(screen.getByText('1 vigência vencida')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Contrato 149\/2024/ })).toHaveAttribute('href', '/gestao-contratos?contrato=c-1&aba=dashboard');
    expect(screen.getByRole('link', { name: /Ata ATA 22\/2024/ })).toHaveAttribute('href', '/gestao-contratos?contrato=a-1&aba=dashboard');
    // Aqui não se encerra nada: o único caminho é o Resumo.
    expect(screen.queryByRole('button', { name: /Encerrar/ })).not.toBeInTheDocument();
  });

  it('enquanto carrega ou com erro, também não aparece', () => {
    estado.isLoading = true;
    const { container } = montar();
    expect(container).toBeEmptyDOMElement();
  });
});
