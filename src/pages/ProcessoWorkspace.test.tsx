import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * O dossiê do processo — o que as reestruturações de 13/09 e 14/09 não podem
 * perder.
 *
 * Estes casos existem porque a verificação visual não chega aqui: a tela pede
 * sessão, empresa ativa e um processo de verdade no banco, e na captura
 * automatizada ela para antes de montar. O que travamos:
 *
 *  - as SETE abas, com os rótulos exatos e na ordem de 14/09: Visão geral,
 *    Documentos, Habilitação, Precificação, Proposta, Robô de Lances, Histórico;
 *  - os endereços antigos (`?aba=anexos`, `?aba=modulos`) continuam levando ao
 *    conteúdo que procuravam, corrigidos com `replace` — sem entrada nova no
 *    histórico;
 *  - trocar de aba ESCREVE na URL. Este é o defeito que a reestruturação de
 *    13/09 veio corrigir: a URL era lida (`?aba=`) e nunca escrita, então
 *    clicar numa aba não mudava o endereço, o voltar do navegador não devolvia
 *    a aba e o F5 jogava todo mundo de volta na Visão geral;
 *  - o objeto extenso NÃO fica no cabeçalho — ele desce para o Resumo;
 *  - "não conseguimos carregar" e "não existe" são telas diferentes. Antes o
 *    `error` da consulta era descartado e a queda do banco mandava a pessoa
 *    procurar no Kanban um processo que está lá.
 */

// ── Dublês ────────────────────────────────────────────────────────────────

type Resposta = { data: unknown; error: unknown };
const respostas: Record<string, Resposta> = {};

/** Construtor de consulta encadeável: todo método devolve a si mesmo, e o
 *  objeto é "thenable" — serve tanto ao `.then(...)` quanto ao `await`. */
const criarQuery = (tabela: string) => {
  const resolver = () => Promise.resolve(respostas[tabela] ?? { data: null, error: null });
  const q: Record<string, unknown> = {};
  for (const metodo of [
    'select', 'eq', 'neq', 'order', 'limit', 'insert', 'update', 'delete',
    'in', 'gte', 'lte', 'ilike', 'or', 'filter', 'range', 'maybeSingle', 'single',
  ]) {
    q[metodo] = () => q;
  }
  q.then = (ok: unknown, falha: unknown) =>
    resolver().then(ok as never, falha as never);
  q.catch = (f: unknown) => resolver().catch(f as never);
  q.finally = (f: unknown) => resolver().finally(f as never);
  return q;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => criarQuery(tabela),
    // O espelho ao vivo do PNCP fica fora do ar nestes casos: o que se mede
    // aqui é a moldura do dossiê, não a cadeia de fallback do portal.
    functions: { invoke: () => Promise.resolve({ data: null, error: new Error('offline') }) },
  },
}));

vi.mock('@/contexts/AuthContext', () => {
  // O `user` precisa ser o MESMO objeto a cada render: ele é dependência do
  // efeito de carga, e um literal novo por chamada refaz a consulta para
  // sempre. O contexto de verdade guarda a sessão em estado; o dublê imita
  // isso guardando a referência aqui fora.
  const user = { id: 'user-1' };
  return { useAuth: () => ({ user }) };
});

vi.mock('@/hooks/useProcessoWorkspace', () => ({
  useProcessoWorkspace: () => ({ anexos: [], documentos: [] }),
}));

/** A moldura real traz coluna, faixa, notificações e busca global — nada
 *  disso está sob teste. O dublê preserva o que importa para o dossiê: os
 *  filhos e os degraus que a página põe na trilha da faixa. */
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children, trilhaExtra }: { children: ReactNode; trilhaExtra?: { rotulo: string }[] }) => (
    <div>
      <nav data-testid="trilha">{(trilhaExtra ?? []).map((d) => d.rotulo).join(' › ')}</nav>
      {children}
    </div>
  ),
}));

/* Os filhos do dossiê entram como marcadores: cada um tem os próprios testes,
   e montá-los de verdade traria jsPDF, JSZip e mais quatro consultas para
   dentro de um caso que mede a moldura. `vi.mock` é içado para o topo do
   arquivo, então a fábrica não pode chamar um ajudante declarado aqui fora. */
vi.mock('@/components/workspace/DesfechoDaDisputa', () => ({ default: () => <div data-testid="desfecho" /> }));
vi.mock('@/components/workspace/ContratoDoProcesso', () => ({ default: () => <div data-testid="contrato" /> }));
vi.mock('@/components/workspace/HistoricoProcesso', () => ({ default: () => <div data-testid="historico" /> }));
vi.mock('@/components/workspace/ItensEditalPrecificacao', () => ({ default: () => <div data-testid="itens-precificacao" /> }));
vi.mock('@/components/workspace/HabilitacaoChecklist', () => ({ default: () => <div data-testid="habilitacao" /> }));
vi.mock('@/components/workspace/AnexosManager', () => ({ default: () => <div data-testid="anexos" /> }));
vi.mock('@/components/workspace/DocumentosManager', () => ({ default: () => <div data-testid="documentos" /> }));
vi.mock('@/components/workspace/EditalOriginalCard', () => ({ default: () => <div data-testid="edital-original" /> }));
vi.mock('@/components/workspace/EditalViewer', () => ({ default: () => <div data-testid="edital-viewer" /> }));
vi.mock('@/components/workspace/precificacao/AprovacaoDePrecificacao', () => ({
  default: () => <div data-testid="aprovacao-precificacao" />,
}));
vi.mock('@/components/workspace/robo/AbaRoboDoProcesso', () => ({
  default: ({ licitacaoId, empresaId }: { licitacaoId: string; empresaId: string | null }) => (
    <div data-testid="robo" data-licitacao={licitacaoId} data-empresa={empresaId ?? ''} />
  ),
}));
vi.mock('@/pages/PropostaTecnica', () => ({ default: () => <div data-testid="proposta" /> }));
vi.mock('@/components/precificacao/AureliaPrecificacaoChat', () => ({ default: () => <div data-testid="aurelia" /> }));
vi.mock('@/components/workspace/exportarPasta', () => ({ exportarPastaZip: vi.fn() }));

import ProcessoWorkspace from './ProcessoWorkspace';

// ── Dados ─────────────────────────────────────────────────────────────────

/** Objeto de edital de verdade: longo o bastante para o comando proibir que
 *  ele apareça no cabeçalho. Caixa mista de propósito — `objetoLegivel` só
 *  rebaixa texto GRITADO, e aqui queremos comparar o mesmo texto nos dois
 *  lugares. */
const OBJETO_EXTENSO =
  'Contratação de empresa especializada na prestação de serviços continuados de '
  + 'limpeza, asseio e conservação predial, com fornecimento de mão de obra, '
  + 'materiais de consumo, equipamentos e insumos necessários à execução das '
  + 'atividades nas dependências das unidades administrativas e escolares, '
  + 'conforme condições e exigências estabelecidas no Termo de Referência.';

const PROCESSO = {
  id: 'lic-1',
  numero: '90014/2025',
  orgao: 'Prefeitura Municipal de Exemplo',
  objeto: OBJETO_EXTENSO,
  modalidade: 'Pregão Eletrônico',
  status: 'Em análise',
  valor_estimado: 1250000,
  data_encerramento: '2026-10-01T10:00:00',
  uf: 'PA', municipio: 'Belém',
  data_abertura: '2026-09-20T09:00:00',
  portal: 'PNCP', url_edital: null,
  observacoes: null, resultado: null, valor_adjudicado: null,
  data_homologacao: null, vencedor: null,
  numero_controle_pncp: null, cnpj_orgao: null,
  ano_compra: null, sequencial_compra: null,
  empresa_id: 'emp-1',
  operador_id: 'user-9',
};

const ROTULOS_DAS_ABAS = [
  'Visão geral', 'Documentos', 'Habilitação',
  'Precificação', 'Proposta', 'Robô de Lances', 'Histórico',
];

// ── Montagem ──────────────────────────────────────────────────────────────

let buscaAtual = '';
let tipoDeNavegacao = '';

function EspiaDaUrl() {
  const { search } = useLocation();
  buscaAtual = search;
  tipoDeNavegacao = useNavigationType();
  return null;
}

/** Ativa uma aba como o mouse ativa: a fila de abas é Radix, e ela troca de
 *  painel no `mousedown` — um `click` sintético sozinho não a move. */
const clicarNaAba = (rotulo: RegExp) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: rotulo }));

const montar = (entrada = '/processo/lic-1') => {
  buscaAtual = '';
  tipoDeNavegacao = '';
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <EspiaDaUrl />
      <Routes>
        <Route path="/processo/:id" element={<ProcessoWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  for (const chave of Object.keys(respostas)) delete respostas[chave];
  respostas.licitacoes = { data: PROCESSO, error: null };
  respostas.profiles = { data: { user_id: 'user-9', nome_completo: 'Ana Souza', username: 'ana' }, error: null };
});

// ── Casos ─────────────────────────────────────────────────────────────────

describe('ProcessoWorkspace — o dossiê do processo', () => {
  it('tem as sete abas, com os rótulos exatos e na ordem', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão geral/ });
    const abas = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(abas).toHaveLength(7);
    // `startsWith` porque Documentos carrega a contagem ao lado do rótulo.
    ROTULOS_DAS_ABAS.forEach((rotulo, i) => expect(abas[i].startsWith(rotulo)).toBe(true));
    expect(screen.queryByRole('tab', { name: /Anexos/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Módulos/ })).toBeNull();
  });

  it('leva a aba para a URL ao clicar — o defeito que a reestruturação corrige', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão geral/ });
    // A Visão geral é o padrão e por isso é OMITIDA da URL: `?aba=visao` e a
    // URL limpa significam a mesma coisa, e duas escritas sujariam o histórico.
    expect(buscaAtual).toBe('');

    clicarNaAba(/Documentos/);
    await waitFor(() => expect(buscaAtual).toContain('aba=documentos'));

    clicarNaAba(/Robô de Lances/);
    await waitFor(() => expect(buscaAtual).toContain('aba=robo'));

    clicarNaAba(/Histórico/);
    await waitFor(() => expect(buscaAtual).toContain('aba=historico'));

    // E o caminho de volta: ao padrão, o parâmetro sai da URL.
    clicarNaAba(/Visão geral/);
    await waitFor(() => expect(buscaAtual).not.toContain('aba='));
  });

  it('abre na aba que a URL pediu — é o que faz o F5 e o voltar caírem no lugar', async () => {
    montar('/processo/lic-1?aba=proposta');
    expect(await screen.findByTestId('proposta')).toBeTruthy();
    expect(screen.queryByTestId('habilitacao')).toBeNull();
  });

  it('?aba=anexos (links antigos) abre Documentos e corrige a URL sem entrada no histórico', async () => {
    montar('/processo/lic-1?aba=anexos');
    // O conteúdo de Anexos aparece já na primeira pintura, dentro de Documentos.
    expect(await screen.findByTestId('anexos')).toBeTruthy();
    expect(screen.getByTestId('documentos')).toBeTruthy();
    await waitFor(() => expect(buscaAtual).toContain('aba=documentos'));
    expect(tipoDeNavegacao).toBe('REPLACE');
    expect(screen.getByRole('tab', { name: /Documentos/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('?aba=modulos (links antigos) abre a Visão geral, onde os atalhos passaram a morar', async () => {
    montar('/processo/lic-1?aba=modulos');
    expect(await screen.findByText('Abrir nos módulos')).toBeTruthy();
    await waitFor(() => expect(buscaAtual).not.toContain('aba='));
    expect(tipoDeNavegacao).toBe('REPLACE');
    expect(screen.getByRole('tab', { name: /Visão geral/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('cada uma das sete abas entrega o conteúdo que promete', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão geral/ });

    // Visão geral: desfecho, ficha e os atalhos da antiga aba Módulos.
    expect(screen.getByTestId('desfecho')).toBeTruthy();
    expect(screen.getByText('Abrir nos módulos')).toBeTruthy();
    // Os oito atalhos, todos levando o processo junto em `?lid=`.
    const atalhos = screen.getAllByRole('link').filter((a) =>
      (a.getAttribute('href') ?? '').includes('lid=lic-1'));
    expect(atalhos).toHaveLength(8);

    clicarNaAba(/Documentos/);
    // Edital original, documentos editáveis e o antigo conteúdo de Anexos.
    expect(await screen.findByTestId('edital-original')).toBeTruthy();
    expect(screen.getByTestId('documentos')).toBeTruthy();
    expect(screen.getByTestId('anexos')).toBeTruthy();
    // O checklist saiu daqui: tem aba própria.
    expect(screen.queryByTestId('habilitacao')).toBeNull();

    clicarNaAba(/Habilitação/);
    expect(await screen.findByTestId('habilitacao')).toBeTruthy();

    clicarNaAba(/Precificação/);
    const aprovacao = await screen.findByTestId('aprovacao-precificacao');
    const itens = screen.getByTestId('itens-precificacao');
    // A aprovação abre a aba; as sub-abas de trabalho vêm abaixo.
    expect(aprovacao.compareDocumentPosition(itens) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Nova Precificação/ })).toBeTruthy();

    clicarNaAba(/^Proposta$/);
    expect(await screen.findByTestId('proposta')).toBeTruthy();

    clicarNaAba(/Robô de Lances/);
    const robo = await screen.findByTestId('robo');
    // Só este processo, desta empresa.
    expect(robo.getAttribute('data-licitacao')).toBe('lic-1');
    expect(robo.getAttribute('data-empresa')).toBe('emp-1');

    clicarNaAba(/Histórico/);
    expect(await screen.findByTestId('historico')).toBeTruthy();
  });

  it('não repete o objeto extenso no cabeçalho — ele desce para o Resumo', async () => {
    const { container } = montar();
    await screen.findByRole('tab', { name: /Visão geral/ });

    const cabecalho = container.querySelector('header');
    expect(cabecalho).toBeTruthy();
    // Um pedaço distintivo do objeto basta: se ele estiver no cabeçalho, a
    // primeira tela perde as abas para sete linhas de texto de edital.
    expect(cabecalho!.textContent).not.toContain('limpeza, asseio e conservação');
    // O cabeçalho é compacto: identificador, situação, órgão, modalidade,
    // responsável e origem.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('90014/2025');
    expect(cabecalho!.textContent).toContain('Em análise');
    expect(cabecalho!.textContent).toContain('Prefeitura Municipal de Exemplo');
    expect(cabecalho!.textContent).toContain('Pregão Eletrônico');
    expect(cabecalho!.textContent).toContain('PNCP');
    await waitFor(() => expect(cabecalho!.textContent).toContain('Ana Souza'));

    // E o objeto continua legível — no Resumo, com expansão de verdade. Desde
    // 17/09 o próprio texto é o botão (duas linhas; o clique em cima abre), em
    // vez de um botão "Ver descrição completa" abaixo dele.
    expect(screen.getByText('Resumo')).toBeTruthy();
    const objeto = screen.getByText(OBJETO_EXTENSO).closest('button');
    expect(objeto).toBeTruthy();
    expect(objeto).toHaveAttribute('aria-expanded', 'false');
    expect(objeto).toHaveAttribute('title', 'Clique para ler o texto inteiro');
  });

  it('distingue falha de carga de processo inexistente', async () => {
    respostas.licitacoes = { data: null, error: { message: 'conexão recusada' } };
    montar();

    expect(await screen.findByText('Falha ao carregar o processo')).toBeTruthy();
    // O que a pessoa pode fazer é tentar de novo — não procurar na lista um
    // processo que provavelmente está lá.
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeTruthy();
    expect(screen.queryByText('Processo não encontrado')).toBeNull();
    expect(screen.queryByText('Nada para abrir neste endereço')).toBeNull();
  });

  it('diz "não encontrado" só quando a consulta volta vazia SEM erro', async () => {
    respostas.licitacoes = { data: null, error: null };
    montar();

    expect(await screen.findByText('Nada para abrir neste endereço')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Voltar à Gestão de licitações/ })).toBeTruthy();
    expect(screen.queryByText('Falha ao carregar o processo')).toBeNull();
  });

  it('põe o identificador do processo na trilha da faixa superior', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão geral/ });
    const trilha = screen.getByTestId('trilha').textContent ?? '';
    expect(trilha).toContain('Gestão de licitações');
    expect(trilha).toContain('90014/2025');
  });
});
