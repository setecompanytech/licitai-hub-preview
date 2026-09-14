import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A página de UMA disputa do robô — `/robo-lances/disputa/:id`.
 *
 * ─── O QUE ESTES TESTES GUARDAM, E POR QUE ────────────────────────────────
 *
 *  1. A aba mora na URL (`?aba=`): F5, link e "voltar" caem nela.
 *  2. UMA ação principal, escolhida pelo estado: "Enviar ao robô" sem sessão em
 *     andamento; "Parar robô nesta disputa" com — e a parada "solicitada"
 *     nunca vira "Parado".
 *  3. "Não conseguimos carregar" ≠ "não existe".
 *  4. A tabela de itens tem os valores DENTRO das células — a tela antiga os
 *     espremia numa coluna até sair uma letra por linha.
 *  5. O erro da sessão aparece em linguagem de cliente, nunca o texto do agente.
 *  6. Os comportamentos que vieram da lista: recusa 409/502 com a frase do
 *     servidor, limite financeiro chegando ao diálogo de autorização, menu
 *     "Ações" com rótulos honestos, papel de leitura — e nada do Painel de
 *     Risco, com sua "faixa ideal" de percentuais inventados.
 *
 * NADA aqui abre sessão nem envia lance: supabase, hooks, comandos e edge
 * functions são dublês.
 */

/* ── Papel na empresa: trocado por teste ────────────────────────────────── */
const papel = { isAdmin: true, podeOperar: true, isViewer: false, papel: 'admin' as string | null };
vi.mock('@/hooks/usePapelEmpresa', () => ({ usePapelEmpresa: () => papel }));

/* ── Respostas do banco, por tabela ─────────────────────────────────────── */
type Resposta = { data: unknown; error: { message: string; code?: string } | null };
const respostas: Record<string, Resposta> = {};

const DISPUTA = {
  id: 'disputa-1',
  empresa_id: 'empresa-1',
  user_id: 'user-1',
  licitacao_id: null,
  edital: 'PE 90001/2026',
  portal: 'Compras.gov.br',
  uasg: '925123',
  tipo_disputa: 'item',
  valor_referencia: 1127.5,
  valor_inicial: 900,
  valor_minimo: 700,
  decremento_min: 50,
  decremento_percentual: 1.5,
  intervalo_segundos: 30,
  max_lances: 20,
  modo_automatico: false,
  status: 'aguardando',
  horario: '09:00',
  meu_lance: 0,
  valor_atual: 0,
  precificacao_versao_id: null,
  limites_confirmados_em: null,
  created_at: '2026-09-14T12:00:00Z',
  updated_at: '2026-09-14T12:00:00Z',
  itens: [
    {
      id: 'i1', numero: 1, lote: 'Único', descricao: 'Caneta esferográfica azul', quantidade: 10, unidade: 'UN',
      valorReferencia: 100, valorMinimo: 80, disputando: true, situacao: 'aguardando', melhorLance: null, seuUltimoLance: null,
    },
    {
      id: 'i2', numero: 2, lote: 'Único', descricao: 'Papel A4', quantidade: 5, unidade: 'CX',
      valorReferencia: 25.5, valorMinimo: null, disputando: true, situacao: 'aguardando', melhorLance: null, seuUltimoLance: null,
    },
  ],
};

/** Cadeia encadeável e "thenable" do supabase-js, resolvida pela tabela. */
function cadeiaDa(tabela: string) {
  const resolver = () => Promise.resolve(respostas[tabela] ?? { data: [], error: null });
  const cadeia: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_alvo, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          const p = resolver() as unknown as Record<string, (...a: unknown[]) => unknown>;
          return (p[prop] as (...a: unknown[]) => unknown).bind(p);
        }
        return () => cadeia;
      },
    },
  ) as Record<string | symbol, unknown>;
  return cadeia;
}

const invoke = vi.fn(async () => ({ data: null, error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => cadeiaDa(tabela),
    functions: { invoke: (...a: unknown[]) => invoke(...(a as [])) },
  },
}));

/* ── Hooks e contextos: o MESMO objeto em todo render ────────────────────
   Literal novo a cada chamada invalida `useMemo`/`useEffect` que dependem dele
   e vira laço de renderização. `vi.hoisted` porque as fábricas de `vi.mock`
   sobem para o topo do arquivo. */
const { solicitarParada, estadoDoHook, estadoDoAgente } = vi.hoisted(() => ({
  solicitarParada: vi.fn(),
  estadoDoHook: {
    participacoes: [] as unknown[],
    carregando: false,
    erro: null as string | null,
    semEmpresa: false,
    lidoEm: new Date('2026-09-14T15:04:05Z') as Date | null,
    capacidade: { portaisComLanceLiberado: [] as string[], fonte: 'nao_verificada', verificadaEm: null as string | null },
    recarregar: vi.fn(async () => {}),
  },
  estadoDoAgente: { data: { pedidos: [] as unknown[], desfechos: [] as unknown[], sessoesVivas: [] as unknown[] } },
}));
vi.mock('@/lib/robo/comandos', () => ({ solicitarParada, causaDoErro: async () => '' }));
vi.mock('@/hooks/useParticipacoesDoRobo', () => ({ useParticipacoesDoRobo: () => estadoDoHook }));
vi.mock('@/components/robo-lances/usePedidosDoRobo', () => ({ usePedidosDoRobo: () => estadoDoAgente }));

vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});
vi.mock('@/contexts/EmpresaContext', () => {
  const valor = {
    empresaAtiva: { id: 'empresa-1', cnpj: '12345678000190', razao_social: 'Acme Licitações LTDA', nome_fantasia: null },
    empresas: [] as unknown[],
  };
  return { useEmpresa: () => valor };
});
vi.mock('@/hooks/useProcessoAtivo', () => {
  const valor = { processoId: null };
  return { useProcessoAtivo: () => valor };
});
vi.mock('@/hooks/useAuditLog', () => {
  const valor = { registrar: vi.fn(), buscarHistorico: vi.fn(async () => []) };
  return { useAuditLog: () => valor };
});
vi.mock('@/hooks/useLicitacaoIntegration', () => {
  const valor = { registrarResultadoDisputa: vi.fn(), registrarPerda: vi.fn(async () => true) };
  return { useLicitacaoIntegration: () => valor };
});
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

/* ── Peças pesadas ou que falam com a rede ─────────────────────────────── */
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/robo-lances/ConfigurarLanceDialog', () => ({
  default: ({ trigger }: { trigger?: React.ReactNode }) => <>{trigger}</>,
}));
vi.mock('@/components/licitacoes/LicitacaoChat', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/NivelAutomacaoSelector', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AceiteTermosDialog', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/ConferenciaDosItens', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PedidoDoRobo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/KillSwitchButton', () => ({ default: () => null }));
vi.mock('@/components/metas/RegistrarPerdaDialog', () => ({ default: () => null }));
/** O diálogo de autorização EXPÕE o limite recebido — é o ponto do defeito de 13/09. */
vi.mock('@/components/robo-lances/AutorizacaoLanceDialog', () => ({
  default: ({ limiteFinanceiro }: { limiteFinanceiro: number }) => (
    <div data-testid="autorizacao-dialog" data-limite={String(limiteFinanceiro)} />
  ),
}));

import RoboLancesDisputa from './RoboLancesDisputa';
import { toast } from 'sonner';

function LocalAtual() {
  const local = useLocation();
  return <p data-testid="local">{`${local.pathname}${local.search}`}</p>;
}

type Entrada = string | { pathname: string; search?: string; state?: unknown };

function renderizar(entrada: Entrada = '/robo-lances/disputa/disputa-1') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route
            path="/robo-lances/disputa/:id"
            element={
              <>
                <RoboLancesDisputa />
                <LocalAtual />
              </>
            }
          />
          <Route path="/robo-lances" element={<LocalAtual />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

interface Ajustes {
  projecao?: Record<string, unknown>;
  sessao?: Record<string, unknown> | null;
}

function participacao({ projecao = {}, sessao = null }: Ajustes = {}) {
  return {
    disputa: DISPUTA,
    processo: null,
    sessao: sessao
      ? {
          id: 'sessao-1',
          status: 'ativo',
          modo: 'real',
          updated_at: new Date().toISOString(),
          parada_solicitada_em: null,
          parada_confirmada_em: null,
          erro: null,
          licitacao_id: null,
          lance_config_id: 'disputa-1',
          portal_nome: 'Compras.gov.br',
          valor_atual: null,
          rodada_atual: null,
          created_at: '2026-09-14T12:00:00Z',
          ...sessao,
        }
      : null,
    ultimoLanceProprio: null,
    melhorLanceInformado: null,
    projecao: {
      aba: 'cadastradas',
      faseInformadaPor: null,
      estadoDoRobo: 'sem_sessao',
      lanceLiberadoNoPortal: false,
      itensSemLimite: 1,
      pendenciaPrincipal: null,
      proximaAcao: null,
      ...projecao,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of Object.keys(respostas)) delete respostas[k];
  respostas.robo_lances_disputas = { data: DISPUTA, error: null };
  respostas.robo_aceite_termos = { data: [{ limite_financeiro: 5000 }], error: null };
  invoke.mockImplementation(async () => ({ data: null, error: null }));
  estadoDoHook.participacoes = [participacao()];
  estadoDoHook.erro = null;
  solicitarParada.mockReset();
  papel.isAdmin = true;
  papel.podeOperar = true;
  papel.isViewer = false;
  papel.papel = 'admin';
});

describe('RoboLancesDisputa — abas na URL', () => {
  it('abre em "Itens e limites" e grava a aba escolhida na URL', async () => {
    renderizar();

    expect(await screen.findByRole('heading', { level: 1, name: 'PE 90001/2026' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Itens e limites/ })).toHaveAttribute('data-state', 'active');

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Estratégia/ }));

    await waitFor(() =>
      expect(screen.getByTestId('local')).toHaveTextContent('/robo-lances/disputa/disputa-1?aba=estrategia'),
    );
    expect(await screen.findByText('Parâmetros da disputa')).toBeInTheDocument();
  });

  it('com ?aba=acompanhamento, abre direto no estado da sessão e nos eventos', async () => {
    renderizar('/robo-lances/disputa/disputa-1?aba=acompanhamento');

    expect(await screen.findByRole('tab', { name: /Acompanhamento/ })).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('heading', { name: 'Eventos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Mural/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Operações/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Simulação|Auditoria/ })).not.toBeInTheDocument();
  });

  it('o caminho de volta leva à lista na mesma aba e com a mesma busca', async () => {
    renderizar({ pathname: '/robo-lances/disputa/disputa-1', state: { daLista: '?painel=configuradas&q=PE' } });

    const voltar = await screen.findByRole('link', { name: 'Robô de lances' });
    expect(voltar).toHaveAttribute('href', '/robo-lances?painel=configuradas&q=PE');
  });
});

describe('RoboLancesDisputa — a ação principal é escolhida pelo estado', () => {
  it('sem sessão em andamento: "Enviar ao robô", e nenhum botão de parar', async () => {
    renderizar();

    expect(await screen.findByRole('button', { name: /Enviar ao robô/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parar robô nesta disputa/ })).not.toBeInTheDocument();
    // Sem pedido algum, nada foi mandado ao serviço só por abrir a página.
    expect(solicitarParada).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('robo-lances-webhook/enviar-sessao', expect.anything());
  });

  it('com o robô operando: "Parar robô nesta disputa" — e "solicitada" nunca vira "Parado"', async () => {
    estadoDoHook.participacoes = [
      participacao({ sessao: {}, projecao: { aba: 'em_disputa', faseInformadaPor: 'agente', estadoDoRobo: 'operando' } }),
    ];
    solicitarParada.mockResolvedValue({
      estado: 'solicitada',
      sessaoId: 'sessao-1',
      solicitadaEm: '2026-09-14T13:00:05Z',
      confirmadaEm: null,
      motivo: 'O agente ainda não confirmou o encerramento.',
    });
    renderizar();

    const parar = await screen.findByRole('button', { name: /Parar robô nesta disputa/ });
    expect(screen.queryByRole('button', { name: /Enviar ao robô/ })).not.toBeInTheDocument();
    expect(screen.getByText('informada pelo agente')).toBeInTheDocument();

    fireEvent.click(parar);
    expect(await screen.findByText(/não cancela lances já aceitos pelo portal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar parada' }));

    expect(await screen.findByText(/O encerramento só vale quando o agente confirmar/)).toBeInTheDocument();
    expect(solicitarParada).toHaveBeenCalledWith('sessao-1');
    // 13:00:05 UTC é 10:00:05 em Brasília.
    expect(screen.getByText(/Pedido registrado às 10:00:05 • horário de Brasília/)).toBeInTheDocument();
    expect(screen.getAllByText('Parada solicitada — aguardando confirmação').length).toBeGreaterThan(0);
    expect(screen.queryByText('Parado')).not.toBeInTheDocument();
    expect(screen.queryByText(/Parada confirmada/)).not.toBeInTheDocument();
  });

  it('quem só visualiza não tem "Enviar ao robô" nem "Editar parâmetros", e lê por quê', async () => {
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    papel.papel = 'viewer';
    renderizar();

    await screen.findByRole('heading', { level: 1, name: 'PE 90001/2026' });
    expect(screen.queryByRole('button', { name: /Enviar ao robô/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar parâmetros/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/modo leitura/i).length).toBeGreaterThan(0);
  });
});

describe('RoboLancesDisputa — carregar ≠ existir', () => {
  it('linha ausente: "Disputa não encontrada", com o caminho de volta', async () => {
    respostas.robo_lances_disputas = { data: null, error: null };
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Disputa não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao robô de lances' })).toHaveAttribute('href', '/robo-lances');
    expect(screen.queryByText(/Não conseguimos carregar/)).not.toBeInTheDocument();
  });

  it('consulta que falhou: diz que não carregou, mostra a mensagem real e tenta de novo', async () => {
    respostas.robo_lances_disputas = { data: null, error: { message: 'permission denied for table robo_lances_disputas' } };
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Não conseguimos carregar esta disputa' })).toBeInTheDocument();
    expect(screen.getByText(/permission denied for table robo_lances_disputas/)).toBeInTheDocument();
    expect(screen.queryByText('Disputa não encontrada')).not.toBeInTheDocument();

    respostas.robo_lances_disputas = { data: DISPUTA, error: null };
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'PE 90001/2026' })).toBeInTheDocument();
  });
});

describe('RoboLancesDisputa — itens e limites', () => {
  it('os valores de cada item ficam dentro das células, e a busca filtra a tabela', async () => {
    renderizar();

    const referencia = await screen.findByText(/R\$\s*100,00/);
    expect(referencia.closest('td')).not.toBeNull();
    expect(screen.getByText('10 UN').closest('td')).not.toBeNull();
    expect(screen.getByText('Caneta esferográfica azul').closest('td')).not.toBeNull();
    // O limite do item 1 e a ausência do item 2, sem "R$ 0,00" inventado.
    expect(screen.getByText(/R\$\s*80,00/).closest('td')).not.toBeNull();
    expect(screen.getByText('Sem limite definido')).toBeInTheDocument();
    expect(screen.getByText('1 de 2 itens com limite')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Buscar item/), { target: { value: 'papel' } });
    expect(screen.queryByText('Caneta esferográfica azul')).not.toBeInTheDocument();
    expect(screen.getByText('Papel A4')).toBeInTheDocument();
  });

  it('não mostra o Painel de Risco nem "faixa ideal" em nenhuma aba', async () => {
    renderizar();
    await screen.findByText('Caneta esferográfica azul');
    expect(screen.queryByText(/Painel de Risco|Faixa ideal|Na faixa\?/)).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Estratégia/ }));
    await screen.findByText('Parâmetros da disputa');
    expect(screen.queryByText(/Painel de Risco|Faixa ideal|Na faixa\?/)).not.toBeInTheDocument();
  });
});

describe('RoboLancesDisputa — acompanhamento', () => {
  it('o erro da sessão aparece em linguagem de cliente, nunca o texto do agente', async () => {
    estadoDoHook.participacoes = [
      participacao({ sessao: { status: 'erro', erro: 'Signal timed out.' }, projecao: { estadoDoRobo: 'erro' } }),
    ];
    respostas.sessoes_lance_real = {
      data: [
        {
          id: 'sessao-1', status: 'erro', resultado: null, erro: 'Signal timed out.', portal_nome: 'Compras.gov.br',
          rodada_atual: null, valor_atual: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:30Z',
        },
      ],
      error: null,
    };
    renderizar('/robo-lances/disputa/disputa-1?aba=acompanhamento');

    expect(await screen.findByText('O portal não respondeu a tempo. Tentar de novo mais tarde.')).toBeInTheDocument();
    // Sessão com erro já acabou: a ação principal volta a ser enviar.
    expect(screen.getByRole('button', { name: /Enviar ao robô/ })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Operações/ }));
    expect(await screen.findByText('Sessão do robô')).toBeInTheDocument();
    expect(screen.getByText(/O portal não respondeu a tempo\. Tentar de novo mais tarde\./, { selector: 'li span' })).toBeInTheDocument();
    expect(screen.queryByText(/Signal timed out/)).not.toBeInTheDocument();
  });
});

describe('RoboLancesDisputa — recusa do envio ao robô', () => {
  /** A resposta não-2xx do supabase-js: frase genérica em `message`, corpo em `context`. */
  function recusa(status: number, corpo: unknown) {
    return {
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => corpo } },
    };
  }

  it('409 (robô desligado): mostra a frase do servidor, nunca "non-2xx"', async () => {
    invoke.mockImplementation((async (nome: string) =>
      nome === 'robo-lances-webhook/enviar-sessao'
        ? recusa(409, { success: false, error: 'O robô de lances desta empresa está desligado.' })
        : { data: null, error: null }) as never);
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Enviar ao robô/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('O robô de lances desta empresa está desligado.', expect.anything()),
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/non-2xx/), expect.anything());
  });

  it('502 sem corpo legível: frase para o cliente, nunca "non-2xx status code"', async () => {
    invoke.mockImplementation((async (nome: string) =>
      nome === 'robo-lances-webhook/enviar-sessao' ? recusa(502, null) : { data: null, error: null }) as never);
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Enviar ao robô/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/não aceitou a sessão/), expect.anything()),
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/non-2xx/), expect.anything());
  });
});

describe('RoboLancesDisputa — estratégia e limite financeiro', () => {
  it('lê o limite do aceite vigente, mostra e entrega ao diálogo de autorização', async () => {
    renderizar('/robo-lances/disputa/disputa-1?aba=estrategia');

    await waitFor(() => expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '5000'));
    expect(screen.getByText('Limite financeiro autorizado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*5\.000,00/)).toBeInTheDocument();
  });

  it('sem aceite vigente não afirma "R$ 0,00" — declara a ausência e a razão', async () => {
    respostas.robo_aceite_termos = { data: [], error: null };
    renderizar('/robo-lances/disputa/disputa-1?aba=estrategia');

    await waitFor(() => expect(screen.getByText(/Nenhum aceite vigente/i)).toBeInTheDocument());
    expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '0');
  });

  it('a análise com IA vem recolhida, como opcional, e sem o nome do fornecedor', async () => {
    renderizar('/robo-lances/disputa/disputa-1?aba=estrategia');

    expect(screen.queryByText('Estratégia Preditiva IA')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Análise com IA \(opcional\)/ }));
    expect(await screen.findByText('Estratégia Preditiva IA')).toBeInTheDocument();
    expect(screen.queryByText(/Gemini/i)).not.toBeInTheDocument();
  });
});

describe('RoboLancesDisputa — menu "Ações"', () => {
  it('diz que marcar a fase não inicia nem para o robô', async () => {
    renderizar();

    fireEvent.keyDown(await screen.findByRole('button', { name: 'Ações' }), { key: 'Enter' });
    expect(await screen.findByText('Marcar como em disputa (manual)')).toBeInTheDocument();
    expect(screen.getByText(/Não inicia nem para o robô/)).toBeInTheDocument();
    expect(screen.queryByText(/Iniciar disputa/)).not.toBeInTheDocument();
  });
});
