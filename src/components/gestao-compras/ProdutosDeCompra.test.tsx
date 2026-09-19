import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * O que este arquivo protege no cadastro de produtos.
 *
 *  1. A tabela lista o catálogo com as colunas que a composição pede.
 *  2. Selecionar um produto abre o painel lateral com as três subabas —
 *     "Dados", "Fornecedores" e "Vínculos".
 *  3. NCM ausente aparece como "Não informado", e não como célula vazia.
 *     Célula vazia lê-se como "ainda não carregou"; o selo diz que o dado
 *     não existe, que é outra coisa. O mesmo vale para a família.
 *
 * Ele roda contra `ProdutosDeCompra`, que é a entrada embutida do cadastro em
 * `/gestao-compras`. O miolo é o `CadastroProdutos` compartilhado com a rota
 * `/produtos`, então testar por aqui cobre as duas telas: era justamente o
 * ganho de ter unificado as duas cópias.
 */

// ── Dados de teste ─────────────────────────────────────────────────────────
// Descrições, códigos, NCMs e preços inventados para o teste — nenhum vem de
// catálogo real.
function produto(id: string, descricao: string, extra: Record<string, unknown> = {}) {
  return {
    id, empresa_id: 'e1', codigo: null, descricao,
    unidade: 'PC', categoria: null, saldo_atual: 0, saldo_minimo: 0,
    preco_custo_medio: 0, preco_venda: 0, ativo: true,
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
    ncm: null, cfop: null, cst_icms: null, csosn: null, cst_pis: null,
    cst_cofins: null, p_icms: null, p_pis: null, p_cofins: null,
    codigo_ean: null, cest: null, tipo_produto: '00', origem_mercadoria: null,
    numero_fci: null, peso_liquido: 0, peso_bruto: 0, altura: 0, largura: 0,
    profundidade: 0, dias_crossdocking: 0, lead_time_ressuprimento: 0,
    marca: null, modelo: null, dias_garantia: 0, unidade_tributavel: null,
    quantidade_tributavel: 0, fator_conversao: 0, codigo_ean_tributavel: null,
    indicador_producao_escala: null, observacoes: null,
    ...extra,
  };
}

const PRODUTOS = [
  // Com NCM e família preenchidos.
  produto('a1', 'Item de teste com NCM', {
    codigo: 'PRD00001', ncm: '11112222', categoria: 'Família de teste',
    preco_venda: 12.5, unidade: 'CX',
  }),
  // Sem NCM e sem família: é este que precisa mostrar "Não informado".
  produto('a2', 'Item de teste sem NCM', { codigo: 'PRD00002' }),
];

function construtor(tabela: string) {
  const dados = tabela === 'produtos' ? PRODUTOS : [];
  const elo: Record<string, unknown> = {};
  ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'like', 'in'].forEach(m => {
    elo[m] = vi.fn(() => elo);
  });
  elo.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  elo.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  elo.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: dados, error: null }).then(resolve);
  return elo;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn((tabela: string) => construtor(tabela)) },
}));

// ⚠️ Constantes de módulo, não literais criados na chamada: um objeto novo a
// cada render faz `useEffect(..., [empresaAtiva])` disparar sem parar, e o
// teste trava em vez de falhar.
const EMPRESA = { empresaAtiva: { id: 'e1', nome: 'Empresa de Teste' } };
const PESSOAS = { data: [] };

vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => EMPRESA }));
vi.mock('@/hooks/useFinanceiro', () => ({ usePessoas: () => PESSOAS }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

/**
 * Janela larga, de propósito.
 *
 * O `setup.ts` global responde `matches: false` a toda consulta de mídia, o
 * que põe `AreaComPainel` abaixo do limiar de 1280px — e lá o painel não é
 * uma coluna, é uma GAVETA modal. Gaveta modal do Radix marca
 * `aria-hidden` em tudo que está atrás dela, então a tabela e a seção
 * "Vínculos do produto" somem da árvore de acessibilidade e nenhuma consulta
 * por papel as encontra. Respondendo `true` só às consultas de largura
 * MÍNIMA, o teste roda na composição que a tela tem no desktop: tabela à
 * esquerda, painel à direita, nada escondido.
 *
 * `useIsMobile` não é afetado: ele decide por `window.innerWidth` (1024 no
 * jsdom), não pelo resultado da consulta.
 */
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: /min-width/.test(query),
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

// Diálogos pesados (NCM e CEST carregam tabelas inteiras) e o cadastro de
// pessoa não são o objeto deste teste — só precisam existir.
vi.mock('@/components/shared/NcmDialog', () => ({ default: () => null }));
vi.mock('@/components/shared/CestDialog', () => ({ default: () => null }));
vi.mock('@/components/financeiro/PessoaFormDialog', () => ({ default: () => null }));

import ProdutosDeCompra from './ProdutosDeCompra';

function montar() {
  return render(
    <MemoryRouter>
      <ProdutosDeCompra />
    </MemoryRouter>,
  );
}

/** A tabela do catálogo — distinguida das tabelas internas do painel. */
const aTabela = () => screen.getByRole('table', { name: /Produtos cadastrados/i });

/** Troca de subaba do painel do jeito que o Radix escuta. */
function abrirAba(nome: string) {
  const aba = screen.getByRole('tab', { name: nome });
  fireEvent.mouseDown(aba);
  fireEvent.click(aba);
}

describe('Cadastro de produtos — lista, painel e NCM ausente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista os produtos do catálogo com as colunas da composição', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste com NCM')).toBeInTheDocument());

    const tabela = aTabela();
    ['Situação', 'Descrição', 'Código', 'Unidade', 'Família', 'NCM', 'Preço de venda', 'Ações']
      .forEach(coluna => {
        expect(within(tabela).getByRole('columnheader', { name: new RegExp(coluna, 'i') })).toBeInTheDocument();
      });

    expect(within(tabela).getByText('Item de teste sem NCM')).toBeInTheDocument();
    expect(within(tabela).getByText('PRD00001')).toBeInTheDocument();
  });

  it('mostra "Não informado" quando o produto não tem NCM, em vez de célula vazia', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste sem NCM')).toBeInTheDocument());

    const tabela = aTabela();
    // O produto COM ncm mostra o número; o SEM ncm mostra o selo.
    expect(within(tabela).getByText('11112222')).toBeInTheDocument();

    // Duas ausências na linha sem NCM — família e NCM —, ambas declaradas.
    const naoInformado = within(tabela).getAllByText('Não informado');
    expect(naoInformado.length).toBeGreaterThanOrEqual(2);

    // E a ausência está na LINHA certa, não em qualquer lugar da tabela.
    const linhaSemNcm = within(tabela).getByText('Item de teste sem NCM').closest('tr');
    expect(linhaSemNcm).not.toBeNull();
    expect(within(linhaSemNcm as HTMLElement).getAllByText('Não informado').length).toBe(2);
  });

  it('abre o painel do produto selecionado com as subabas Dados, Fornecedores e Vínculos', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste com NCM')).toBeInTheDocument());

    // Painel fechado: nenhuma das subabas existe ainda.
    expect(screen.queryByRole('tab', { name: 'Vínculos' })).toBeNull();

    fireEvent.click(screen.getByText('Item de teste com NCM'));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Dados' })).toBeInTheDocument());
    ['Dados', 'Fornecedores', 'Vínculos'].forEach(aba => {
      expect(screen.getByRole('tab', { name: aba })).toBeInTheDocument();
    });

    // "Dados" é a subaba de entrada.
    expect(screen.getByRole('tab', { name: 'Dados' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a subaba Vínculos lista as três origens do vínculo do produto', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste com NCM')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Item de teste com NCM'));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Vínculos' })).toBeInTheDocument());
    // Aba do Radix troca no `mousedown` (modo de ativação automático), não no
    // `click` sintético — só clicar deixa o teste na aba "Dados" achando que
    // mudou de aba.
    abrirAba('Vínculos');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Itens de contrato/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /^Pedidos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Estoque/i })).toBeInTheDocument();
  });

  it('mostra a seção "Vínculos do produto" abaixo da tabela só quando há produto selecionado', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste com NCM')).toBeInTheDocument());

    expect(screen.queryByRole('heading', { name: 'Vínculos do produto' })).toBeNull();

    fireEvent.click(screen.getByText('Item de teste com NCM'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vínculos do produto' })).toBeInTheDocument();
    });
  });

  it('oferece as duas ações da composição: incluir produto e importar planilha', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Item de teste com NCM')).toBeInTheDocument());

    // A ação de incluir precisa existir SEMPRE, não só no estado vazio: a aba
    // embutida ficou um tempo sem nenhum caminho para cadastrar produto depois
    // que a lista deixava de estar vazia.
    expect(screen.getByRole('button', { name: /Incluir produto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar planilha/i })).toBeInTheDocument();
  });
});
