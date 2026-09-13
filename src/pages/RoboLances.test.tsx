import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * Testes da reestruturação visual do Robô de Lances (13/09/2026).
 *
 * ─── O QUE ESTES TESTES GUARDAM, E POR QUE ────────────────────────────────
 *
 *  1. As quatro abas principais e a visibilidade por papel. Três delas são de
 *     administrador; um operador que as enxergasse chegaria a credenciais da
 *     empresa e ao nível de automação.
 *  2. As três colunas da composição aprovada. É a única verificação que
 *     sobrevive a uma refatoração de CSS — por isso as colunas carregam
 *     `data-coluna`.
 *  3. O limite financeiro. Este é o teste que existe por causa de um defeito
 *     real: a página declarava `limiteFinanceiro` sem nunca ter setter, e o
 *     diálogo de autorização recebia zero para sempre — com zero, a checagem
 *     `excedeLimite` daquele diálogo é sempre falsa, e a trava não travava.
 *  4. Conexão, prontidão e limites como blocos distintos, porque respondem a
 *     perguntas diferentes e o desenho antigo os lia como um semáforo só.
 *
 * NADA aqui abre sessão nem envia lance: supabase, hooks e edge functions são
 * todos dublês. A regra de segurança do módulo é que validação de robô não se
 * faz contra portal.
 */

/* ── Papel na empresa: trocado por teste ────────────────────────────────── */
const papel = { isAdmin: true, podeOperar: true, isViewer: false, papel: 'admin' as string | null };
vi.mock('@/hooks/usePapelEmpresa', () => ({
  usePapelEmpresa: () => papel,
}));

/* ── Respostas do banco, por tabela ─────────────────────────────────────── */
type Resposta = { data: unknown; error: { message: string } | null };
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
 * Cobre `.select().eq().is().order().limit()`, `.maybeSingle()`, `.single()` e
 * `.then()` sem precisar saber a ordem em que cada tela chama.
 */
function cadeiaDa(tabela: string) {
  const resolver = () =>
    Promise.resolve(respostas[tabela] ?? { data: [], error: null });

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

/* ── Contextos e hooks ──────────────────────────────────────────────────
   CADA UM DEVOLVE O MESMO OBJETO SEMPRE. Um hook dublado que devolve um
   literal novo a cada chamada quebra qualquer `useEffect` que o tenha na
   lista de dependências: `AtivacaoChecklist` observa `[user, empresaAtiva]`,
   e com identidade nova a cada render o efeito redispara, chama `setItems`,
   renderiza de novo — laço infinito, teste que nunca termina. */
vi.mock('@/contexts/AuthContext', () => {
  const valor = { user: { id: 'user-1', email: 'operador@exemplo.com' } };
  return { useAuth: () => valor };
});
vi.mock('@/contexts/EmpresaContext', () => {
  const valor = {
    empresaAtiva: { id: 'empresa-1', cnpj: '12345678000190', razao_social: 'Acme Licitações LTDA' },
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
  const valor = {
    registrarResultadoDisputa: vi.fn(),
    registrarPerda: vi.fn(async () => true),
  };
  return { useLicitacaoIntegration: () => valor };
});
vi.mock('@/components/robo-lances/usePedidosDoRobo', () => {
  const valor = { data: { pedidos: [], desfechos: [], sessoesVivas: [] } };
  return {
    usePedidosDoRobo: () => valor,
    pararSessaoDoRobo: vi.fn(),
    focarSessaoDoRobo: vi.fn(),
  };
});
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));

/* ── Dublês de peças pesadas ou que falam com a rede ─────────────────────
   As fábricas de `vi.mock` são içadas para o topo do arquivo: nada de
   variável declarada aqui fora pode ser CHAMADA dentro delas. */
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));
vi.mock('@/components/shared/ProcessoContextoBanner', () => ({ default: () => null }));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ acoes, children }: { acoes?: React.ReactNode; children?: React.ReactNode }) => (
    <header>{acoes}{children}</header>
  ),
}));
vi.mock('@/components/robo-lances/ConfigurarLanceDialog', () => ({
  default: ({ trigger }: { trigger?: React.ReactNode }) => <>{trigger}</>,
}));
vi.mock('@/components/licitacoes/LicitacaoChat', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/SimulacaoDisputa', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/DisputasResumo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/ExportarResultados', () => ({
  default: () => <button type="button">Exportar</button>,
}));
vi.mock('@/components/robo-lances/NivelAutomacaoSelector', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AceiteTermosDialog', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PainelRisco', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AuditTrailViewer', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/DisputaRealtimePanel', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PortalHealthcheck', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/EstrategiaIAPanel', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/VncWebViewer', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/SessoesDoRobo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/ConferenciaDosItens', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PedidoDoRobo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AcessoManualPortal', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/CredenciaisPortalForm', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AgenteExternoConfig', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/KillSwitchButton', () => ({ default: () => null }));
vi.mock('@/components/metas/RegistrarPerdaDialog', () => ({ default: () => null }));

/**
 * O diálogo de autorização entra como dublê que EXPÕE o limite recebido.
 * É o ponto exato do defeito: o valor chegava aqui e chegava zerado.
 */
vi.mock('@/components/robo-lances/AutorizacaoLanceDialog', () => ({
  default: ({ limiteFinanceiro }: { limiteFinanceiro: number }) => (
    <div data-testid="autorizacao-dialog" data-limite={String(limiteFinanceiro)} />
  ),
}));

import RoboLances from './RoboLances';

/**
 * O diálogo REAL, obtido com `importActual` porque o dublê acima o substitui
 * para o resto do arquivo. `useAuditLog` e `sonner` seguem dublados — só este
 * módulo volta a ser o de verdade, que é onde `excedeLimite` mora.
 */
type ModuloAutorizacao = typeof import('@/components/robo-lances/AutorizacaoLanceDialog');
let AutorizacaoLanceDialog: ModuloAutorizacao['default'];
beforeAll(async () => {
  const mod = await vi.importActual<ModuloAutorizacao>(
    '@/components/robo-lances/AutorizacaoLanceDialog',
  );
  AutorizacaoLanceDialog = mod.default;
});

/** Abre a disputa da coluna da esquerda — é o que revela centro e direita. */
async function selecionarDisputa() {
  const alvo = await screen.findByRole('button', { name: /PE 90001\/2026/ });
  fireEvent.click(alvo);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of Object.keys(respostas)) delete respostas[k];
  respostas.robo_lances_disputas = { data: [DISPUTA], error: null };
  respostas.robo_aceite_termos = { data: [{ limite_financeiro: 5000 }], error: null };
  papel.isAdmin = true;
  papel.podeOperar = true;
  papel.isViewer = false;
  papel.papel = 'admin';
});

describe('RoboLances — abas principais e papel', () => {
  it('mostra as quatro abas para o administrador, com os rótulos exatos', async () => {
    render(<RoboLances />);

    expect(await screen.findByRole('tab', { name: /Disputar/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Agente/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Portais/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Configurações/ })).toBeInTheDocument();
  });

  it('esconde Agente, Portais e Configurações de quem não é administrador', async () => {
    papel.isAdmin = false;
    papel.papel = 'operador';
    render(<RoboLances />);

    expect(await screen.findByRole('tab', { name: /Disputar/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Agente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Portais/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Configurações/ })).not.toBeInTheDocument();
  });

  it('esconde "Nova sessão" e "Enviar ao robô" de quem só visualiza, dizendo por quê', async () => {
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    papel.papel = 'viewer';
    render(<RoboLances />);
    await selecionarDisputa();

    expect(screen.queryByRole('button', { name: /Nova sessão/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar ao robô/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assistir ao vivo/ })).not.toBeInTheDocument();
    // Ausência sem explicação é indistinguível de defeito.
    expect(screen.getAllByText(/modo leitura/i).length).toBeGreaterThan(0);
  });
});

describe('RoboLances — as três colunas', () => {
  it('desenha sessões à esquerda, sessão selecionada no centro e controle à direita', async () => {
    const { container } = render(<RoboLances />);
    await selecionarDisputa();

    expect(container.querySelector('[data-coluna="sessoes"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="sessao-selecionada"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="controle"]')).toBeTruthy();
  });

  it('mantém as três colunas mesmo sem disputa selecionada', async () => {
    const { container } = render(<RoboLances />);
    await screen.findByRole('button', { name: /PE 90001\/2026/ });

    expect(container.querySelector('[data-coluna="sessoes"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="sessao-selecionada"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="controle"]')).toBeTruthy();
  });

  it('mantém as quatro subabas do painel de eventos', async () => {
    render(<RoboLances />);
    await selecionarDisputa();

    expect(screen.getByRole('tab', { name: /Mural/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Simulação/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Operações/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Auditoria/ })).toBeInTheDocument();
  });
});

describe('RoboLances — os seis eixos como blocos distintos', () => {
  it('separa conexão, autenticação, prontidão, limites, estado da sessão e eventos', async () => {
    render(<RoboLances />);
    await selecionarDisputa();

    // Os três do checklist — cada um com a pergunta que responde.
    expect(await screen.findByText('Conexão')).toBeInTheDocument();
    expect(screen.getByText('O portal responde?')).toBeInTheDocument();
    expect(screen.getByText('Autenticação')).toBeInTheDocument();
    expect(screen.getByText('Minhas credenciais valem?')).toBeInTheDocument();
    expect(screen.getByText('Prontidão do robô')).toBeInTheDocument();
    expect(screen.getByText('O robô está pronto para operar?')).toBeInTheDocument();

    // Os três do painel da direita.
    expect(screen.getByText('Limites')).toBeInTheDocument();
    expect(screen.getByText('Estado da sessão')).toBeInTheDocument();
    expect(screen.getAllByText('Eventos').length).toBeGreaterThan(0);
  });

  it('não deixa o eixo de conexão sugerir que a automação foi validada', async () => {
    render(<RoboLances />);
    await selecionarDisputa();

    expect(
      await screen.findByText(/Portal respondendo não significa automação validada/i),
    ).toBeInTheDocument();
  });
});

describe('RoboLances — limite financeiro (o defeito da trava que não travava)', () => {
  it('lê o limite do aceite vigente e o entrega ao diálogo de autorização', async () => {
    render(<RoboLances />);
    await selecionarDisputa();

    await waitFor(() => {
      expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '5000');
    });
  });

  it('mostra o limite na coluna da direita em vez de um número inventado', async () => {
    render(<RoboLances />);
    await selecionarDisputa();

    expect(await screen.findByText('Limite financeiro autorizado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*5\.000,00/)).toBeInTheDocument();
  });

  it('sem aceite vigente não afirma "R$ 0,00" — declara a ausência e a razão', async () => {
    respostas.robo_aceite_termos = { data: [], error: null };
    render(<RoboLances />);
    await selecionarDisputa();

    await waitFor(() => {
      expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '0');
    });
    expect(screen.getByText(/Nenhum aceite vigente/i)).toBeInTheDocument();
  });
});

/**
 * A outra metade do defeito: com o limite chegando, a trava do diálogo tem
 * que voltar a agir. Aqui o diálogo é o componente REAL — é o único lugar
 * onde `excedeLimite` existe.
 */
describe('AutorizacaoLanceDialog — excedeLimite volta a funcionar', () => {
  const estrategia = {
    valorInicial: 9000,
    valorMinimo: 7000,
    decrementoMin: 50,
    decrementoPercentual: 1.5,
    maxLances: 20,
    intervaloSegundos: 30,
  };

  it('bloqueia a autorização quando o valor inicial passa do limite', async () => {
    const { unmount } = render(
      <AutorizacaoLanceDialog
        open
        onOpenChange={() => {}}
        estrategia={estrategia}
        limiteFinanceiro={5000}
        edital="PE 90001/2026"
        onAutorizar={() => {}}
      />,
    );

    expect(await screen.findByText(/excede o limite financeiro/i)).toBeInTheDocument();

    const campo = screen.getByLabelText(/AUTORIZO/i);
    fireEvent.change(campo, { target: { value: 'AUTORIZO' } });

    // Mesmo com a confirmação literal digitada, o botão continua travado.
    expect(screen.getByRole('button', { name: /Autorizar Estratégia/ })).toBeDisabled();
    unmount();
  });

  it('libera quando o valor inicial cabe no limite', async () => {
    render(
      <AutorizacaoLanceDialog
        open
        onOpenChange={() => {}}
        estrategia={estrategia}
        limiteFinanceiro={20000}
        edital="PE 90001/2026"
        onAutorizar={() => {}}
      />,
    );

    expect(await screen.findByText(/Dentro do limite financeiro/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/AUTORIZO/i), { target: { value: 'AUTORIZO' } });
    expect(screen.getByRole('button', { name: /Autorizar Estratégia/ })).toBeEnabled();
  });

  it('com limite zerado — o estado do defeito — nem afirma nem nega o teto', async () => {
    render(
      <AutorizacaoLanceDialog
        open
        onOpenChange={() => {}}
        estrategia={estrategia}
        limiteFinanceiro={0}
        edital="PE 90001/2026"
        onAutorizar={() => {}}
      />,
    );

    await screen.findByText(/Revise a estratégia antes de autorizar/i);
    // Era exatamente isto que a tela mostrava antes do conserto: nenhuma das
    // duas faixas. Nada denunciava que a conferência estava desligada.
    expect(screen.queryByText(/excede o limite financeiro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dentro do limite financeiro/i)).not.toBeInTheDocument();
  });
});
