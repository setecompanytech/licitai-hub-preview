import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Testes da tela do Robô de Lances — a tela do CLIENTE.
 *
 * ─── O QUE ESTES TESTES GUARDAM, E POR QUE ────────────────────────────────
 *
 *  1. (14/09/2026) A separação entre cliente e plataforma. As abas Agente,
 *     Portais e Configurações mostravam ao administrador da empresa o que é
 *     da operação Praefectus — agente, healthcheck, freio, tela remota,
 *     simulação, auditoria encadeada, fornecedor de IA —, e uma frase falsa
 *     ("Sistema pronto para disputas reais"). Nada disso pode voltar a esta
 *     tela, nem para o administrador da empresa.
 *  2. Ligar/desligar o robô visível a todos e travado para quem só visualiza.
 *  3. Os avisos da operação: o geral aparece; o de portal sem disputa, não.
 *  4. As três colunas da composição aprovada — `data-coluna` sobrevive a CSS.
 *  5. O limite financeiro. Existe por causa de um defeito real: a página
 *     declarava `limiteFinanceiro` sem setter, e a trava do diálogo de
 *     autorização recebia zero para sempre.
 *  6. O painel de participações acima das ferramentas, e os controles que
 *     prometiam o que não faziam, ligados ou renomeados.
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
   lista de dependências: `AtivacaoChecklist` observa `[user, empresaAtiva]`,
   e com identidade nova a cada render o efeito redispara, chama `setItems`,
   renderiza de novo — laço infinito, teste que nunca termina. */
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
// O painel de participações tem testes próprios; aqui ele só precisa existir.
vi.mock('@/hooks/useParticipacoesDoRobo', () => {
  const valor = {
    participacoes: [] as unknown[],
    carregando: false,
    erro: null,
    semEmpresa: false,
    lidoEm: null,
    capacidade: { portaisComLanceLiberado: [] as string[], fonte: 'nao_verificada', verificadaEm: null },
    recarregar: vi.fn(async () => {}),
  };
  return { useParticipacoesDoRobo: () => valor };
});
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(),
  }),
}));

/* ── Dublês de peças pesadas ou que falam com a rede ─────────────────────
   As fábricas de `vi.mock` são içadas para o topo do arquivo: nada de
   variável declarada aqui fora pode ser CHAMADA dentro delas.

   `EstrategiaIAPanel` NÃO é dublado: é o componente real que tem de chegar
   sem o selo do fornecedor de IA. */
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
vi.mock('@/components/robo-lances/DisputasResumo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/ExportarResultados', () => ({
  default: () => <button type="button">Exportar</button>,
}));
vi.mock('@/components/robo-lances/NivelAutomacaoSelector', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/AceiteTermosDialog', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PainelRisco', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/ConferenciaDosItens', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/PedidoDoRobo', () => ({ default: () => null }));
vi.mock('@/components/robo-lances/CredenciaisPortalForm', () => ({ default: () => null }));
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
import { toast } from 'sonner';

/**
 * O painel guarda aba e busca na URL — a página precisa de um roteador. E a
 * situação do robô e os avisos vêm pelo react-query — precisa de um cliente,
 * novo a cada teste para um não herdar o cache do outro.
 */
function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={['/robo-lances']}>
        <RoboLances />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
  // `clearAllMocks` não desfaz implementação trocada por um teste.
  invoke.mockImplementation(async () => ({ data: null, error: null }));
  papel.isAdmin = true;
  papel.podeOperar = true;
  papel.isViewer = false;
  papel.papel = 'admin';
});

describe('RoboLances — a tela do cliente não mostra o que é da plataforma', () => {
  it('não tem as abas Agente, Portais e Configurações — nem para o administrador da empresa', async () => {
    renderizar();
    await screen.findByRole('button', { name: /PE 90001\/2026/ });

    expect(screen.queryByRole('tab', { name: /^Agente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Portais/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Configurações/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /^Disputar/ })).not.toBeInTheDocument();
  });

  it('não afirma "Sistema pronto", não tem "Regras de lance" nem o nome do fornecedor de IA', async () => {
    renderizar();
    await selecionarDisputa();

    // O painel de estratégia REAL está na tela — a ausência do selo vale.
    expect(await screen.findByText('Estratégia Preditiva IA')).toBeInTheDocument();
    expect(screen.queryByText(/Gemini/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sistema pronto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Regras de lance/i)).not.toBeInTheDocument();
  });

  it('o checklist do cliente não traz conexão, prontidão do agente, freio nem slots', async () => {
    renderizar();
    await selecionarDisputa();

    expect(await screen.findByText('Autenticação')).toBeInTheDocument();
    expect(screen.queryByText('Conexão')).not.toBeInTheDocument();
    expect(screen.queryByText('Prontidão do robô')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sinal de vida|Slots Disponíveis|Freio de emergência verificado|Portais respondendo/)).not.toBeInTheDocument();

    // Os três blocos do painel da direita continuam.
    expect(screen.getByText('Limites')).toBeInTheDocument();
    expect(screen.getByText('Estado da sessão')).toBeInTheDocument();
    expect(screen.getAllByText('Eventos').length).toBeGreaterThan(0);
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

describe('RoboLances — recusa do envio ao robô', () => {
  /** A resposta não-2xx do supabase-js: frase genérica em `message`, corpo em `context`. */
  function recusa(status: number, corpo: unknown) {
    return {
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status, json: async () => corpo },
      },
    };
  }

  async function enviar() {
    respostas.robo_lances_disputas = { data: [{ ...DISPUTA, portal: 'Compras.gov.br' }], error: null };
    renderizar();
    await selecionarDisputa();
    fireEvent.click(screen.getByRole('button', { name: /Enviar ao robô/ }));
  }

  it('409 (robô desligado): mostra a frase do servidor e relê o liga/desliga', async () => {
    invoke.mockImplementation((async (nome: string) =>
      nome === 'robo-lances-webhook/enviar-sessao'
        ? recusa(409, { success: false, error: 'O robô de lances desta empresa está desligado.' })
        : { data: null, error: null }) as never);
    await enviar();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('O robô de lances desta empresa está desligado.', expect.anything()),
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/non-2xx/), expect.anything());
  });

  it('502 sem corpo legível: frase para o cliente, nunca "non-2xx status code"', async () => {
    invoke.mockImplementation((async (nome: string) =>
      nome === 'robo-lances-webhook/enviar-sessao' ? recusa(502, null) : { data: null, error: null }) as never);
    await enviar();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/não aceitou a sessão/),
        expect.anything(),
      ),
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/non-2xx/), expect.anything());
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
    // O contador do botão conta os dois: a lista completa mora nele.
    expect(screen.getByRole('button', { name: /Avisos/ })).toHaveTextContent('2');

    // Acima do painel de participações.
    const faixa = container.querySelector('[data-faixa="avisos"]');
    const painel = container.querySelector('[data-painel="participacoes"]');
    expect(faixa).toBeTruthy();
    expect(painel).toBeTruthy();
    expect(faixa!.compareDocumentPosition(painel!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('RoboLances — papel na disputa', () => {
  it('esconde "Nova sessão" e "Enviar ao robô" de quem só visualiza, dizendo por quê', async () => {
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    papel.papel = 'viewer';
    renderizar();
    await selecionarDisputa();

    expect(screen.queryByRole('button', { name: /Nova sessão/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar ao robô/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assistir ao vivo/ })).not.toBeInTheDocument();
    // Ausência sem explicação é indistinguível de defeito.
    expect(screen.getAllByText(/modo leitura/i).length).toBeGreaterThan(0);
  });

  it('o operador envia ao robô, mas não tem "Assistir ao vivo" nem trilha de auditoria', async () => {
    renderizar();
    await selecionarDisputa();

    expect(screen.getByRole('button', { name: /Enviar ao robô/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assistir ao vivo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /trilha de auditoria/i })).not.toBeInTheDocument();
  });
});

describe('RoboLances — as três colunas', () => {
  it('desenha sessões à esquerda, sessão selecionada no centro e controle à direita', async () => {
    const { container } = renderizar();
    await selecionarDisputa();

    expect(container.querySelector('[data-coluna="sessoes"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="sessao-selecionada"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="controle"]')).toBeTruthy();
  });

  it('mantém as três colunas mesmo sem disputa selecionada', async () => {
    const { container } = renderizar();
    await screen.findByRole('button', { name: /PE 90001\/2026/ });

    expect(container.querySelector('[data-coluna="sessoes"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="sessao-selecionada"]')).toBeTruthy();
    expect(container.querySelector('[data-coluna="controle"]')).toBeTruthy();
  });

  it('o painel de eventos tem só Mural e Operações — Simulação e Auditoria são da plataforma', async () => {
    renderizar();
    await selecionarDisputa();

    expect(screen.getByRole('tab', { name: /Mural/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Operações/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Simulação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Auditoria/ })).not.toBeInTheDocument();
  });
});

describe('RoboLances — limite financeiro (o defeito da trava que não travava)', () => {
  it('lê o limite do aceite vigente e o entrega ao diálogo de autorização', async () => {
    renderizar();
    await selecionarDisputa();

    await waitFor(() => {
      expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '5000');
    });
  });

  it('mostra o limite na coluna da direita em vez de um número inventado', async () => {
    renderizar();
    await selecionarDisputa();

    expect(await screen.findByText('Limite financeiro autorizado')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*5\.000,00/)).toBeInTheDocument();
  });

  it('sem aceite vigente não afirma "R$ 0,00" — declara a ausência e a razão', async () => {
    respostas.robo_aceite_termos = { data: [], error: null };
    renderizar();
    await selecionarDisputa();

    await waitFor(() => {
      expect(screen.getByTestId('autorizacao-dialog')).toHaveAttribute('data-limite', '0');
    });
    expect(screen.getByText(/Nenhum aceite vigente/i)).toBeInTheDocument();
  });
});

describe('RoboLances — painel de participações e controles honestos', () => {
  it('abre com o painel de participações acima das ferramentas', async () => {
    const { container } = renderizar();

    expect(await screen.findByRole('heading', { name: 'Participações do robô' })).toBeInTheDocument();
    const painel = container.querySelector('[data-painel="participacoes"]');
    const colunas = container.querySelector('[data-coluna="sessoes"]');
    expect(painel).toBeTruthy();
    expect(colunas).toBeTruthy();
    expect(painel!.compareDocumentPosition(colunas!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a busca de itens filtra a tabela, e não há mais "Enviar lance" por item', async () => {
    const item = (numero: number, descricao: string) => ({
      numero, lote: null, descricao, quantidade: 10, unidade: 'UN',
      valorReferencia: 5, valorMinimo: 4, situacao: 'aguardando', disputando: false,
    });
    respostas.robo_lances_disputas = {
      data: [{ ...DISPUTA, itens: [item(1, 'Caneta esferográfica azul'), item(2, 'Papel A4')] }],
      error: null,
    };
    renderizar();
    await selecionarDisputa();

    expect(screen.getByText('Caneta esferográfica azul')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Buscar item/), { target: { value: 'papel' } });
    expect(screen.queryByText('Caneta esferográfica azul')).not.toBeInTheDocument();
    expect(screen.getByText('Papel A4')).toBeInTheDocument();
    expect(screen.queryByText('Enviar lance')).not.toBeInTheDocument();
  });

  it('o menu diz que marcar a fase não inicia nem para o robô', async () => {
    renderizar();
    await selecionarDisputa();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Ações' }), { key: 'Enter' });
    expect(await screen.findByText('Marcar como em disputa (manual)')).toBeInTheDocument();
    expect(screen.getByText(/Não inicia nem para o robô/)).toBeInTheDocument();
    expect(screen.queryByText(/Iniciar disputa/)).not.toBeInTheDocument();
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
