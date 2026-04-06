import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PropostaCartProvider, usePropostaCart } from '@/contexts/PropostaCartContext';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <PropostaCartProvider>{children}</PropostaCartProvider>
);

describe('PropostaCartContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('inicia sem itens pendentes', () => {
    const { result } = renderHook(() => usePropostaCart(), { wrapper });
    expect(result.current.pendingItems).toEqual([]);
    expect(result.current.hasPending).toBe(false);
  });

  it('adiciona item ao carrinho', () => {
    const { result } = renderHook(() => usePropostaCart(), { wrapper });
    
    act(() => {
      result.current.addItem({
        descricao: 'Monitor LED 24"',
        quantidade: '10',
        unidade: 'UN',
        valorUnitario: '1500.00',
        marca: 'Dell',
        modelo: 'P2422H',
        fabricante: 'Dell Technologies',
      } as any);
    });

    expect(result.current.pendingItems).toHaveLength(1);
    expect(result.current.hasPending).toBe(true);
    expect(result.current.pendingItems[0].descricao).toBe('Monitor LED 24"');
  });

  it('limpa itens pendentes', () => {
    const { result } = renderHook(() => usePropostaCart(), { wrapper });

    act(() => {
      result.current.addItem({ descricao: 'Item 1' } as any);
      result.current.addItem({ descricao: 'Item 2' } as any);
    });

    expect(result.current.pendingItems).toHaveLength(2);

    act(() => {
      result.current.clearPending();
    });

    expect(result.current.pendingItems).toEqual([]);
    expect(result.current.hasPending).toBe(false);
  });

  it('persiste itens no localStorage', () => {
    const { result } = renderHook(() => usePropostaCart(), { wrapper });

    act(() => {
      result.current.addItem({ descricao: 'Persistido' } as any);
    });

    const stored = JSON.parse(localStorage.getItem('proposta_cart_items') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].descricao).toBe('Persistido');
  });

  it('restaura itens do localStorage', () => {
    localStorage.setItem('proposta_cart_items', JSON.stringify([
      { descricao: 'Restaurado', quantidade: '5', unidade: 'CX' },
    ]));

    const { result } = renderHook(() => usePropostaCart(), { wrapper });
    expect(result.current.pendingItems).toHaveLength(1);
    expect(result.current.pendingItems[0].descricao).toBe('Restaurado');
  });
});
