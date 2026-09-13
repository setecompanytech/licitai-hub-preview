import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useSalvarMeta } from './useMetasComercial';

/**
 * A meta de NF-e quitada precisa CHEGAR ao banco.
 *
 * O defeito que este arquivo trava: `useSalvarMeta` aceitava `meta_quitacao`
 * na assinatura, o diálogo mandava o valor digitado, o toast dizia "Meta
 * salva" — e o campo ficava de fora do payload do upsert. A coluna continuava
 * NULL, a terceira ponta do painel (lida de `meta.meta_quitacao`) não
 * aparecia, e nada na tela indicava que o valor tinha se perdido. Falha
 * silenciosa é exatamente o que o princípio 3 do projeto proíbe.
 *
 * Um teste de assinatura de função não pegaria isso: o tipo estava certo. O
 * que prova a gravação é inspecionar o objeto que vai para o `upsert`.
 */

const upsert = vi.fn((_payload: Record<string, unknown>, _opcoes?: { onConflict: string }) =>
  Promise.resolve({ error: null }));
const from = vi.fn((_tabela: string) => ({ upsert }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => from(tabela),
    channel: () => ({ on: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }) }),
    removeChannel: () => {},
  },
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'empresa-1' }, empresas: [], loading: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));


function envolver({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

/** Dispara a mutação e devolve o objeto que foi parar no `upsert`. */
async function salvar(entrada: Parameters<ReturnType<typeof useSalvarMeta>['mutate']>[0]) {
  const { result } = renderHook(() => useSalvarMeta(), { wrapper: envolver });
  await result.current.mutateAsync(entrada);
  await waitFor(() => expect(upsert).toHaveBeenCalled());
  return upsert.mock.calls.at(-1)![0];
}

describe('useSalvarMeta — as três pontas chegam ao banco', () => {
  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
  });

  it('grava meta_quitacao com o valor digitado (o defeito)', async () => {
    const payload = await salvar({
      user_id: 'u1',
      ano: 2026,
      mes: 9,
      meta_faturamento: 100000,
      meta_quitacao: 60000,
      meta_contratos: 4,
      meta_participacoes: 20,
      base_meta: 'faturamento',
      observacao: null,
    });

    expect(payload).toHaveProperty('meta_quitacao', 60000);
  });

  it('grava as outras duas pontas junto, sem perder nenhuma', async () => {
    const payload = await salvar({
      user_id: 'u1',
      ano: 2026,
      mes: 9,
      meta_faturamento: 100000,
      meta_quitacao: 60000,
      meta_contratos: 4,
      meta_participacoes: 20,
      base_meta: 'nf_quitada',
      observacao: 'acordado com o vendedor',
    });

    expect(payload).toMatchObject({
      empresa_id: 'empresa-1',
      user_id: 'u1',
      ano: 2026,
      mes: 9,
      meta_faturamento: 100000,
      meta_quitacao: 60000,
      meta_contratos: 4,
      meta_participacoes: 20,
      base_meta: 'nf_quitada',
      observacao: 'acordado com o vendedor',
    });
    expect(from).toHaveBeenCalledWith('comercial_metas');
  });

  /**
   * NULL e zero não são a mesma coisa nesta coluna: NULL é "ninguém definiu
   * esta ponta" (e o painel não a desenha), zero seria um alvo de R$ 0,00.
   */
  it('sem meta de quitação, grava NULL — não zero', async () => {
    const payload = await salvar({
      user_id: 'u1',
      ano: 2026,
      mes: 9,
      meta_faturamento: 100000,
      base_meta: 'faturamento',
    });

    expect(payload).toHaveProperty('meta_quitacao', null);
    expect(payload.meta_quitacao).not.toBe(0);
  });

  it('mantém a chave de conflito do upsert — editar a meta do mês não cria outra', async () => {
    const { result } = renderHook(() => useSalvarMeta(), { wrapper: envolver });
    await result.current.mutateAsync({
      user_id: 'u1', ano: 2026, mes: 9, meta_faturamento: 1, meta_quitacao: 2,
    });
    await waitFor(() => expect(upsert).toHaveBeenCalled());

    expect(upsert.mock.calls.at(-1)![1]).toEqual({ onConflict: 'empresa_id,user_id,ano,mes' });
  });
});
