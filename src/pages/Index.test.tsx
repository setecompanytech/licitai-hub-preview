import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';

/**
 * Painel da empresa — os cinco comportamentos que a reestruturação de 13/09
 * firmou e que nenhuma captura de tela alcança (a página exige sessão, empresa
 * ativa e Supabase, e para antes de montar numa conta de teste):
 *
 *  1. as seções aparecem na ORDEM do comando (identificação → pendências →
 *     ferramentas → resumo → agenda → oportunidades);
 *  2. "Personalizar atalhos" liga as estrelas de favoritar do grid;
 *  3. indicador clicável abre a LISTAGEM com o filtro correspondente — e a
 *     listagem mostra a MESMA quantidade que o cartão prometeu, porque contagem
 *     e filtro usam o mesmo predicado (`lib/licitacao/recortes-do-painel`);
 *  4. indicador sem apuração mostra "—", nunca 0 — zero afirmaria um fato que
 *     ninguém mediu ("nenhum edital vigente no país");
 *  5. "Ver todas as ferramentas" dispara o evento que abre o menu global, em
 *     vez de desenhar uma segunda lista de funções.
 */

/* ── Dados de teste ───────────────────────────────────────────────────────
   Os status são os que o app realmente grava, incluindo a grafia minúscula
   ('vencida') que o painel conta como ganho. */
const PROCESSOS = [
  { id: 'p1', numero: 'PE 001/2026', orgao: 'Prefeitura A', status: 'Vencida', data_abertura: null, data_encerramento: null },
  { id: 'p2', numero: 'PE 002/2026', orgao: 'Prefeitura B', status: 'vencida', data_abertura: null, data_encerramento: null },
  { id: 'p3', numero: 'PE 003/2026', orgao: 'Prefeitura C', status: 'Perdida', data_abertura: null, data_encerramento: null },
  { id: 'p4', numero: 'PE 004/2026', orgao: 'Prefeitura D', status: 'Em Disputa', data_abertura: null, data_encerramento: null },
];

const KPIS_ANALYTICS = {
  totalProcessos: PROCESSOS.length,
  ganhas: 2,
  perdidas: 1,
  emAndamento: 1,
  taxaVitoria: 66.7,
  valorTotalGanho: 540000,
  valorEmDisputa: 0,
  pregoes: 4,
  dispensas: 0,
  pregoesGanhos: 2,
  dispensasGanhas: 0,
};

/** Trocado caso a caso — é o que permite testar "não apurado". */
const painel = {
  kpis: {
    licitacoesMonitoradas: null as number | null,
    valorTotalGanho: null as number | null,
    licitacoesHoje: 3,
    editaisAbertos: null as number | null,
    ultimaSincronizacao: null as string | null,
    propostasEnviadas: null as number | null,
    taxaVitoria: null as number | null,
    roiMedio: null as number | null,
  },
  erro: null as string | null,
};

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    kpis: painel.kpis,
    chartMensal: [], chartValor: [], recentes: [], modalidades: [],
    loading: false,
    erro: painel.erro,
    recarregar: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAnalyticsData', () => ({
  useAnalyticsData: () => ({
    kpis: KPIS_ANALYTICS,
    modalidadeBreakdown: [], statusBreakdown: [], ufBreakdown: [], timeline: [],
    licitacoes: PROCESSOS,
    loading: false,
    erro: null,
    recarregar: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVencimentosDeDocumentos', async () => {
  const real = await vi.importActual<typeof import('@/hooks/useVencimentosDeDocumentos')>(
    '@/hooks/useVencimentosDeDocumentos',
  );
  return {
    ...real,
    useVencimentosDeDocumentos: () => ({
      documentos: [],
      carregando: false,
      erro: null,
      recarregar: vi.fn(),
    }),
  };
});

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => ({ canAccessRoute: () => true, isAdmin: true }),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({
    empresaAtiva: { id: 'e1', nome_fantasia: 'Construtora Alfa' },
    todasSelecionadas: false,
    empresas: [],
  }),
}));

/* Cascas: o que estas telas fazem não é assunto deste teste, e todas puxam
   Supabase, portais e diálogos próprios. */
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/shared/CabecalhoPagina', () => ({
  default: ({ titulo, acoes, children }: { titulo: React.ReactNode; acoes?: React.ReactNode; children?: React.ReactNode }) => (
    <header>
      <h1>{titulo}</h1>
      <div>{acoes}</div>
      {children}
    </header>
  ),
}));
vi.mock('@/components/shared/NavegadorDeSecoes', () => ({ default: () => null }));
vi.mock('@/components/relatorios/RelatorioGerencialPDF', () => ({ default: () => null }));
vi.mock('@/components/empresa/EmpresaSelector', () => ({ default: () => null }));
vi.mock('@/components/auth/ColaboradorIdentificacaoModal', () => ({ default: () => null }));
vi.mock('@/components/onboarding/OnboardingWizard', () => ({
  default: () => null,
  useOnboarding: () => ({ showOnboarding: false, dismissOnboarding: vi.fn(), onboardingCarregado: true }),
}));
vi.mock('@/components/onboarding/MascoteBoasVindas', () => ({
  default: () => null,
  useMascoteBoasVindas: () => ({ mascoteAberto: false, fecharMascote: vi.fn() }),
}));

/* A listagem real consulta o Supabase. A casca aqui NÃO reimplementa o filtro:
   ela chama exatamente as mesmas funções que a listagem de verdade chama
   (`recorteDaUrl` + `recorte.aceita`), que são as mesmas que contam o cartão.
   É isso que o caso 3 verifica — que o número prometido e as linhas entregues
   saem do mesmo predicado. */
vi.mock('@/components/dashboard/PainelLicitacoes', async () => {
  const { recorteDaUrl, PARAM_RECORTE } = await vi.importActual<
    typeof import('@/lib/licitacao/recortes-do-painel')
  >('@/lib/licitacao/recortes-do-painel');
  // Nomeada e em maiúscula: a regra `rules-of-hooks` do eslint (que já derrubou
  // esta tela duas vezes em produção) só reconhece hook dentro de componente
  // com nome de componente — `default: () => …` não conta como um.
  function ListagemFalsa() {
    const [params] = useSearchParams();
    const recorte = recorteDaUrl(params.get(PARAM_RECORTE));
    const linhas = PROCESSOS.filter((l) => !recorte || recorte.aceita(l.status));
    return (
      <div data-testid="listagem">
        <p>recorte: {recorte?.id ?? 'nenhum'}</p>
        <p>linhas: {linhas.length}</p>
      </div>
    );
  }
  return { default: ListagemFalsa };
});

import Index from './Index';

/** Mostra a URL corrente, para conferir o destino do indicador clicável. */
function Espiao() {
  const local = useLocation();
  return <p data-testid="url">{`${local.pathname}${local.search}${local.hash}`}</p>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Espiao />
      <Index />
    </MemoryRouter>,
  );

beforeEach(() => {
  window.localStorage.clear();
  painel.kpis = {
    licitacoesMonitoradas: null,
    valorTotalGanho: null,
    licitacoesHoje: 3,
    editaisAbertos: null,
    ultimaSincronizacao: null,
    propostasEnviadas: null,
    taxaVitoria: null,
    roiMedio: null,
  };
  painel.erro = null;
});

describe('Painel da empresa', () => {
  it('mostra as seções na ordem do comando', () => {
    montar();

    expect(screen.getByRole('heading', { level: 1, name: 'Painel da empresa' })).toBeTruthy();

    const secoes = Array.from(document.querySelectorAll('section[data-secao]')).map((s) =>
      s.getAttribute('data-secao'),
    );
    expect(secoes.slice(0, 5)).toEqual([
      'Pendências',
      'Suas ferramentas',
      'Resumo operacional',
      'Agenda e pendências',
      'Oportunidades',
    ]);
  });

  it('"Personalizar atalhos" liga as estrelas de favoritar', () => {
    montar();

    expect(screen.queryAllByRole('button', { name: /aos favoritos$/i })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Personalizar atalhos' }));

    expect(screen.getAllByRole('button', { name: /aos favoritos$/i }).length).toBeGreaterThan(0);
    // E o botão vira a saída do modo, em vez de ficar preso ligado.
    expect(screen.getByRole('button', { name: 'Concluir personalização' })).toBeTruthy();
  });

  it('indicador clicável abre a listagem com o filtro, e a conta bate', () => {
    montar();

    const ganhas = screen.getByRole('link', { name: /^Ganhas: 2\./ });
    fireEvent.click(ganhas);

    expect(screen.getByTestId('url').textContent).toBe(
      '/dashboard?recorte=ganhas#processos-da-empresa',
    );

    const listagem = screen.getByTestId('listagem');
    expect(within(listagem).getByText('recorte: ganhas')).toBeTruthy();
    // As duas grafias de ganho ('Vencida' e 'vencida') — o mesmo 2 do cartão.
    expect(within(listagem).getByText('linhas: 2')).toBeTruthy();
  });

  it('indicador sem apuração mostra "—" e nunca 0', () => {
    // Cache do PNCP ilegível: `editaisAbertos` chega `null`.
    montar();

    const oportunidades = document.querySelector('section[data-secao="Oportunidades"]')!;
    const bloco = within(oportunidades as HTMLElement);
    expect(bloco.getByText('Editais vigentes')).toBeTruthy();
    expect(bloco.getByText('—')).toBeTruthy();
    expect(bloco.queryByText('0')).toBeNull();
    expect(bloco.getByText('Não foi possível ler o cache do PNCP')).toBeTruthy();
  });

  it('indicador que não tem listagem equivalente não vira link', () => {
    montar();

    const resumo = document.querySelector('section[data-secao="Resumo operacional"]')!;
    // Taxa de vitória é razão entre conjuntos: nenhuma listagem a reproduz.
    expect(within(resumo as HTMLElement).queryByRole('link', { name: /Taxa de vitória/ })).toBeNull();
    expect(within(resumo as HTMLElement).getByText('Taxa de vitória')).toBeTruthy();
  });

  it('"Ver todas as ferramentas" dispara o evento do menu global', () => {
    const ouvinte = vi.fn();
    window.addEventListener('praefectus:abrir-ferramentas', ouvinte);

    montar();
    fireEvent.click(screen.getByRole('button', { name: /Ver todas as ferramentas/ }));

    window.removeEventListener('praefectus:abrir-ferramentas', ouvinte);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('erro na carga mostra a mensagem real e oferece nova tentativa', () => {
    painel.erro = 'permission denied for table licitacoes';
    montar();

    expect(screen.getByText('permission denied for table licitacoes')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
  });
});
