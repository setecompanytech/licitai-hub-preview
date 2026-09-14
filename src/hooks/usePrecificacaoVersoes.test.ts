import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * As versões da precificação são o que vira limite do robô. O que estes casos
 * prendem é o que um erro custaria:
 *
 *  - tabela ausente (migration não aplicada) tratada como "nenhuma versão" —
 *    a pessoa refaria a precificação achando que ela sumiu;
 *  - versão nova gravada com número repetido, ou por cima da revisão de outra
 *    pessoa, em silêncio;
 *  - percentual de política preenchido por padrão;
 *  - `valor_unitario` do processo lido como estimativa do órgão quando é o
 *    nosso próprio preço.
 */

// ── Dublês ────────────────────────────────────────────────────────────────

type Resposta = { data: unknown; error: unknown };
type Operacao = 'select' | 'insert' | 'update' | 'delete';
interface Chamada {
  tabela: string;
  operacao: Operacao;
  payload?: unknown;
  filtros: unknown[][];
}

const respostas: Record<string, Resposta | ((c: Chamada) => Resposta)> = {};
const chamadas: Chamada[] = [];
const rpc = vi.fn();

/** Consulta encadeável e "thenable"; a resposta sai por `tabela:operação`. */
const criarQuery = (tabela: string) => {
  const chamada: Chamada = { tabela, operacao: 'select', filtros: [] };
  chamadas.push(chamada);
  const resolver = () => {
    const r = respostas[`${tabela}:${chamada.operacao}`] ?? respostas[tabela];
    return Promise.resolve((typeof r === 'function' ? r(chamada) : r) ?? { data: null, error: null });
  };
  const q: Record<string, unknown> = {};
  for (const metodo of ['select', 'order', 'limit', 'maybeSingle', 'single']) q[metodo] = () => q;
  for (const metodo of ['eq', 'in']) {
    q[metodo] = (...args: unknown[]) => {
      chamada.filtros.push([metodo, ...args]);
      return q;
    };
  }
  for (const metodo of ['insert', 'update', 'delete'] as Operacao[]) {
    q[metodo] = (payload?: unknown) => {
      chamada.operacao = metodo;
      chamada.payload = payload;
      return q;
    };
  }
  q.then = (ok: unknown, falha: unknown) => resolver().then(ok as never, falha as never);
  return q;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => criarQuery(tabela),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => {
  // Mesma referência a cada render: `user` entra nas dependências das ações.
  const auth = { user: { id: 'user-1' } };
  return { useAuth: () => auth };
});

import {
  estimadoDoOrgao,
  premissasIniciais,
  usePrecificacaoVersoes,
} from './usePrecificacaoVersoes';
import type { ItemDePrecificacao, PremissasDaVersao } from '@/lib/precificacao/versao';

// ── Dados ─────────────────────────────────────────────────────────────────

const informado = { fonte: 'informado_pelo_usuario' as const };
const PREMISSAS: PremissasDaVersao = {
  camadas: { pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3, pctMargem: 15 },
  origem: { pctImpostos: informado, pctDespesasAdmin: informado, pctDespesasOperacionais: informado, pctMargem: informado },
  criterio: 'menor_preco_item',
};

const ITEM: ItemDePrecificacao = {
  licitacaoItemId: 'it-1',
  numero: 1,
  lote: null,
  descricao: 'Item de teste',
  quantidade: 10,
  unidade: 'UN',
  custoUnitario: 100,
  limite: 150,
};

const versao = (over: Record<string, unknown>) => ({
  id: 'v-x',
  empresa_id: 'emp-1',
  licitacao_id: 'lic-1',
  numero: 1,
  situacao: 'rascunho',
  criterio_disputa: 'menor_preco_item',
  premissas: PREMISSAS,
  documentos_usados: [],
  total_inicial_centavos: null,
  criado_por: 'user-1',
  submetida_por: null,
  submetida_em: null,
  aprovada_por: null,
  aprovada_em: null,
  substituida_por_versao_id: null,
  created_at: '2026-09-14T12:00:00.000000+00:00',
  updated_at: '2026-09-14T12:00:00.000000+00:00',
  itens: [],
  ...over,
});

const montar = () =>
  renderHook(() => usePrecificacaoVersoes({ licitacaoId: 'lic-1', empresaId: 'emp-1' }));

beforeEach(() => {
  for (const k of Object.keys(respostas)) delete respostas[k];
  chamadas.length = 0;
  rpc.mockReset();
  respostas['licitacao_itens:select'] = { data: [], error: null };
  respostas['financeiro_indicadores_adotados:select'] = { data: null, error: null };
  respostas['profiles:select'] = { data: [], error: null };
});

// ── Casos ─────────────────────────────────────────────────────────────────

describe('migration de 14/09 ainda não aplicada', () => {
  it('tabela ausente vira estado explícito, não lista vazia nem erro genérico', async () => {
    respostas['precificacao_versoes:select'] = {
      data: null,
      error: { code: 'PGRST205', message: "Could not find the table 'public.precificacao_versoes' in the schema cache" },
    };
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.migracaoPendente).toBe(true);
    expect(result.current.erro).toBeNull();
  });
});

describe('salvar revisão', () => {
  it('sem rascunho em curso, cria a versão seguinte (maior número + 1) como rascunho', async () => {
    respostas['precificacao_versoes:select'] = {
      data: [
        versao({ id: 'v-3', numero: 3, situacao: 'aprovada', aprovada_por: 'user-2', aprovada_em: '2026-09-13T15:00:00Z' }),
        versao({ id: 'v-2', numero: 2, situacao: 'substituida' }),
      ],
      error: null,
    };
    respostas['precificacao_versoes:insert'] = { data: { id: 'v-4' }, error: null };
    respostas['precificacao_versao_itens:insert'] = { data: null, error: null };

    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.vigente?.numero).toBe(3);
    expect(result.current.rascunhoAtual).toBeNull();

    let r: Awaited<ReturnType<typeof result.current.salvarRevisao>>;
    await act(async () => {
      r = await result.current.salvarRevisao(PREMISSAS, [ITEM]);
    });
    expect(r.ok).toBe(true);

    const cabecalho = chamadas.find((c) => c.tabela === 'precificacao_versoes' && c.operacao === 'insert');
    expect(cabecalho?.payload).toMatchObject({
      numero: 4,
      situacao: 'rascunho',
      empresa_id: 'emp-1',
      licitacao_id: 'lic-1',
      criterio_disputa: 'menor_preco_item',
      documentos_usados: [],
      // 100 ÷ (1 − 0,44) = 178,57 × 10
      total_inicial_centavos: 178_570,
    });

    const itens = chamadas.find((c) => c.tabela === 'precificacao_versao_itens' && c.operacao === 'insert');
    const [linha] = itens?.payload as Record<string, unknown>[];
    expect(linha).toMatchObject({
      versao_id: 'v-4',
      licitacao_item_id: 'it-1',
      preco_sugerido_centavos: 17_857,
      preco_inicial_centavos: 17_857,
      limite_centavos: 15_000,
      autorizado: true,
    });
    expect((linha.memoria as { rotulo: string }[]).map((m) => m.rotulo)).toContain('Margem sobre a venda');
  });

  it('número já usado por outra pessoa vira conflito declarado', async () => {
    respostas['precificacao_versoes:select'] = { data: [], error: null };
    respostas['precificacao_versoes:insert'] = {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    };
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));

    let r: Awaited<ReturnType<typeof result.current.salvarRevisao>>;
    await act(async () => {
      r = await result.current.salvarRevisao(PREMISSAS, [ITEM]);
    });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/Outra revisão foi salva por outra pessoa/);
    expect(result.current.conflito).toMatch(/recarregue antes de salvar/);
    expect(chamadas.some((c) => c.tabela === 'precificacao_versao_itens' && c.operacao === 'insert')).toBe(false);
  });

  it('rascunho em curso é atualizado no lugar, com trava pela última gravação', async () => {
    const rascunho = versao({ id: 'v-5', numero: 5, updated_at: '2026-09-14T13:00:00.123456+00:00' });
    respostas['precificacao_versoes:select'] = { data: [rascunho], error: null };
    respostas['precificacao_versoes:update'] = { data: [{ id: 'v-5' }], error: null };
    respostas['precificacao_versao_itens:delete'] = { data: null, error: null };
    respostas['precificacao_versao_itens:insert'] = { data: null, error: null };

    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => {
      await result.current.salvarRevisao(PREMISSAS, [ITEM]);
    });

    const atualizacao = chamadas.find((c) => c.tabela === 'precificacao_versoes' && c.operacao === 'update');
    expect(atualizacao?.filtros).toEqual(
      expect.arrayContaining([
        ['eq', 'id', 'v-5'],
        ['eq', 'situacao', 'rascunho'],
        ['eq', 'updated_at', '2026-09-14T13:00:00.123456+00:00'],
      ]),
    );
    expect(chamadas.some((c) => c.tabela === 'precificacao_versoes' && c.operacao === 'insert')).toBe(false);
  });

  it('revisão gravada por outra pessoa no meio tempo: nenhuma linha atualizada é conflito', async () => {
    respostas['precificacao_versoes:select'] = { data: [versao({ id: 'v-5', numero: 5 })], error: null };
    respostas['precificacao_versoes:update'] = { data: [], error: null };
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));

    let r: Awaited<ReturnType<typeof result.current.salvarRevisao>>;
    await act(async () => {
      r = await result.current.salvarRevisao(PREMISSAS, [ITEM]);
    });
    expect(r.ok).toBe(false);
    expect(result.current.conflito).toMatch(/Outra revisão/);
    expect(chamadas.some((c) => c.tabela === 'precificacao_versao_itens')).toBe(false);
  });
});

describe('aprovar', () => {
  it('chama a função do banco e devolve a mensagem do servidor sem reescrever', async () => {
    respostas['precificacao_versoes:select'] = { data: [versao({ id: 'v-1' })], error: null };
    rpc.mockResolvedValue({ data: null, error: { message: 'Aprovar limites exige administrador da empresa.' } });
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));

    let r: Awaited<ReturnType<typeof result.current.aprovar>>;
    await act(async () => {
      r = await result.current.aprovar('v-1');
    });
    expect(rpc).toHaveBeenCalledWith('aprovar_precificacao_versao', { p_versao_id: 'v-1' });
    expect(r.erro).toBe('Aprovar limites exige administrador da empresa.');
  });
});

describe('premissas de partida — nunca inventadas', () => {
  it('sem indicador adotado, as quatro camadas e o critério começam pendentes', () => {
    const p = premissasIniciais(null);
    expect(Object.values(p.origem).every((o) => o.fonte === 'nao_configurado')).toBe(true);
    expect(p.camadas.pctMargem).toBeNull();
    expect(p.criterio).toBe('nao_informado');
  });

  it('despesa administrativa vem do indicador adotado, com referência e período', () => {
    const p = premissasIniciais({
      id: 'ind-9',
      pctDespesaAdministrativa: 7.2,
      referencia: '2026-08-31',
      meses: 12,
      periodo: '12 meses até 08/2026',
      adotadoEm: '2026-09-01T10:00:00Z',
    });
    expect(p.camadas.pctDespesasAdmin).toBe(7.2);
    expect(p.origem.pctDespesasAdmin).toEqual({
      fonte: 'indicadores_financeiro',
      referencia: 'ind-9',
      periodo: '12 meses até 08/2026',
    });
    expect(p.origem.pctImpostos.fonte).toBe('nao_configurado');
    expect(p.origem.pctMargem.fonte).toBe('nao_configurado');
  });

  it('indicador lido do banco chega com o período por extenso', async () => {
    respostas['precificacao_versoes:select'] = { data: [], error: null };
    respostas['financeiro_indicadores_adotados:select'] = {
      data: { id: 'ind-1', referencia: '2026-08-31', meses: 12, pct_despesa_administrativa: 6.5, adotado_em: '2026-09-01' },
      error: null,
    };
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.indicador).toMatchObject({ id: 'ind-1', pctDespesaAdministrativa: 6.5, periodo: '12 meses até 08/2026' });
  });
});

describe('estimativa do órgão', () => {
  it('só quando a origem do item é o PNCP, que grava valorUnitarioEstimado', () => {
    expect(estimadoDoOrgao('auto:PNCP_ITENS', 12.5)).toBe(12.5);
    expect(estimadoDoOrgao('espelho:PNCP_ITENS', '8')).toBe(8);
    expect(estimadoDoOrgao('manual', 12.5)).toBeNull();
    expect(estimadoDoOrgao(null, 12.5)).toBeNull();
    expect(estimadoDoOrgao('auto:PNCP_ITENS', 0)).toBeNull();
  });
});
