import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Compromissos virou tabela + painel em 13/09 (composição do
 * `docs/padrao-visual-gestao.md`). Estes casos travam o que a mudança de
 * apresentação NÃO podia levar junto: as oito abas com as strings exatas, a
 * lista dos compromissos, o detalhe que abre ao selecionar, e o motivo
 * obrigatório antes de remover — que é o que alimenta `processos_exclusao_log`
 * e, sem ele, transformaria remoção em "sumiu sem rastro".
 *
 * A captura automatizada não chega aqui: a tela exige sessão e empresa, então
 * os contextos, o Supabase e a IA entram mockados.
 */

const DAQUI_A_DEZ_DIAS = new Date(Date.now() + 10 * 86400000).toISOString();

const COMPROMISSOS = [
  {
    id: 'p1',
    empresa_id: 'e1',
    numero: '044/2026',
    orgao: 'Prefeitura de Ananindeua',
    objeto: 'Aquisição de material de expediente para as unidades administrativas',
    modalidade: 'Pregão Eletrônico',
    valor_estimado: 125000,
    uf: 'PA',
    municipio: 'Ananindeua',
    data_abertura: null,
    data_encerramento: DAQUI_A_DEZ_DIAS,
    portal: 'PNCP',
    url: 'https://exemplo.gov.br/edital',
    status: 'interessado',
    aprovado_usuario: false,
    auto_cadastro: false,
    preco_validado: false,
    alerta_email: true,
    alerta_whatsapp: false,
    alerta_sistema: true,
    ia_recomendacao: null,
    ia_score: 78,
    notas: null,
    licitacao_id: 'lic-1',
    created_at: '2026-09-01T12:00:00Z',
  },
  {
    id: 'p2',
    empresa_id: 'e1',
    numero: '090/2026',
    orgao: 'Secretaria de Educação',
    objeto: 'Registro de preços para gêneros alimentícios',
    modalidade: 'Pregão Eletrônico',
    valor_estimado: null,
    uf: 'PA',
    municipio: 'Belém',
    data_abertura: null,
    data_encerramento: null,
    portal: null,
    url: null,
    status: 'aprovado',
    aprovado_usuario: true,
    auto_cadastro: false,
    preco_validado: false,
    alerta_email: false,
    alerta_whatsapp: false,
    alerta_sistema: true,
    ia_recomendacao: null,
    // Sem análise: a coluna tem que dizer "indisponível", nunca 0%.
    ia_score: null,
    notas: null,
    licitacao_id: null,
    created_at: '2026-09-02T12:00:00Z',
  },
];

const dadosPorTabela: Record<string, unknown[]> = {
  processos_interesse: COMPROMISSOS,
  processos_exclusao_log: [],
};

/** Cadeia do supabase-js: todo método devolve a si mesma e o `await` resolve. */
function criarCadeia(tabela: string) {
  const resultado = { data: dadosPorTabela[tabela] ?? [], error: null };
  const cadeia: Record<string, unknown> = {};
  for (const metodo of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single',
  ]) {
    cadeia[metodo] = vi.fn(() => cadeia);
  }
  cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, erro);
  return cadeia;
}

const canal = { on: vi.fn(() => canal), subscribe: vi.fn(() => canal) };

/**
 * Os valores dos contextos precisam ser os MESMOS objetos a cada render.
 * `carregarProcessos` é um `useCallback` que depende de `user` e do
 * queryClient; devolvendo `{ user: { id } }` novo a cada chamada, a
 * dependência muda em todo render, o efeito de carga dispara de novo e a tela
 * fica presa no esqueleto para sempre. No app isso não acontece porque o
 * `value` do provider é memorizado — é o mock que precisa imitar essa
 * estabilidade. `vi.hoisted` existe porque as fábricas de `vi.mock` sobem para
 * o topo do arquivo e rodam antes das constantes comuns.
 */
const { AUTH, EMPRESA, INTEGRACAO, QUERY_CLIENT } = vi.hoisted(() => ({
  AUTH: { user: { id: 'u1' } },
  EMPRESA: {
    empresas: [{ empresa_id: 'e1', empresa: { nome_fantasia: 'Ethos', razao_social: 'Ethos LTDA' } }],
  },
  INTEGRACAO: { arquivarProcesso: () => Promise.resolve(true) },
  QUERY_CLIENT: { getQueryData: () => undefined, setQueryData: () => undefined },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((tabela: string) => criarCadeia(tabela)),
    channel: vi.fn(() => canal),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));

vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => EMPRESA }));

vi.mock('@/hooks/useLicitacaoIntegration', () => ({
  useLicitacaoIntegration: () => INTEGRACAO,
}));

vi.mock('@/lib/ai-stream', () => ({ streamAIChat: vi.fn() }));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => QUERY_CLIENT }));

import MeusCompromissos from './MeusCompromissos';

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/meus-compromissos']}>
      <MeusCompromissos />
    </MemoryRouter>,
  );

/** Espera a primeira carga e devolve a linha do processo 044/2026. */
async function abrirPrimeiraLinha() {
  const rotulo = await screen.findByText('Pregão Eletrônico nº 44/2026');
  fireEvent.click(rotulo);
  return rotulo;
}

describe('MeusCompromissos — tabela, abas e painel', () => {
  it('mantém as oito abas, com os rótulos exatos', async () => {
    montar();
    await screen.findByText('Pregão Eletrônico nº 44/2026');

    const abas = screen.getAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual([
      'Todos',
      'Interessado',
      'IA Analisando',
      'Aprovado',
      'Cadastrado',
      'Rejeitado',
      'Arquivado',
      'Removidos',
    ]);
  });

  it('lista os compromissos na tabela, com decisão e prazo em colunas separadas', async () => {
    montar();
    await screen.findByText('Pregão Eletrônico nº 44/2026');

    // Cabeçalhos: a decisão de participar e o prazo do edital não dividem coluna.
    expect(screen.getByRole('columnheader', { name: /Decisão/ })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: /Prazo/ })).toBeTruthy();

    // As duas linhas, pelo órgão de cada uma.
    expect(screen.getByText('Prefeitura de Ananindeua')).toBeTruthy();
    expect(screen.getByText('Secretaria de Educação')).toBeTruthy();

    // Score ausente não vira 0%.
    expect(screen.getByText('78%')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.getAllByText('Sem análise').length).toBeGreaterThan(0);
  });

  it('dá acesso ao processo relacionado quando existe vínculo', async () => {
    montar();
    await screen.findByText('Pregão Eletrônico nº 44/2026');

    const link = screen.getByRole('link', { name: /Abrir o processo 044\/2026 na gestão/ });
    expect(link.getAttribute('href')).toBe('/processo/lic-1');
  });

  it('selecionar a linha abre o painel de detalhes', async () => {
    montar();
    expect(screen.queryByText('Canais de alerta')).toBeNull();

    await abrirPrimeiraLinha();

    // Blocos que só existem no painel.
    expect(screen.getByText('Canais de alerta')).toBeTruthy();
    expect(screen.getByText('Identificação')).toBeTruthy();
    // O objeto inteiro, que na tabela aparece truncado.
    expect(
      screen.getAllByText('Aquisição de material de expediente para as unidades administrativas').length,
    ).toBeGreaterThan(0);
  });

  it('o diálogo de remover exige motivo antes de confirmar', async () => {
    montar();
    await abrirPrimeiraLinha();

    fireEvent.click(screen.getByRole('button', { name: /^Remover$/ }));

    const dialogo = await screen.findByRole('dialog', { name: /Remover processo/ });
    const confirmar = within(dialogo).getByRole('button', { name: /Confirmar Remoção/ });
    expect(confirmar).toBeDisabled();

    fireEvent.change(within(dialogo).getByLabelText(/Motivo/), {
      target: { value: 'Fora do escopo da empresa' },
    });
    expect(confirmar).not.toBeDisabled();
  });
});
