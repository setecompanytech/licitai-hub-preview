import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HistoricoDocumentos from './HistoricoDocumentos';
import { TAMANHO_DA_PAGINA, detalhesDaLinha, limitesDoDia } from '@/lib/documentos/historico';

/**
 * O histórico tem três exigências que o bloco inline do `Documentos.tsx` não
 * atendia, e cada uma vira um teste:
 *
 *  1. quem não é admin da empresa precisa ver a RECUSA, não uma tabela vazia —
 *     tabela vazia diz "não aconteceu nada", que é outra afirmação;
 *  2. os filtros precisam chegar ao BANCO: filtrar no cliente sobre a primeira
 *     página esconderia o que está na segunda;
 *  3. a tela precisa RECARREGAR. O bloco antigo tinha
 *     `if (historicoAberto || historico.length > 0 ...) return`, e o envio
 *     feito na mesma sessão nunca aparecia.
 */

/** As chamadas que chegaram ao PostgREST, para conferir o que foi filtrado. */
const chamadas = {
  select: 0,
  ilike: [] as Array<[string, string]>,
  eq: [] as Array<[string, unknown]>,
  gte: [] as Array<[string, string]>,
  lte: [] as Array<[string, string]>,
};

/** 30 registros: mais do que uma página, para exercitar o "Carregar mais". */
const TODOS = Array.from({ length: 30 }, (_, i) => ({
  id: `h${i}`,
  documento_nome: i === 0 ? 'CND Federal' : `Documento ${i}`,
  acao: i % 2 === 0 ? 'enviado' : 'validade alterada',
  autor: i === 0 ? 'user-1' : null,
  validade_anterior: i === 1 ? '2026-01-10' : null,
  validade_nova: i === 1 ? '2026-07-10' : null,
  arquivo_anterior: null,
  arquivo_novo: i === 0 ? 'empresa-1/cnd-federal.pdf' : null,
  criado_em: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`,
}));

let isCompanyAdmin = true;
let autorizacaoCarregando = false;

function builder() {
  let inicio = 0;
  let fim = TAMANHO_DA_PAGINA;
  let filtroTexto: string | null = null;
  let filtroAcao: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: vi.fn(() => {
      chamadas.select++;
      return b;
    }),
    order: vi.fn(() => b),
    eq: vi.fn((coluna: string, valor: unknown) => {
      chamadas.eq.push([coluna, valor]);
      if (coluna === 'acao') filtroAcao = String(valor);
      return b;
    }),
    ilike: vi.fn((coluna: string, valor: string) => {
      chamadas.ilike.push([coluna, valor]);
      filtroTexto = valor.replace(/%/g, '').toLowerCase();
      return b;
    }),
    gte: vi.fn((coluna: string, valor: string) => {
      chamadas.gte.push([coluna, valor]);
      return b;
    }),
    lte: vi.fn((coluna: string, valor: string) => {
      chamadas.lte.push([coluna, valor]);
      return b;
    }),
    range: vi.fn((de: number, ate: number) => {
      inicio = de;
      fim = ate;
      return b;
    }),
  };
  b.then = (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => {
    let dados = TODOS;
    if (filtroTexto) {
      dados = dados.filter((l) => l.documento_nome.toLowerCase().includes(filtroTexto!));
    }
    if (filtroAcao) dados = dados.filter((l) => l.acao === filtroAcao);
    return Promise.resolve({ data: dados.slice(inicio, fim + 1), error: null }).then(ok, falha);
  };
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => builder()) },
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'empresa-1' } }),
}));

vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => ({
    loading: autorizacaoCarregando,
    isCompanyAdmin,
    isSystemAdmin: false,
    isAdmin: isCompanyAdmin,
    setor: null,
    can: () => true,
    canAccessRoute: () => true,
    canAccessByPlan: () => true,
    isAllowed: () => true,
  }),
}));

vi.mock('@/hooks/useMetasComercial', () => ({
  useColaboradores: () => ({
    data: [{ user_id: 'user-1', nome: 'Ana Ribeiro', email: 'ana@empresa.com' }],
  }),
}));

beforeEach(() => {
  chamadas.select = 0;
  chamadas.ilike.length = 0;
  chamadas.eq.length = 0;
  chamadas.gte.length = 0;
  chamadas.lte.length = 0;
  isCompanyAdmin = true;
  autorizacaoCarregando = false;
});

const esperarTabela = () => waitFor(() => expect(screen.getByText('CND Federal')).toBeTruthy());

describe('restrição administrativa', () => {
  it('quem não é admin da empresa vê "acesso não autorizado", não uma tabela vazia', async () => {
    isCompanyAdmin = false;
    render(<HistoricoDocumentos />);

    expect(screen.getByText('Acesso não autorizado')).toBeTruthy();
    // Tabela vazia seria uma afirmação FALSA sobre o conteúdo da trilha.
    expect(screen.queryByText('Nenhum registro ainda')).toBeNull();
    expect(screen.queryByText('CND Federal')).toBeNull();
    // E a tela diz que a autorização é do banco, não da aba escondida.
    expect(screen.getByText(/RLS/)).toBeTruthy();
    // Nada é consultado: a checagem da UI evita até a ida ao banco.
    expect(chamadas.select).toBe(0);
  });

  it('admin da empresa vê a trilha, com o autor resolvido pelo nome', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();
    expect(screen.getByText('Ana Ribeiro')).toBeTruthy();
    // `autor` NULL é escrita sem sessão — "sistema", nunca um nome inventado.
    expect(screen.getAllByText('sistema').length).toBeGreaterThan(0);
  });
});

describe('filtros', () => {
  it('a busca por documento vai ao banco como ilike, não filtra o array local', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();
    expect(screen.getByText('Documento 1')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/buscar por documento/i), {
      target: { value: 'CND' },
    });

    await waitFor(
      () => expect(chamadas.ilike).toContainEqual(['documento_nome', '%CND%']),
      { timeout: 2000 },
    );
    await waitFor(() => expect(screen.queryByText('Documento 1')).toBeNull());
    expect(screen.getByText('CND Federal')).toBeTruthy();
  });

  it('o período vira gte/lte sobre criado_em', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-09-01' } });
    await waitFor(() => expect(chamadas.gte.length).toBeGreaterThan(0));
    expect(chamadas.gte[0][0]).toBe('criado_em');

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-09-30' } });
    await waitFor(() => expect(chamadas.lte.length).toBeGreaterThan(0));
    expect(chamadas.lte[0][0]).toBe('criado_em');
  });

  it('sem resultado com filtro aplicado, diz que é o filtro — não que a trilha está vazia', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();

    fireEvent.change(screen.getByPlaceholderText(/buscar por documento/i), {
      target: { value: 'inexistente-zzz' },
    });

    await waitFor(
      () => expect(screen.getByText('Nenhum registro com esses filtros')).toBeTruthy(),
      { timeout: 2000 },
    );
  });

  it('limpar filtros devolve a lista inteira', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();

    fireEvent.change(screen.getByPlaceholderText(/buscar por documento/i), {
      target: { value: 'CND' },
    });
    await waitFor(() => expect(screen.queryByText('Documento 1')).toBeNull(), { timeout: 2000 });

    fireEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    await waitFor(() => expect(screen.getByText('Documento 1')).toBeTruthy(), { timeout: 2000 });
  });
});

describe('recarga e paginação', () => {
  it('consulta na montagem — o bloco antigo carregava uma vez e congelava', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();
    expect(chamadas.select).toBeGreaterThan(0);
  });

  it('"Atualizar" faz uma consulta nova', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();
    const antes = chamadas.select;

    fireEvent.click(screen.getByRole('button', { name: /atualizar/i }));
    await waitFor(() => expect(chamadas.select).toBeGreaterThan(antes));
  });

  it('pagina em vez de cortar em silêncio', async () => {
    render(<HistoricoDocumentos />);
    await esperarTabela();

    // 30 registros, página de 25: a tela precisa dizer que há mais.
    expect(screen.getByText(/25 registros carregados — há mais/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    await waitFor(() => expect(screen.getByText(/30 registros carregados/)).toBeTruthy());
    expect(screen.queryByText(/há mais/)).toBeNull();
  });
});

describe('detalhes, sem inventar nada', () => {
  it('mostra a mudança de validade quando ela existe', () => {
    expect(
      detalhesDaLinha({
        id: 'x',
        documento_nome: 'CND',
        acao: 'validade alterada',
        autor: null,
        validade_anterior: '2026-01-10',
        validade_nova: '2026-07-10',
        arquivo_anterior: null,
        arquivo_novo: null,
        criado_em: '2026-09-01T12:00:00Z',
      }),
    ).toEqual(['validade 10/01/2026 → 10/07/2026']);
  });

  it('não produz detalhe quando as colunas do gatilho nada trazem', () => {
    expect(
      detalhesDaLinha({
        id: 'x',
        documento_nome: 'CND',
        acao: 'editado',
        autor: null,
        validade_anterior: null,
        validade_nova: null,
        arquivo_anterior: 'p/a.pdf',
        arquivo_novo: 'p/a.pdf',
        criado_em: '2026-09-01T12:00:00Z',
      }),
    ).toEqual([]);
  });

  it('o filtro de data usa o dia LOCAL de quem lê, não o dia UTC', () => {
    const inicio = limitesDoDia('2026-09-13');
    const fim = limitesDoDia('2026-09-13', true);
    expect(inicio).toBe(new Date(2026, 8, 13, 0, 0, 0, 0).toISOString());
    expect(fim).toBe(new Date(2026, 8, 13, 23, 59, 59, 999).toISOString());
    expect(limitesDoDia('')).toBeNull();
  });
});
