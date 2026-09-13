import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * O dossiê do processo — o que a reestruturação de 13/09 não pode perder.
 *
 * Estes casos existem porque a verificação visual não chega aqui: a tela pede
 * sessão, empresa ativa e um processo de verdade no banco, e na captura
 * automatizada ela para antes de montar. O que travamos:
 *
 *  - as SETE abas do comando, com os rótulos exatos;
 *  - trocar de aba ESCREVE na URL. Este é o defeito que a reestruturação veio
 *    corrigir: a URL era lida (`?aba=`) e nunca escrita, então clicar numa aba
 *    não mudava o endereço, o voltar do navegador não devolvia a aba e o F5
 *    jogava todo mundo de volta na Visão Geral;
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
};

const ROTULOS_DAS_ABAS = [
  'Visão Geral', 'Documentos', 'Anexos',
  'Precificação', 'Proposta', 'Módulos', 'Histórico',
];

// ── Montagem ──────────────────────────────────────────────────────────────

let buscaAtual = '';

function EspiaDaUrl() {
  const { search } = useLocation();
  buscaAtual = search;
  return null;
}

/** Ativa uma aba como o mouse ativa: a fila de abas é Radix, e ela troca de
 *  painel no `mousedown` — um `click` sintético sozinho não a move. */
const clicarNaAba = (rotulo: RegExp) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: rotulo }));

const montar = (entrada = '/processo/lic-1') => {
  buscaAtual = '';
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
});

// ── Casos ─────────────────────────────────────────────────────────────────

describe('ProcessoWorkspace — o dossiê do processo', () => {
  it('tem as sete abas do comando, com os rótulos exatos', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão Geral/ });
    for (const rotulo of ROTULOS_DAS_ABAS) {
      expect(screen.getByRole('tab', { name: new RegExp(rotulo) })).toBeTruthy();
    }
    expect(screen.getAllByRole('tab')).toHaveLength(7);
  });

  it('leva a aba para a URL ao clicar — o defeito que a reestruturação corrige', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão Geral/ });
    // A Visão Geral é o padrão e por isso é OMITIDA da URL: `?aba=visao` e a
    // URL limpa significam a mesma coisa, e duas escritas sujariam o histórico.
    expect(buscaAtual).toBe('');

    clicarNaAba(/Documentos/);
    await waitFor(() => expect(buscaAtual).toContain('aba=documentos'));

    clicarNaAba(/Histórico/);
    await waitFor(() => expect(buscaAtual).toContain('aba=historico'));

    // E o caminho de volta: ao padrão, o parâmetro sai da URL.
    clicarNaAba(/Visão Geral/);
    await waitFor(() => expect(buscaAtual).not.toContain('aba='));
  });

  it('abre na aba que a URL pediu — é o que faz o F5 e o voltar caírem no lugar', async () => {
    montar('/processo/lic-1?aba=proposta');
    expect(await screen.findByTestId('proposta')).toBeTruthy();
    expect(screen.queryByTestId('habilitacao')).toBeNull();
  });

  it('cada uma das sete abas entrega o conteúdo que promete', async () => {
    montar();
    await screen.findByRole('tab', { name: /Visão Geral/ });

    // Visão Geral: desfecho, ficha e a linha da preparação automática.
    expect(screen.getByTestId('edital-original')).toBeTruthy();

    clicarNaAba(/Documentos/);
    // O checklist de habilitação abre a aba, o gerenciador vem abaixo.
    expect(await screen.findByTestId('habilitacao')).toBeTruthy();
    expect(screen.getByTestId('documentos')).toBeTruthy();

    clicarNaAba(/Anexos/);
    expect(await screen.findByTestId('anexos')).toBeTruthy();

    clicarNaAba(/Precificação/);
    expect(await screen.findByTestId('itens-precificacao')).toBeTruthy();
    // As duas subabas continuam de pé.
    expect(screen.getByRole('tab', { name: /Nova Precificação/ })).toBeTruthy();

    clicarNaAba(/^Proposta$/);
    expect(await screen.findByTestId('proposta')).toBeTruthy();

    clicarNaAba(/Módulos/);
    expect(await screen.findByText('Abrir em módulos completos')).toBeTruthy();
    // Os oito atalhos, todos levando o processo junto em `?lid=`.
    const atalhos = screen.getAllByRole('link').filter((a) =>
      (a.getAttribute('href') ?? '').includes('lid=lic-1'));
    expect(atalhos).toHaveLength(8);

    clicarNaAba(/Histórico/);
    expect(await screen.findByTestId('historico')).toBeTruthy();
  });

  it('não repete o objeto extenso no cabeçalho — ele desce para o Resumo', async () => {
    const { container } = montar();
    await screen.findByRole('tab', { name: /Visão Geral/ });

    const cabecalho = container.querySelector('header');
    expect(cabecalho).toBeTruthy();
    // Um pedaço distintivo do objeto basta: se ele estiver no cabeçalho, a
    // primeira tela perde as abas para sete linhas de texto de edital.
    expect(cabecalho!.textContent).not.toContain('limpeza, asseio e conservação');
    // O cabeçalho é compacto: identificador, situação e origem.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('90014/2025');
    expect(cabecalho!.textContent).toContain('Em análise');
    expect(cabecalho!.textContent).toContain('PNCP');

    // E o objeto continua legível — no Resumo, com expansão de verdade.
    expect(screen.getByText('Resumo')).toBeTruthy();
    expect(screen.getByText(OBJETO_EXTENSO)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver descrição completa' })).toBeTruthy();
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
    await screen.findByRole('tab', { name: /Visão Geral/ });
    const trilha = screen.getByTestId('trilha').textContent ?? '';
    expect(trilha).toContain('Gestão de licitações');
    expect(trilha).toContain('90014/2025');
  });
});
