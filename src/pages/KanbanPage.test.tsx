import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import KanbanPage from './KanbanPage';

/**
 * O quadro foi reestruturado em 13/09: colunas de 260px com rolagem local em
 * vez de oito colunas espremidas, cartão com responsável e pendências, seletor
 * de etapa no celular e erro de carga tratado. Quatro contratos não podem cair
 * junto com a mudança de composição, e nenhum deles aparece em captura de tela
 * — a rota exige sessão e empresa ativa:
 *
 *  1. as oito colunas existem, com os títulos EXATOS (inclusive as três
 *     divergências entre o status gravado e o rótulo lido);
 *  2. mover para "Perdida" NÃO grava status: abre o diálogo de perda, porque o
 *     trigger do banco recusa a mudança sem registro em `comercial_perdas`;
 *  3. há alternativa ao arrasto — o comando exige oferecer uma;
 *  4. em tela estreita existe SELETOR DE ETAPA, não o quadro em miniatura.
 */

const { estado } = vi.hoisted(() => ({
  estado: {
    licitacoes: [] as Record<string, unknown>[],
    erroLicitacoes: null as { message: string } | null,
    perfis: [] as Record<string, unknown>[],
    atualizarStatus: vi.fn(),
    registrarPerda: vi.fn(),
    arquivarProcesso: vi.fn(),
    // Referências ESTÁVEIS: `carregar` depende de `user` e `empresaAtiva`, e um
    // objeto novo a cada render recarregaria o quadro em laço infinito.
    sessao: { user: { id: 'u1' } },
    empresa: { empresaAtiva: { id: 'e1', nome: 'ACME' } },
    integracao: {} as Record<string, unknown>,
  },
}));

/**
 * Consulta encadeada do supabase-js: cada método devolve a própria consulta e o
 * objeto é "thenable", então tanto `await q.order(...)` quanto `await q.in(...)`
 * resolvem no resultado da tabela.
 */
vi.mock('@/integrations/supabase/client', () => {
  const consulta = (resultado: unknown) => {
    const q: Record<string, unknown> = {
      then: (resolver: (v: unknown) => unknown) => Promise.resolve(resolver(resultado)),
    };
    for (const metodo of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) {
      q[metodo] = () => q;
    }
    return q;
  };
  return {
    supabase: {
      from: (tabela: string) =>
        tabela === 'profiles'
          ? consulta({ data: estado.perfis, error: null })
          : consulta({ data: estado.erroLicitacoes ? null : estado.licitacoes, error: estado.erroLicitacoes }),
      channel: () => {
        const canal: Record<string, unknown> = {};
        canal.on = () => canal;
        canal.subscribe = () => canal;
        return canal;
      },
      removeChannel: () => {},
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => estado.sessao }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => estado.empresa }));
vi.mock('@/hooks/useLicitacaoIntegration', () => ({
  useLicitacaoIntegration: () => estado.integracao,
}));

// A moldura e o cabeçalho exigem os contextos da aplicação e não são o objeto
// do teste; ambos repassam os filhos, que é o que o quadro precisa.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// As outras duas abas fazem as próprias consultas ao montar.
vi.mock('@/components/gestao/CompromissosResumo', () => ({ default: () => <div /> }));
vi.mock('@/components/gestao/HistoricoExtracoes', () => ({ default: () => <div /> }));

// Os dois diálogos entram como sonda: o que se quer saber é QUANDO a tela os
// abre e com qual processo, não como eles se desenham por dentro.
vi.mock('@/components/kanban/EditLicitacaoDialog', () => ({
  default: ({ licitacao, open }: { licitacao: { numero: string } | null; open: boolean }) =>
    open && licitacao ? <div data-testid="editor">Editando {licitacao.numero}</div> : null,
}));
vi.mock('@/components/metas/RegistrarPerdaDialog', () => ({
  default: ({ alvo }: { alvo: { numero: string } | null }) =>
    alvo ? <div data-testid="dialogo-perda">Motivo da perda — {alvo.numero}</div> : null,
}));

const processo = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  numero: '033/2026',
  orgao: 'Prefeitura Municipal de Belém',
  objeto: 'Aquisição de equipamentos de informática',
  status: 'Em Disputa',
  modalidade: 'Pregão Eletrônico',
  valor_estimado: 250000,
  uf: 'PA',
  municipio: 'Belém',
  data_encerramento: '2099-10-01T13:00:00.000Z',
  arquivado_em: null,
  operador_id: 'u1',
  ...over,
});

/** Controla `useLarguraMinima(768)`: acima do piso sai o quadro, abaixo o seletor. */
const definirLargura = (cabeOQuadro: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: cabeOQuadro && query.includes('min-width: 768px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <KanbanPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** Espera a carga assíncrona pintar o quadro. */
const aguardarQuadro = async (texto: string) => {
  await waitFor(() => expect(screen.getByText(texto)).toBeTruthy());
};

beforeEach(() => {
  estado.licitacoes = [];
  estado.erroLicitacoes = null;
  estado.perfis = [];
  estado.atualizarStatus.mockReset().mockResolvedValue(undefined);
  estado.registrarPerda.mockReset().mockResolvedValue(true);
  estado.arquivarProcesso.mockReset().mockResolvedValue(true);
  estado.integracao.atualizarStatus = estado.atualizarStatus;
  estado.integracao.registrarPerda = estado.registrarPerda;
  estado.integracao.arquivarProcesso = estado.arquivarProcesso;
  definirLargura(true);
});

describe('Kanban — as oito colunas', () => {
  it('mostra as oito etapas com os títulos exatos, inclusive as três que divergem do status gravado', async () => {
    estado.licitacoes = [processo()];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    const quadro = screen.getByRole('list', { name: 'Etapas do processo' });
    // `Em Análise` aparece como "Analisando" e `Proposta Enviada` como
    // "Proposta": o que se grava e o que se lê divergem de propósito, e o
    // rótulo vem de `rotuloStatus`, a mesma autoridade do resto do app.
    const titulos = [
      'Monitorando', 'Analisando', 'Proposta', 'Em Disputa',
      'Vencida', 'Homologada', 'Perdida', 'Arquivada',
    ];
    for (const titulo of titulos) {
      expect(within(quadro).getByText(titulo)).toBeTruthy();
    }
    expect(within(quadro).getAllByRole('listitem')).toHaveLength(8);
    // Os rótulos que NÃO existem: se alguém reintroduzir o status cru no
    // cabeçalho da coluna, some a divergência deliberada.
    expect(within(quadro).queryByText('Em Análise')).toBeNull();
    expect(within(quadro).queryByText('Proposta Enviada')).toBeNull();
  });

  it('o cartão traz processo, órgão, prazo, responsável e pendências', async () => {
    estado.perfis = [{ user_id: 'u2', nome_completo: 'Ana Paula Ribeiro', username: 'ana' }];
    estado.licitacoes = [
      processo({ operador_id: 'u2' }),
      // Sem responsável e sem prazo: as duas pendências que a tela deriva de
      // regra existente, não de coluna inventada.
      processo({ id: 'p2', numero: '044/2026', operador_id: null, data_encerramento: null }),
    ];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    const quadro = screen.getByRole('list', { name: 'Etapas do processo' });
    expect(within(quadro).getByText('PE nº 33/2026')).toBeTruthy();
    expect(within(quadro).getAllByText('Prefeitura Municipal de Belém').length).toBeGreaterThan(0);
    await waitFor(() => expect(within(quadro).getByText('Ana Paula Ribeiro')).toBeTruthy());
    expect(within(quadro).getByText('Sem responsável')).toBeTruthy();
    expect(within(quadro).getByText('Sem prazo')).toBeTruthy();
  });
});

describe('Kanban — mover para Perdida', () => {
  it('não grava o status e abre o diálogo de perda', async () => {
    estado.licitacoes = [processo()];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    const cartao = screen.getByText('PE nº 33/2026').closest('[role="button"]') as HTMLElement;
    const colunaPerdida = screen.getByText('Perdida').closest('[role="listitem"]') as HTMLElement;
    // O arrasto encontra a coluna de destino por `elementFromPoint`, que o
    // jsdom não implementa — o teste entrega a coluna alvo diretamente.
    document.elementFromPoint = () => colunaPerdida;

    fireEvent.pointerDown(cartao, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 400 });
    fireEvent.pointerUp(document);

    await waitFor(() => expect(screen.getByTestId('dialogo-perda')).toBeTruthy());
    expect(screen.getByTestId('dialogo-perda').textContent).toContain('033/2026');
    // A regra inteira mora aqui: sem motivo registrado, nada é gravado.
    expect(estado.atualizarStatus).not.toHaveBeenCalled();
    expect(estado.arquivarProcesso).not.toHaveBeenCalled();
    // E o cartão continua na coluna de origem.
    const emDisputa = screen.getByText('Em Disputa').closest('[role="listitem"]') as HTMLElement;
    expect(within(emDisputa).getByText('PE nº 33/2026')).toBeTruthy();
  });
});

describe('Kanban — alternativas ao arrasto', () => {
  it('o cartão aberto oferece o menu Mover e o acesso ao processo', async () => {
    estado.licitacoes = [processo()];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    const cartao = screen.getByText('PE nº 33/2026').closest('[role="button"]') as HTMLElement;
    expect(cartao.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(cartao);

    expect(cartao.getAttribute('aria-expanded')).toBe('true');
    expect(within(cartao).getByRole('button', { name: /Mover/ })).toBeTruthy();
    expect(within(cartao).getByRole('button', { name: /Abrir processo/ })).toBeTruthy();
  });

  it('o teclado edita com Enter e alterna com Espaço, sem nenhum arrasto', async () => {
    estado.licitacoes = [processo()];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    const cartao = screen.getByText('PE nº 33/2026').closest('[role="button"]') as HTMLElement;

    fireEvent.keyDown(cartao, { key: ' ' });
    expect(cartao.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(cartao, { key: 'Enter' });
    expect(screen.getByTestId('editor').textContent).toContain('033/2026');
  });
});

describe('Kanban — celular', () => {
  it('troca o quadro por um seletor de etapa, com a contagem de cada uma', async () => {
    definirLargura(false);
    estado.licitacoes = [
      processo({ status: 'Monitorando' }),
      processo({ id: 'p2', numero: '044/2026', status: 'Em Disputa' }),
    ];
    montar();
    await aguardarQuadro('PE nº 33/2026');

    // Nenhum quadro de oito colunas: em 360px ele viraria miniatura ilegível.
    expect(screen.queryByRole('list', { name: 'Etapas do processo' })).toBeNull();

    const seletor = screen.getByLabelText('Etapa');
    expect(seletor).toBeTruthy();
    // A contagem da etapa em foco fica visível no próprio seletor.
    expect(seletor.textContent).toContain('Monitorando');
    expect(seletor.textContent).toContain('(1)');

    // Uma etapa por vez: o processo em Disputa não está montado junto.
    expect(screen.queryByText('PE nº 44/2026')).toBeNull();
  });
});

describe('Kanban — carga que falha', () => {
  it('não vira quadro vazio: mostra o erro do banco e oferece Tentar novamente', async () => {
    estado.erroLicitacoes = { message: 'permission denied for table licitacoes' };
    montar();

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar o quadro')).toBeTruthy(),
    );
    expect(screen.getByText('permission denied for table licitacoes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
    // Afirmar "nenhum processo" seria mentir sobre a empresa: o que se sabe é
    // que a consulta não respondeu.
    expect(screen.queryByText('Nenhum processo no Kanban')).toBeNull();

    estado.erroLicitacoes = null;
    estado.licitacoes = [processo()];
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));

    await waitFor(() => expect(screen.getByText('PE nº 33/2026')).toBeTruthy());
    expect(screen.queryByText('Não foi possível carregar o quadro')).toBeNull();
  });
});
