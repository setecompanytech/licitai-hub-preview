import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContratoDashboard from './ContratoDashboard';

/**
 * O Resumo do contrato saiu de uma página longa de cartões para indicadores +
 * dois cartões + painel de contexto (reestruturação de 13/09). Três coisas
 * precisam continuar valendo depois disso, e nenhuma delas aparece em captura
 * de tela automatizada — a rota exige sessão e empresa ativa:
 *
 *  1. custo NÃO APURADO aparece como "Apuração a validar", nunca como R$ 0,00.
 *     É o caso real: `contrato_custo_realizado` nasce de migration colada à mão
 *     e, sem ela, o painel cai no custo digitado. Caindo nele e sem nada
 *     digitado, o sistema não apurou custo — e escrever zero ali faria o Lucro
 *     Líquido igualar o Faturamento, com margem de 100%;
 *  2. cada indicador declara DE ONDE o número sai, na linha fina embaixo;
 *  3. a degradação continua elegante: RPC ausente não derruba a tela.
 */

type Linha = Record<string, unknown>;

const { dados } = vi.hoisted(() => ({
  dados: {
    contrato: {} as Linha,
    itens: [] as Linha[],
    pedidos: [] as Linha[],
    custos: [] as Linha[],
    aditivos: [] as Linha[],
    /** `null` = a RPC não existe neste banco (migration pendente). */
    custoRealizado: null as Linha[] | null,
  },
}));

/**
 * Construtor de consulta encadeável e "thenável": o componente ora termina em
 * `.single()`, ora aguarda o próprio builder dentro de um `Promise.all`.
 */
function consulta(linhas: Linha[] | Linha | null) {
  const resultado = { data: linhas, error: null };
  const builder: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'is', 'in', 'order', 'limit', 'neq']) {
    builder[metodo] = () => builder;
  }
  builder.single = () => Promise.resolve({ data: Array.isArray(linhas) ? linhas[0] ?? null : linhas, error: null });
  builder.maybeSingle = builder.single;
  builder.then = (aoResolver: (v: typeof resultado) => unknown) =>
    Promise.resolve(resultado).then(aoResolver);
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'contratos') return consulta(dados.contrato);
      if (tabela === 'contrato_itens') return consulta(dados.itens);
      if (tabela === 'contrato_pedidos') return consulta(dados.pedidos);
      if (tabela === 'contrato_custos') return consulta(dados.custos);
      if (tabela === 'contrato_aditivos') return consulta(dados.aditivos);
      return consulta([]);
    },
    rpc: (nome: string) =>
      Promise.resolve(
        nome === 'contrato_custo_realizado'
          // Erro + data nula é exatamente o que o Postgres devolve quando a
          // função não existe. O componente tem de sobreviver a isso.
          ? { data: dados.custoRealizado, error: dados.custoRealizado ? null : { message: 'function does not exist' } }
          : { data: null, error: null },
      ),
    channel: () => {
      const canal: Record<string, unknown> = {};
      canal.on = () => canal;
      canal.subscribe = () => canal;
      return canal;
    },
    removeChannel: () => {},
  },
}));

const { permissoes } = vi.hoisted(() => ({
  permissoes: { isFinanceiro: true, isAdmin: false, temPermissao: () => true },
}));
vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => permissoes,
}));

// Os filhos fazem as próprias consultas e não são o objeto deste teste. Cada um
// deles já tem (ou dispensa) cobertura própria.
// Só sai no papel e depende de EmpresaProvider para carimbar a empresa.
vi.mock('@/components/documento/CabecalhoDoDocumento', () => ({
  default: () => <div data-testid="cabecalho-documento" />,
}));
vi.mock('./ContratoEficacia', () => ({ default: () => <div data-testid="eficacia" /> }));
vi.mock('./ContratoEntrega', () => ({ default: () => <div data-testid="entrega" /> }));
vi.mock('./ContratoReajuste', () => ({ default: () => <div data-testid="reajuste" /> }));
vi.mock('./EvolucaoMensalDashboard', () => ({ default: () => <div data-testid="evolucao" /> }));
vi.mock('./ManutencaoAtaSrpDialog', () => ({ default: () => <div data-testid="manutencao-ata" /> }));
vi.mock('./RelatorioConsumoAtaDialog', () => ({ default: () => <div data-testid="relatorio-ata" /> }));

const montar = () =>
  render(
    <MemoryRouter>
      <ContratoDashboard contratoId="c-1" />
    </MemoryRouter>,
  );

/**
 * O bloco de um indicador, achado pela LINHA DE BASE dele.
 *
 * Pelo rótulo não dá: "Valor original", "Aditivos" e "Saldo" aparecem duas
 * vezes na tela de propósito — uma no indicador e outra na lista "De onde vem",
 * que declara a procedência de cada número. A linha de base é única, e é
 * justamente o que a regra 2 do comando exige que exista.
 */
const indicadorPelaBase = (base: string | RegExp) => screen.getByText(base).parentElement!;

/** O cartão que carrega um rótulo único — "Custos Totais", "Lucro Líquido". */
const cartaoPeloRotulo = (rotulo: string) => screen.getByText(rotulo).parentElement!;

/**
 * O mesmo formatador da tela.
 *
 * `Intl` separa "R$" do número com ESPAÇO NÃO SEPARÁVEL (U+00A0), não com
 * espaço comum: comparar com a string "R$ 0,00" digitada à mão passa em
 * `not.toContain` por acidente e falha em `toContain` sem explicar por quê.
 */
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Nenhum número aqui é de contrato real — são valores de teste. */
const contratoBase = (over: Linha = {}): Linha => ({
  id: 'c-1',
  tipo_documento: 'contrato',
  numero_contrato: 'TESTE-1',
  orgao_contratante: 'Órgão de teste',
  objeto: 'Objeto de teste',
  valor_global: 1000,
  valor_global_original: 1000,
  valor_consumido: 400,
  saldo_remanescente: 600,
  data_assinatura: '2026-01-05',
  data_inicio: '2026-01-10',
  data_fim: '2027-01-09',
  ata_srp_id: null,
  forma_fornecimento: 'continuo',
  fiscal_nome: null,
  municipio: null,
  ...over,
});

beforeEach(() => {
  dados.contrato = contratoBase();
  dados.itens = [];
  dados.pedidos = [];
  dados.custos = [];
  dados.aditivos = [];
  dados.custoRealizado = null;
  permissoes.isFinanceiro = true;
  permissoes.isAdmin = false;
});

describe('Resumo do contrato — custo não apurado × custo zero', () => {
  it('sem a RPC e sem custo digitado, o painel diz "Apuração a validar" e não R$ 0,00', async () => {
    dados.pedidos = [{ id: 'p1', status: 'entregue', valor_total: 400, data_pedido: '2026-02-01' }];
    montar();

    // A seção do resultado nasce recolhida; o conteúdo continua montado para o
    // papel (`.so-impresso`), então está no DOM e é o que o teste inspeciona.
    await waitFor(() => expect(screen.getByText('Custos Totais')).toBeInTheDocument());

    const cartaoCustos = cartaoPeloRotulo('Custos Totais');
    expect(cartaoCustos.textContent).toContain('Apuração a validar');
    expect(cartaoCustos.textContent).not.toContain(brl(0));

    // E o lucro não pode virar o faturamento inteiro por falta de custo.
    const cartaoLucro = cartaoPeloRotulo('Lucro Líquido');
    expect(cartaoLucro.textContent).toContain('Apuração a validar');
    expect(cartaoLucro.textContent).not.toContain('Margem: 100,0%');
  });

  it('com custo apurado pela RPC, o número aparece — inclusive quando é zero', async () => {
    dados.custoRealizado = [{ custo_pago: 0, custo_comprometido: 0, custo_digitado: 0 }];
    dados.pedidos = [{ id: 'p1', status: 'entregue', valor_total: 400, data_pedido: '2026-02-01' }];
    montar();

    await waitFor(() => expect(screen.getByText('Custos Totais')).toBeInTheDocument());
    const cartaoCustos = cartaoPeloRotulo('Custos Totais');
    // Zero APURADO é uma medida e sai como medida — a regra proíbe fingir
    // apuração, não proíbe o zero.
    expect(cartaoCustos.textContent).toContain(brl(0));
    expect(cartaoCustos.textContent).not.toContain('Apuração a validar');
  });

  it('valor original ausente vira "Apuração a validar", não R$ 0,00', async () => {
    dados.contrato = contratoBase({ valor_global_original: null });
    montar();

    const indicador = await waitFor(() =>
      indicadorPelaBase('o documento não rendeu o número — informe no lápis do valor global'),
    );
    expect(indicador.textContent).toContain('Valor original');
    expect(indicador.textContent).toContain('Apuração a validar');
    expect(indicador.textContent).not.toContain(brl(0));
  });

  it('sem data de fim, o prazo decorrido é indisponível em vez de 0%', async () => {
    dados.contrato = contratoBase({ data_fim: null });
    montar();

    await waitFor(() => expect(screen.getByText('Prazo decorrido')).toBeInTheDocument());
    const linha = screen.getByText('Prazo decorrido').closest('div');
    expect(linha!.textContent).toContain('Vigência a informar');
    expect(linha!.textContent).not.toContain('0%');
  });
});

describe('Resumo do contrato — cada indicador declara a própria base', () => {
  it('os três indicadores do topo dizem de onde o número sai', async () => {
    dados.aditivos = [{ id: 'a1', tipo: 'valor', valor_acrescimo: 100, valor_supressao: 0 }];
    montar();

    const valorOriginal = await waitFor(() =>
      indicadorPelaBase('valor do documento, antes dos aditivos'),
    );
    expect(valorOriginal.textContent).toContain('Valor original');
    expect(indicadorPelaBase(/acréscimos − supressões de 1 termo/).textContent).toContain('Aditivos');
    expect(indicadorPelaBase('valor global menos o que já foi consumido').textContent).toContain('Saldo');
  });

  it('sem nenhum termo, "Aditivos" mostra zero — porque zero ali é fato', async () => {
    montar();
    const indicador = await waitFor(() => indicadorPelaBase('nenhum termo aditivo registrado'));
    expect(indicador.textContent).toContain('Aditivos');
    expect(indicador.textContent).toContain(brl(0));
    expect(indicador.textContent).not.toContain('Apuração a validar');
  });

  it('faturamento e custos declaram a base no cartão de resultado', async () => {
    dados.custoRealizado = [{ custo_pago: 10, custo_comprometido: 0, custo_digitado: 0 }];
    montar();

    await waitFor(() => expect(screen.getByText('Faturamento')).toBeInTheDocument());
    expect(screen.getByText('soma dos pedidos não cancelados')).toBeInTheDocument();
    expect(
      screen.getByText('base: despesas atribuídas (Financeiro) + custos digitados + custo dos pedidos'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('base: soma dos pedidos não cancelados sobre o valor global vigente'),
    ).toBeInTheDocument();
  });
});

describe('Resumo do contrato — degradação quando a migration falta', () => {
  it('a RPC ausente não derruba a tela: o Resumo renderiza assim mesmo', async () => {
    dados.custoRealizado = null;
    montar();
    // Se a falha da RPC derrubasse o componente, nada disto existiria. O título
    // aparece duas vezes de propósito: como seção numerada (endereço citável em
    // ofício) e como título do cartão.
    await waitFor(() => expect(screen.getAllByText('Execução do contrato').length).toBeGreaterThan(0));
    expect(screen.getByText('Próximas ações')).toBeInTheDocument();
    expect(screen.getByText('Publicações e documentos')).toBeInTheDocument();
  });

  it('quem não é do Financeiro não vê custo nem margem', async () => {
    permissoes.isFinanceiro = false;
    permissoes.isAdmin = false;
    montar();
    await waitFor(() => expect(screen.getAllByText('Execução do contrato').length).toBeGreaterThan(0));
    expect(screen.queryByText('Custos Totais')).not.toBeInTheDocument();
    expect(screen.queryByText('Lucro Líquido')).not.toBeInTheDocument();
    expect(
      screen.getByText(/visíveis apenas para o setor Financeiro e Administradores/),
    ).toBeInTheDocument();
  });
});
