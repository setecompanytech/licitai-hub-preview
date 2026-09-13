import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LicitacoesEstrategicas from './LicitacoesEstrategicas';
import type { LicitacaoEstrategica } from '@/hooks/useLicitacoesEstrategicas';

/**
 * A tela saiu da grade de cartões expansíveis para tabela + painel lateral
 * (reestruturação de 13/09). Três coisas precisam continuar valendo depois
 * disso, e nenhuma delas aparece em captura automatizada — a rota exige sessão
 * e empresa ativa, que a conta de teste não tem:
 *
 *  1. a lista carregada chega à TABELA, não a cartões;
 *  2. selecionar uma linha abre o painel de detalhes daquela linha;
 *  3. indicador sem apuração aparece como indisponível, nunca como 0 — que é
 *     o caso do caminho de contingência do hook, onde os quatro scores são
 *     fixos em 50 e não foram calculados.
 */

const { estado } = vi.hoisted(() => ({
  estado: {
    licitacoes: [] as LicitacaoEstrategica[],
    loading: false,
    fonteClassificacao: null as 'ia' | 'fallback' | null,
    recarregar: vi.fn(),
  },
}));

vi.mock('@/hooks/useLicitacoesEstrategicas', () => ({
  useLicitacoesEstrategicas: () => estado,
}));

// A moldura exige AuthContext/EmpresaContext e não é o objeto do teste.
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// Os dois disparam chamadas de IA/Supabase ao montar.
vi.mock('@/components/aurelia/AureliaEditalPanel', () => ({
  default: () => <div data-testid="aurelia" />,
}));
vi.mock('@/components/licitacoes/AnaliseCapag', () => ({
  default: () => <div data-testid="capag" />,
}));

const oportunidade = (over: Partial<LicitacaoEstrategica> = {}): LicitacaoEstrategica => ({
  id: 'a1',
  numero: 'PNCP-2026-000001',
  orgao: 'Prefeitura Municipal de Belém',
  objeto: 'Aquisição de equipamentos de informática',
  valor: 250000,
  uf: 'PA',
  municipio: 'Belém',
  modalidade: 'Pregão Eletrônico',
  dataAbertura: '2026-10-01T13:00:00.000Z',
  linkOrigem: 'https://pncp.gov.br/edital',
  fonte: 'PNCP',
  scoreRelevancia: 82,
  scoreViabilidade: 74,
  scoreConcorrencia: 61,
  scoreGeral: 76,
  fatoresPositivos: ['Objeto aderente ao CNAE'],
  fatoresRisco: ['Prazo de entrega curto'],
  recomendacao: 'alta',
  salva: false,
  ...over,
});

const montar = () =>
  render(
    <MemoryRouter>
      <LicitacoesEstrategicas />
    </MemoryRouter>,
  );

beforeEach(() => {
  estado.licitacoes = [];
  estado.loading = false;
  estado.fonteClassificacao = 'ia';
  estado.recarregar.mockReset();
  // O painel lateral só existe a partir de 1280px (useLarguraMinima); sem
  // isto o detalhe cairia na gaveta e o teste mediria outra composição.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1280px'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('Licitações estratégicas — tabela e painel', () => {
  it('lista as oportunidades na tabela, com as colunas do padrão', () => {
    estado.licitacoes = [
      oportunidade(),
      oportunidade({ id: 'b2', numero: 'PNCP-2026-000002', recomendacao: 'media', scoreGeral: 48 }),
    ];
    montar();

    const tabela = screen.getByRole('table');
    for (const coluna of ['Score', 'Recomendação', 'Número / Objeto', 'Órgão', 'Valor estimado', 'Abertura']) {
      expect(within(tabela).getByText(coluna)).toBeTruthy();
    }
    expect(within(tabela).getByText('PNCP-2026-000001')).toBeTruthy();
    expect(within(tabela).getByText('PNCP-2026-000002')).toBeTruthy();
    // Ordenação inicial por score, do maior para o menor.
    const numeros = within(tabela)
      .getAllByText(/^PNCP-2026-/)
      .map((el) => el.textContent);
    expect(numeros).toEqual(['PNCP-2026-000001', 'PNCP-2026-000002']);
  });

  it('selecionar a linha abre o painel de detalhes daquela oportunidade', () => {
    estado.licitacoes = [oportunidade(), oportunidade({ id: 'b2', numero: 'PNCP-2026-000002' })];
    montar();

    // Fechado, o painel não existe — nada de detalhe pré-montado na página.
    expect(screen.queryByText('Scores da análise')).toBeNull();

    fireEvent.click(screen.getByText('PNCP-2026-000001'));

    const painel = screen.getByRole('complementary', { name: /PNCP-2026-000001/ });
    expect(within(painel).getByText('Scores da análise')).toBeTruthy();
    expect(within(painel).getByText('Fatores positivos')).toBeTruthy();
    expect(within(painel).getByText('Objeto aderente ao CNAE')).toBeTruthy();
    expect(within(painel).getByText('Prazo de entrega curto')).toBeTruthy();
    // A Aurélia é sob demanda: selecionar a linha não dispara as análises.
    expect(screen.queryByTestId('aurelia')).toBeNull();
    expect(within(painel).getByText('Analisar com a Aurélia')).toBeTruthy();
  });

  it('sem classificação por IA, o score não vira 50 nem 0 — vira indisponível', () => {
    // O caminho de contingência do hook: quatro scores fixos em 50 e
    // recomendação fixa em "media", sem nenhum cálculo por trás.
    estado.fonteClassificacao = 'fallback';
    estado.licitacoes = [
      oportunidade({
        scoreRelevancia: 50,
        scoreViabilidade: 50,
        scoreConcorrencia: 50,
        scoreGeral: 50,
        recomendacao: 'media',
      }),
    ];
    montar();

    const scoreMedio = screen.getByText('Score médio').parentElement!;
    expect(scoreMedio.textContent).toContain('—');
    expect(scoreMedio.textContent).toContain('Sem classificação por IA');
    expect(scoreMedio.textContent).not.toContain('50');

    // O contador de recomendação alta também não afirma zero: nada foi apurado.
    const recomendacaoAlta = screen.getByText('Recomendação alta').parentElement!;
    expect(recomendacaoAlta.textContent).toContain('—');
    expect(recomendacaoAlta.textContent).not.toMatch(/(^|\s)0(\s|$)/);

    // E a tabela diz o mesmo, linha a linha.
    const tabela = screen.getByRole('table');
    expect(within(tabela).getAllByText('Não calculado').length).toBeGreaterThan(0);
    expect(within(tabela).getByText('Não classificada')).toBeTruthy();
    expect(within(tabela).queryByText('50')).toBeNull();

    expect(screen.getByText('Classificação por IA indisponível nesta carga')).toBeTruthy();
  });

  it('valor não informado não é somado como zero no indicador', () => {
    estado.licitacoes = [oportunidade({ valor: 0 })];
    montar();

    const valor = screen.getByText('Valor estimado somado').parentElement!;
    expect(valor.textContent).toContain('—');
    expect(valor.textContent).toContain('Nenhum valor informado');
    expect(valor.textContent).not.toContain('R$');
  });

  it('durante a primeira carga os indicadores não afirmam zero', () => {
    estado.loading = true;
    estado.fonteClassificacao = null;
    montar();

    const listadas = screen.getByText('Oportunidades listadas').parentElement!;
    expect(listadas.textContent).toContain('—');
    expect(listadas.textContent).not.toMatch(/(^|\s)0(\s|$)/);
    expect(screen.getByText('Analisando licitações com IA...')).toBeTruthy();
  });

  it('estado vazio oferece a recarga em vez de uma tabela sem linhas', () => {
    montar();
    expect(screen.getByText('Nenhuma licitação estratégica encontrada')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('o CAPAG do painel leva para a aba CAPAG, separando o que foi consultado da leitura da IA', () => {
    estado.licitacoes = [oportunidade()];
    montar();

    fireEvent.click(screen.getByText('PNCP-2026-000001'));
    fireEvent.click(screen.getByText('CAPAG do órgão'));

    // Antes, o botão preenchia a consulta numa aba que continuava escondida.
    expect(screen.getByText('Dados consultados')).toBeTruthy();
    expect(screen.getByText('Fonte, período e interpretação da IA')).toBeTruthy();
    expect(screen.getByLabelText('Órgão / ente')).toHaveValue('Prefeitura Municipal de Belém');
    expect(screen.getByTestId('capag')).toBeTruthy();
  });
});
