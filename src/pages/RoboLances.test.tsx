import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Testes da LISTA do Robô de Lances — a tela do cliente.
 *
 * ─── O QUE ESTES TESTES GUARDAM, E POR QUE ────────────────────────────────
 *
 *  1. (14/09/2026) A separação entre cliente e plataforma. As abas Agente,
 *     Portais e Configurações mostravam ao administrador da empresa o que é
 *     da operação Praefectus, e uma frase falsa ("Sistema pronto para
 *     disputas reais"). Nada disso pode voltar.
 *  2. Ligar/desligar o robô visível a todos e travado para quem só visualiza.
 *  3. Os avisos da operação: o geral aparece; o de portal sem disputa, não.
 *  4. (14/09/2026) A lista é SÓ lista. O bloco "Ferramentas da disputa" —
 *     sessões, disputa selecionada, coluna de controle e o Painel de Risco —
 *     era igual embaixo de qualquer aba e espremia a tabela de itens até uma
 *     letra por linha. Nada dele volta: cada linha abre a disputa em página
 *     própria, e "Nova sessão" leva à disputa recém-gravada.
 *
 * Envio ao robô, limite financeiro e o menu "Ações" moram na página da
 * disputa, e os testes deles em `RoboLancesDisputa.test.tsx`.
 *
 * NADA aqui abre sessão nem envia lance: supabase, hooks e edge functions são
 * dublês. A regra de segurança do módulo é que validação de robô não se faz
 * contra portal.
 */

/* ── Papel na empresa: trocado por teste ────────────────────────────────── */
const papel = { isAdmin: true, podeOperar: true, isViewer: false, papel: 'admin' as string | null };
vi.mock('@/hooks/usePapelEmpresa', () => ({
  usePapelEmpresa: () => papel,
}));

/* ── Respostas do banco, por tabela ─────────────────────────────────────── */
type Resposta = { data: unknown; error: { message: string; code?: string } | null };
const respostas: Record<string, Resposta> = {};

const DISPUTA = {
  id: 'disputa-1',
  edital: 'PE 90001/2026',
  portal: 'Compras.gov',
  uasg: '925123',
  tipo_disputa: 'item',
  valor_referencia: 10000,
  valor_inicial: 9000,
  valor_minimo: 7000,
  decremento_min: 50,
  decremento_percentual: 1.5,
  intervalo_segundos: 30,
  max_lances: 20,
  modo_automatico: false,
  status: 'aguardando',
  horario: '09:00',
  meu_lance: 0,
  valor_atual: 0,
  itens: [],
  licitacao_id: null,
};

/**
 * Cadeia encadeável do supabase-js: qualquer método devolve a própria cadeia,
 * e a cadeia é "thenable" — resolve com a resposta configurada para a tabela.
 */
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

// Sem resposta configurada: a `situacao-do-robo` "não implantada" devolve
// `data: null`, e a tela tem de dizer "indisponível", nunca "pronto".
const invoke = vi.fn(async () => ({ data: null, error: null }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => cadeiaDa(tabela),
    functions: { invoke: (...a: unknown[]) => invoke(...(a as [])) },
  },
}));

/* ── Contextos e hooks ──────────────────────────────────────────────────
   CADA UM DEVOLVE O MESMO OBJETO SEMPRE. Um hook dublado que devolve um
   literal novo a cada chamada quebra qualquer `useEffect` que o tenha na
   lista de dependências — laço infinito, teste que nunca termina. */
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
vi.mock('@/components/robo-lances/usePedidosDoRobo', () => {
  const valor = { data: { pedidos: [], desfechos: [], sessoesVivas: [] } };
  return {
    usePedidosDoRobo: () => valor,
    pararSessaoDoRobo: vi.fn(),
    focarSessaoDoRobo: vi.fn(),
  };
});

/* O painel de participações é o REAL (ele é o corpo da lista); só o
   carregamento é dublado, com o mesmo objeto em todos os renders. */
const participacoesDoHook = vi.hoisted(() => ({
  participacoes: [] as unknown[],
  carregando: false,
  erro: null as string | null,
  semEmpresa: false,
  lidoEm: new Date('2026-09-14T15:04:05Z') as Date | null,
  capacidade: { portaisComLanceLiberado: [] as string[], fonte: 'nao_verificada', verificadaEm: null as string | null },
  recarregar: async () => {},
}));
vi.mock('@/hooks/useParticipacoesDoRobo', () => ({ useParticipacoesDoRobo: () => participacoesDoHook }));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));

/* ── Dublês de peças pesadas ou que falam com a rede ─────────────────────
   As fábricas de `vi.mock` são içadas para o topo do arquivo: nada de
   variável declarada aqui fora pode ser CHAMADA dentro delas. */
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/shared/ProcessoContextoBanner', () => ({ default: () => null }));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ acoes, children }: { acoes?: React.ReactNode; children?: React.ReactNode }) => (
    <header>{acoes}{children}</header>
  ),
}));
/** O diálogo de cadastro vira um botão que "salva" uma disputa pronta. */
vi.mock('@/components/robo-lances/ConfigurarLanceDialog', () => ({
  default: ({ trigger, onSave }: { trigger?: React.ReactNode; onSave: (l: unknown) => void }) => (
    <>
      {trigger}
      <button
        type="button"
        onClick={() =>
          onSave({
            id: 'nova-1', edital: 'PE 555/2026', portal: 'Compras.gov', valorReferencia: 0, valorInicial: 0,
            valorMinimo: 0, decrementoMin: 0, decrementoPercentual: 1.5, intervaloSegundos: 30, maxLances: 20,
            modoAutomatico: false, status: 'aguardando', horario: '', meuLance: 0, valorAtual: 0, itens: [],
            tipoDisputa: 'item',
          })
        }
      >
        Salvar dublê
      </button>
    </>
  ),
}));
vi.mock('@/components/robo-lances/ExportarResultados', () => ({
  default: () => <button type="button">Exportar</button>,
}));
vi.mock('@/components/robo-lances/NivelAutomacaoSelector', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AceiteTermosDialog', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PedidoDoRobo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/CredenciaisPortalForm', () => ({ default: () => null }));

import RoboLances from './RoboLances';
import { toast } from 'sonner';

/** Onde a navegação caiu, e o que a lista entregou para a volta. */
function LocalAtual() {
  const local = useLocation();
  const daLista = (local.state as { daLista?: string } | null)?.daLista ?? '';
  return (
    <p data-testid="local" data-lista={daLista}>
      {local.pathname}
    </p>
  );
}

/**
 * O painel guarda aba e busca na URL — a página precisa de um roteador. E a
 * situação do robô e os avisos vêm pelo react-query — um cliente novo por teste.
 */
function renderizar(url = '/robo-lances') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/robo-lances" element={<RoboLances />} />
          <Route path="/robo-lances/disputa/:id" element={<LocalAtual />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Uma participação "em disputa" com processo vinculado. */
function participacao() {
  return {
    disputa: {
      ...DISPUTA,
      empresa_id: 'empresa-1',
      licitacao_id: 'lic-9',
      status: 'ativo',
      created_at: '2026-09-01T12:00:00Z',
      updated_at: '2026-09-01T12:00:00Z',
    },
    processo: {
      id: 'lic-9',
      numero: 'PE 90001/2026',
      orgao: 'Prefeitura de Exemplo',
      objeto: 'Material de expediente',
      data_abertura: null,
      operador_id: 'user-1',
      status: 'Em Disputa',
    },
    sessao: null,
    ultimoLanceProprio: null,
    melhorLanceInformado: null,
    projecao: {
      aba: 'em_disputa',
      faseInformadaPor: 'marcacao_manual',
      estadoDoRobo: 'sem_sessao',
      lanceLiberadoNoPortal: false,
      itensSemLimite: 0,
      pendenciaPrincipal: null,
      proximaAcao: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of Object.keys(respostas)) delete respostas[k];
  respostas.robo_lances_disputas = { data: [DISPUTA], error: null };
  invoke.mockImplementation(async () => ({ data: null, error: null }));
  participacoesDoHook.participacoes = [];
  papel.isAdmin = true;
  papel.podeOperar = true;
  papel.isViewer = false;
  papel.papel = 'admin';
});

describe('RoboLances — a tela do cliente não mostra o que é da plataforma', () => {
  it('não tem as abas Agente, Portais e Configurações — nem para o administrador da empresa', async () => {
    renderizar();
    await screen.findByRole('heading', { name: 'Participações do robô' });

    expect(screen.queryByRole('tab', { name: /^Agente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Portais/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Configurações/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Disputar/ })).not.toBeInTheDocument();
  });

  it('não afirma "Sistema pronto", não tem "Regras de lance" nem o nome do fornecedor de IA', async () => {
    renderizar();
    await screen.findByRole('heading', { name: 'Participações do robô' });

    expect(screen.queryByText(/Gemini/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sistema pronto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Regras de lance/i)).not.toBeInTheDocument();
  });

  it('o checklist de acesso mora em "Gerenciar portais", sem conexão, prontidão do agente, freio nem slots', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Gerenciar portais/ }));

    expect(await screen.findByText('Autenticação')).toBeInTheDocument();
    expect(screen.queryByText('Conexão')).not.toBeInTheDocument();
    expect(screen.queryByText('Prontidão do robô')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Sinal de vida|Slots Disponíveis|Freio de emergência verificado|Portais respondendo/),
    ).not.toBeInTheDocument();
  });

  it('sem resposta da situação do robô, diz "indisponível no momento" — nunca "pronto"', async () => {
    renderizar();

    expect((await screen.findAllByText('Situação do robô indisponível no momento')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Disponível')).not.toBeInTheDocument();
  });

  it('troca o selo "Nível 1" pelo botão do modo de operação', async () => {
    renderizar();

    expect(await screen.findByRole('button', { name: /Modo: Nível 1 — Assistente/ })).toBeInTheDocument();
  });

  it('mostra CNPJ e razão social da empresa, com "Gerenciar portais" e "Avisos"', async () => {
    renderizar();

    expect(await screen.findByText('Acme Licitações LTDA')).toBeInTheDocument();
    expect(screen.getByText(/12\.345\.678\/0001-90/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerenciar portais/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avisos/ })).toBeInTheDocument();
  });
});

describe('RoboLances — ligar e desligar o robô', () => {
  it('o controle aparece para todos e fica travado para quem só visualiza', async () => {
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    papel.papel = 'viewer';
    renderizar();

    const botao = await screen.findByRole('button', { name: /Desligar o robô/ });
    await waitFor(() => expect(botao).toBeDisabled());
    expect(screen.getByText('Robô ligado')).toBeInTheDocument();
    expect(screen.getByText(/exige o papel de operador/)).toBeInTheDocument();
  });

  it('migration não aplicada: robô considerado ligado, com a nota junto do botão', async () => {
    respostas.robo_empresa_config = {
      data: null,
      error: { code: '42P01', message: 'relation "public.robo_empresa_config" does not exist' },
    };
    renderizar();

    expect(await screen.findByText('Liga/desliga disponível após atualização do banco')).toBeInTheDocument();
    expect(screen.getByText('Robô ligado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Desligar o robô/ })).toBeDisabled();
  });
});

describe('RoboLances — avisos da operação', () => {
  it('mostra o aviso geral e esconde o de um portal em que a empresa não disputa', async () => {
    respostas.robo_avisos_portal = {
      data: [
        {
          id: 'aviso-geral', portal_id: null, severidade: 'atencao', ativo: true,
          titulo: 'Instabilidade na comunicação com os portais',
          mensagem: 'A ferramenta continua disponível, mas algumas ações podem falhar. Já estamos monitorando o problema.',
          inicio_em: '2020-01-01T00:00:00Z', fim_em: null,
        },
        {
          id: 'aviso-licitanet', portal_id: 'licitanet', severidade: 'critico', ativo: true,
          titulo: 'LicitaNet fora do ar',
          mensagem: 'O portal não responde desde as 9h.',
          inicio_em: '2020-01-01T00:00:00Z', fim_em: null,
        },
      ],
      error: null,
    };
    const { container } = renderizar();

    expect(await screen.findByText('Instabilidade na comunicação com os portais')).toBeInTheDocument();
    expect(screen.queryByText('LicitaNet fora do ar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avisos/ })).toHaveTextContent('2');

    // Acima do painel de participações.
    const faixa = container.querySelector('[data-faixa="avisos"]');
    const painel = container.querySelector('[data-painel="participacoes"]');
    expect(faixa).toBeTruthy();
    expect(painel).toBeTruthy();
    expect(faixa!.compareDocumentPosition(painel!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('RoboLances — papel', () => {
  it('esconde "Nova sessão" de quem só visualiza, dizendo por quê', async () => {
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    papel.papel = 'viewer';
    renderizar();
    await screen.findByRole('heading', { name: 'Participações do robô' });

    expect(screen.queryByRole('button', { name: /Nova sessão/ })).not.toBeInTheDocument();
    // Ausência sem explicação é indistinguível de defeito.
    expect(screen.getAllByText(/modo leitura/i).length).toBeGreaterThan(0);
  });
});

describe('RoboLances — a lista é só lista', () => {
  it('não desenha ferramentas da disputa, coluna de sessões nem Painel de Risco embaixo das abas', async () => {
    participacoesDoHook.participacoes = [participacao()];
    const { container } = renderizar();
    await screen.findByRole('heading', { name: 'Participações do robô' });

    expect(screen.queryByText('Ferramentas da disputa')).not.toBeInTheDocument();
    expect(container.querySelector('[data-coluna]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Sessões' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Painel de Risco|Faixa ideal/)).not.toBeInTheDocument();
    expect(screen.queryByText('Estado da sessão')).not.toBeInTheDocument();
    expect(screen.queryByText(/Limite financeiro autorizado/)).not.toBeInTheDocument();
    expect(screen.queryByText('Selecione ou crie uma disputa')).not.toBeInTheDocument();
  });

  it('a linha abre a página da disputa — mesmo com processo vinculado — levando aba e busca da lista', async () => {
    participacoesDoHook.participacoes = [participacao()];
    renderizar('/robo-lances?painel=em_disputa&q=90001');

    fireEvent.click(await screen.findByRole('button', { name: /PE 90001\/2026/ }));

    const local = await screen.findByTestId('local');
    expect(local).toHaveTextContent('/robo-lances/disputa/disputa-1');
    expect(local).toHaveAttribute('data-lista', '?painel=em_disputa&q=90001');
  });

  it('"Nova sessão" grava e só então abre a página da disputa nova', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar dublê' }));

    expect(await screen.findByTestId('local')).toHaveTextContent('/robo-lances/disputa/nova-1');
    expect(toast.success).toHaveBeenCalledWith('Nova disputa adicionada!');
  });

  it('"Nova sessão" que o banco recusa diz o motivo e não abre página nenhuma', async () => {
    renderizar();
    const salvar = await screen.findByRole('button', { name: 'Salvar dublê' });
    respostas.robo_lances_disputas = { data: null, error: { message: 'permission denied for table robo_lances_disputas' } };
    fireEvent.click(salvar);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Disputa não foi salva: permission denied for table robo_lances_disputas',
        expect.anything(),
      ),
    );
    expect(screen.queryByTestId('local')).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
