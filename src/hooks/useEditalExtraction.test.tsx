import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * Opção 3 de 17/09: os itens extraídos são LIDOS pela empresa inteira e
 * SUBSTITUÍDOS só por quem os extraiu ou pelo administrador.
 *
 * O que se trava aqui:
 *  1. a leitura deixou de filtrar por usuário — o RLS decide;
 *  2. apagar confere o que sobrou: o RLS filtra o DELETE em silêncio, e
 *     `deleteAllItens` precisa devolver `false` (com aviso) quando os itens
 *     ficaram, senão a re-extração do colega grava por cima e duplica.
 */

const estado = vi.hoisted(() => ({
  chamadas: [] as { tabela: string; metodo: string; args: unknown[] }[],
  respostas: {} as Record<string, { data?: unknown; error?: unknown; count?: number | null }>,
  aviso: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      let operacao = 'select';
      const q: Record<string, unknown> = {};
      for (const metodo of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
        q[metodo] = (...args: unknown[]) => {
          estado.chamadas.push({ tabela, metodo, args });
          return q;
        };
      }
      for (const metodo of ['insert', 'update', 'delete']) {
        q[metodo] = (...args: unknown[]) => {
          operacao = metodo;
          estado.chamadas.push({ tabela, metodo, args });
          return q;
        };
      }
      q.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null, count: null, ...(estado.respostas[`${tabela}:${operacao}`] ?? {}) }).then(ok, falha);
      return q;
    },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: (...a: unknown[]) => estado.aviso(...a) },
}));

import { useEditalExtraction } from './useEditalExtraction';

const montar = () => renderHook(() => useEditalExtraction()).result.current;

/** As chamadas de uma tabela, na ordem, como "metodo(arg0)". */
const trilha = (tabela: string) =>
  estado.chamadas.filter((c) => c.tabela === tabela).map((c) => `${c.metodo}(${String(c.args[0] ?? '')})`);

beforeEach(() => {
  estado.chamadas = [];
  estado.respostas = {};
  estado.aviso.mockReset();
});

describe('fetchItens', () => {
  it('lê os itens do processo sem filtrar por usuário — o RLS decide quem vê', async () => {
    estado.respostas['licitacao_itens:select'] = { data: [] };
    estado.respostas['licitacoes:select'] = { data: { objeto: 'Colchões hospitalares' } };
    const { fetchItens } = montar();

    await fetchItens('lic-1');

    const itens = trilha('licitacao_itens');
    expect(itens).toContain('eq(licitacao_id)');
    expect(itens).not.toContain('eq(user_id)');
  });
});

describe('deleteAllItens', () => {
  it('apaga pelo processo e devolve true quando não sobrou nada', async () => {
    estado.respostas['licitacao_itens:select'] = { count: 0 };
    const { deleteAllItens } = montar();

    expect(await deleteAllItens('lic-1')).toBe(true);
    expect(trilha('licitacao_itens')).not.toContain('eq(user_id)');
    expect(estado.aviso).not.toHaveBeenCalled();
  });

  it('itens de outra pessoa ficam: devolve false e avisa, para ninguém gravar por cima', async () => {
    // O DELETE "dá certo" (o RLS só não apaga o que não é da pessoa) e a
    // contagem seguinte mostra que os itens continuam lá.
    estado.respostas['licitacao_itens:select'] = { count: 12 };
    const { deleteAllItens } = montar();

    expect(await deleteAllItens('lic-1')).toBe(false);
    expect(estado.aviso).toHaveBeenCalledWith(expect.stringContaining('outra pessoa da empresa'));
  });

  it('erro real do banco não vira "apaguei"', async () => {
    estado.respostas['licitacao_itens:delete'] = { error: { message: 'permission denied' } };
    const { deleteAllItens } = montar();

    expect(await deleteAllItens('lic-1')).toBe(false);
  });
});
