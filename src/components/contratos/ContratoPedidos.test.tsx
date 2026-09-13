import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContratoPedidos from './ContratoPedidos';

/**
 * A aba Pedidos passou a separar o que CONSOME do que AUTORIZA
 * (reestruturação de 13/09): "Pedidos / Ordens" numa subaba, "Empenhos" na
 * outra. A separação não é estética — foi a lista de empenhos invisível, no fim
 * de uma rolagem longa, que levou ao cadastro em duplicidade do mesmo empenho:
 * a aba dizia "0 pedidos | R$ 0,00" e a única leitura possível era a de que
 * nada havia sido registrado.
 *
 * O que este arquivo prende:
 *  1. as duas subabas existem, com a contagem de cada uma;
 *  2. a tabela de pedidos traz as colunas da referência, incluindo a etapa
 *     operacional;
 *  3. trocar para "Empenhos" tira a tabela de pedidos da frente e mostra os
 *     empenhos — e a frase que diz que empenho autoriza, não consome;
 *  4. indicador sem pedido nenhum é indisponível, não R$ 0,00.
 */

type Linha = Record<string, unknown>;

const { dados } = vi.hoisted(() => ({
  dados: {
    contrato: {} as Linha,
    pedidos: [] as Linha[],
    itens: [] as Linha[],
    aditivos: [] as Linha[],
    notas: [] as Linha[],
    preNotas: [] as Linha[],
    empenhos: [] as Linha[],
    /** Uma linha por cota, como a RPC `contrato_empenho_saldo_por_cota` devolve. */
    saldoPorCota: [] as Linha[],
    valorVigente: [] as Linha[],
  },
}));

/** Builder encadeável e "thenável" — ver o gêmeo em ContratoDashboard.test. */
function consulta(linhas: Linha[] | Linha | null) {
  const resultado = { data: linhas, error: null };
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'is', 'in', 'order', 'limit', 'neq']) {
    builder[metodo] = () => builder;
  }
  builder.single = () =>
    Promise.resolve({ data: Array.isArray(linhas) ? linhas[0] ?? null : linhas, error: null });
  builder.maybeSingle = builder.single;
  builder.then = (aoResolver: (v: typeof resultado) => unknown) =>
    Promise.resolve(resultado).then(aoResolver);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'contratos') return consulta(dados.contrato);
      if (tabela === 'contrato_pedidos') return consulta(dados.pedidos);
      if (tabela === 'contrato_itens') return consulta(dados.itens);
      if (tabela === 'contrato_aditivos') return consulta(dados.aditivos);
      if (tabela === 'notas_fiscais') return consulta(dados.notas);
      if (tabela === 'pre_notas_fiscais') return consulta(dados.preNotas);
      if (tabela === 'contrato_empenhos') return consulta(dados.empenhos);
      return consulta([]);
    },
    rpc: (nome: string) => {
      if (nome === 'contrato_empenho_saldo_por_cota') return Promise.resolve({ data: dados.saldoPorCota, error: null });
      if (nome === 'contrato_empenho_valor_vigente') return Promise.resolve({ data: dados.valorVigente, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    channel: () => {
      const canal: Record<string, unknown> = {};
      canal.on = () => canal;
      canal.subscribe = () => canal;
      return canal;
    },
    removeChannel: () => {},
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  },
}));

vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => ({ isFinanceiro: true, isAdmin: true, temPermissao: () => true }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'teste@exemplo.test' } }),
}));
vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e-1', nome: 'Empresa de teste' } }),
}));
vi.mock('@/hooks/useSituacaoJuridica', () => ({
  useSituacaoJuridica: () => ({ situacao: null, indisponivel: false, carregando: false }),
}));
vi.mock('@/hooks/useDocumentoFiscal', () => ({
  useDocumentoFiscal: () => ({ data: null }),
  useDocumentosPorNumeroNota: () => ({ data: {} }),
  chaveDoNumero: () => [],
}));
vi.mock('@/hooks/useNotaDoPedido', () => ({
  useNotasDosPedidos: () => ({ data: {} }),
}));
// Faz as próprias consultas e abre diálogos; não é o objeto deste teste.
vi.mock('@/components/financeiro/KitFaturamento', () => ({
  default: () => <button type="button">Kit</button>,
}));
vi.mock('./GerarPreNotaDialog', () => ({ default: () => <div data-testid="pre-nota" /> }));
vi.mock('./MovimentosDoEmpenho', () => ({ default: () => <div data-testid="movimentos" /> }));
vi.mock('./VincularLancamentoDialog', () => ({ default: () => <div data-testid="vincular" /> }));

// A aba invalida caches do react-query ao salvar; sem o provider, o hook lança
// ao montar. Sem retry para a falha aparecer no teste em vez de virar espera.
const montar = () => {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter>
        <ContratoPedidos contratoId="c-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

beforeEach(() => {
  /** Nenhum número, órgão ou data aqui é real — são valores de teste. */
  dados.contrato = {
    ata_srp_id: null,
    tipo_documento: 'contrato',
    forma_execucao: null,
    art95_fundamento: null,
    saldo_remanescente: 500,
    valor_global: 1000,
    numero_contrato: 'TESTE-1',
    orgao_contratante: 'Órgão de teste',
  };
  dados.pedidos = [];
  dados.itens = [];
  dados.aditivos = [];
  dados.notas = [];
  dados.preNotas = [];
  dados.empenhos = [];
  dados.saldoPorCota = [];
  dados.valorVigente = [];
  // O painel lateral só existe a partir de 1280px; abaixo disso vira gaveta e
  // o teste estaria medindo outra composição.
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
      dispatchEvent: () => {},
    }),
  });
});

const comUmPedidoEUmEmpenho = () => {
  dados.itens = [{
    id: 'i-1', codigo_item: 'IT-1', descricao: 'Item de teste',
    unidade: 'UN', valor_unitario: 10, origem_aditivo_id: null, produto_id: null,
  }];
  dados.pedidos = [{
    id: 'p-1', numero_pedido: 'OF-TESTE-1', descricao: 'Entrega de teste',
    contrato_item_id: 'i-1', quantidade: 5, valor_unitario: 10, valor_total: 50,
    data_pedido: '2026-03-02', data_entrega: null, status: 'pendente',
    nota_fiscal: null, observacoes: null, nf_quitada: false, data_quitacao: null,
    pedido_id: null, numero_empenho: null, empenho_id: 'e-1', cota: null,
  }];
  dados.empenhos = [{ id: 'e-1', numero: '2026NE000001', tipo: 'ordinario', arquivo_id: null }];
  dados.saldoPorCota = [{
    cota: 'principal', saldo_qtd: 45, qtd_empenhada: 50, saldo_valor: 450,
    valor_original: 500, reforcos: 0, anulacoes: 0, valor_vigente: 500,
  }];
  dados.valorVigente = [{ valor_original: 500, reforcos: 0, anulacoes: 0, valor_vigente: 500 }];
};

describe('Aba Pedidos — o que consome e o que autoriza vivem em subabas', () => {
  it('mostra as duas subabas com a contagem de cada uma', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByRole('tab', { name: /Pedidos \/ Ordens/ })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /Pedidos \/ Ordens/ }).textContent).toContain('(1)');
    expect(screen.getByRole('tab', { name: /Empenhos/ }).textContent).toContain('(1)');
  });

  it('a tabela de pedidos traz as colunas da referência', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const cabecalho = within(screen.getByRole('table')).getAllByRole('columnheader').map(c => c.textContent?.trim());
    expect(cabecalho).toEqual([
      'Pedido', 'Item', 'Quantidade', 'Prazo', 'Situação', 'NF-e', 'Etapa operacional', 'Ações',
    ]);
  });

  it('trocar para Empenhos troca o conteúdo: some a tabela de pedidos, aparece o empenho', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByText('OF-TESTE-1')).toBeInTheDocument());

    // O gatilho de aba do Radix troca no `mousedown`, não no `click`: um clique
    // de verdade dispara os dois, mas `fireEvent.click` só dispara o segundo.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Empenhos/ }), { button: 0 });

    await waitFor(() => expect(screen.queryByText('OF-TESTE-1')).not.toBeInTheDocument());
    expect(screen.getByText('2026NE000001')).toBeInTheDocument();
    // A frase que separa os dois conceitos precisa estar na tela, não só na
    // cabeça de quem programou. Vem partida em dois nós porque "autoriza" está
    // em negrito — por isso as duas asserções em vez de uma regex só.
    expect(screen.getByText('autoriza')).toBeInTheDocument();
    expect(screen.getByText(/não consome/i)).toBeInTheDocument();
  });

  it('na subaba Pedidos, os empenhos continuam alcançáveis como contexto', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByText('OF-TESTE-1')).toBeInTheDocument());
    // Recolhida por padrão: o título informa quantos há — que era o dado que
    // faltava — e abre a um clique, sem sair da subaba.
    const secao = screen.getByRole('button', { name: /Empenhos registrados \(1\)/ });
    expect(secao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(secao);
    expect(secao).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Aba Pedidos — indicadores declaram a base e não fingem zero', () => {
  it('sem nenhum pedido, o valor é indisponível em vez de R$ 0,00', async () => {
    montar();

    await waitFor(() => expect(screen.getByText('Valor dos pedidos')).toBeInTheDocument());
    const indicador = screen.getByText('Valor dos pedidos').parentElement!;
    expect(indicador.textContent).toContain('Nenhum pedido lançado');
    expect(indicador.textContent).not.toContain(brl(0));
  });

  it('cada indicador diz de onde o número sai', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByText('Valor dos pedidos')).toBeInTheDocument());
    expect(screen.getByText('soma dos pedidos com situação diferente de cancelado')).toBeInTheDocument();
    expect(screen.getByText('todos os registros da aba, inclusive cancelados')).toBeInTheDocument();
    expect(screen.getByText('autorizam as entregas — consulte na subaba Empenhos')).toBeInTheDocument();
  });
});

describe('Aba Pedidos — o painel do pedido selecionado', () => {
  it('selecionar um pedido abre o painel com contrato, órgão e empenho de origem', async () => {
    comUmPedidoEUmEmpenho();
    montar();

    await waitFor(() => expect(screen.getByText('Entrega de teste')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Entrega de teste'));

    await waitFor(() => expect(screen.getByText('Pedido OF-TESTE-1')).toBeInTheDocument());
    expect(screen.getByText('Contrato')).toBeInTheDocument();
    expect(screen.getByText('TESTE-1')).toBeInTheDocument();
    expect(screen.getByText('Órgão')).toBeInTheDocument();
    expect(screen.getByText('Órgão de teste')).toBeInTheDocument();
    expect(screen.getByText('Empenho de origem')).toBeInTheDocument();
    expect(screen.getByText('Situação da reserva')).toBeInTheDocument();
  });
});
