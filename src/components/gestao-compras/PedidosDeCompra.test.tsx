import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
import { createRef, type Ref } from 'react';
import { MemoryRouter } from 'react-router-dom';

/**
 * O que este arquivo protege em PedidosDeCompra.
 *
 * Três coisas que já quebraram, ou que a próxima mexida quebra sem avisar:
 *
 *  1. A alternância Lista ⇄ Quadro. São duas apresentações do MESMO conjunto
 *     de pedidos, e o botão precisa trocar a apresentação de verdade — não só
 *     ficar aceso.
 *  2. Os rótulos EXATOS das cinco colunas do quadro. Eles não são decoração:
 *     `separar_estoque` → "Separar Estoque" é o vocabulário que a equipe usa
 *     para dizer onde o pedido está. E `cancelado`, que existe em STATUS_MSG,
 *     NÃO pode virar uma sexta coluna.
 *  3. O punho `novoPedido()`. A página de Compras dispara o formulário por
 *     ele; já houve regressão em que o `forwardRef` sumiu numa refatoração e
 *     o botão "Novo pedido" do cabeçalho virou enfeite silencioso.
 */

// ── Dados de teste ─────────────────────────────────────────────────────────
// Um pedido em cada etapa do quadro, para as cinco colunas terem conteúdo e a
// lista ter o que mostrar. Números e nomes são inventados para o teste: não
// saem de cadastro nenhum.
function pedido(id: string, numero: number, status: string, extra: Record<string, unknown> = {}) {
  return {
    id, empresa_id: 'e1', numero, tipo: 'venda', status,
    pessoa_id: null, previsao_faturamento: null,
    total_mercadorias: 0, valor_desconto: 0, total_ipi: 0, total_icms_st: 0,
    valor_total: numero, vendedor: null, numero_parcelas: 'A Vista',
    cenario_fiscal: null, categoria: null, conta_corrente: null, etapa: null,
    num_pedido_cliente: null, num_contrato_venda: null, contato: null,
    projeto: null, origem_pedido: 'sistema', dados_adicionais_nfe: null,
    nf_consumo_final: false, email_destinatario: null, enviar_boleto: false,
    observacoes: null, contrato_id: null,
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
    ...extra,
  };
}

const PEDIDOS = [
  pedido('p1', 101, 'pedido', { pessoa_id: 'x1' }),
  pedido('p2', 102, 'separar_estoque', { tipo: 'compra' }),
  pedido('p3', 103, 'faturar'),
  pedido('p4', 104, 'faturado'),
  pedido('p5', 105, 'entrega'),
  // Um cancelado: existe no sistema, mas NÃO pode abrir coluna no quadro.
  pedido('p6', 106, 'cancelado'),
];

/**
 * O cliente do supabase é uma cadeia fluente que termina em `await`. Este
 * duplo devolve a si mesmo em cada elo e resolve com os dados da tabela
 * pedida, o que cobre `.select().eq().order()` em qualquer ordem.
 */
function construtor(tabela: string) {
  const dados = tabela === 'pedidos' ? PEDIDOS : [];
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
  supabase: {
    from: vi.fn((tabela: string) => construtor(tabela)),
    storage: {
      from: vi.fn(() => ({
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
      })),
    },
  },
}));

// ⚠️ Os retornos dos hooks são CONSTANTES de módulo, não objetos literais
// criados na chamada. `useEmpresa: () => ({ empresaAtiva: {...} })` devolve
// uma identidade nova a cada render, e `useEffect(..., [empresaAtiva])` passa
// a disparar em todo render — carrega, muda estado, renderiza, carrega de
// novo. O teste não falha: ele trava.
const EMPRESA = { empresaAtiva: { id: 'e1', nome: 'Empresa de Teste' } };
const AUTH = { user: { id: 'u1' } };
const PESSOAS = { data: [{ id: 'x1', nome: 'Comprador de Teste', documento: null, tipo: 'cliente' }] };

vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => EMPRESA }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));
vi.mock('@/hooks/useFinanceiro', () => ({ usePessoas: () => PESSOAS }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import PedidosDeCompra, { type PedidosDeCompraRef } from './PedidosDeCompra';

/** Os cinco rótulos, na ordem exata em que o fluxo acontece. */
const COLUNAS = ['Pedidos', 'Separar Estoque', 'Faturar', 'Faturado', 'Entrega'];

function montar(ref?: Ref<PedidosDeCompraRef>) {
  return render(
    <MemoryRouter>
      <PedidosDeCompra ref={ref} />
    </MemoryRouter>,
  );
}

const oQuadro = () => screen.getByRole('group', { name: /Quadro de pedidos/i });

describe('PedidosDeCompra — quadro e lista', () => {
  beforeEach(() => vi.clearAllMocks());

  it('abre no quadro e mostra as cinco colunas com os rótulos exatos', async () => {
    montar();
    // Os rótulos das colunas são cabeçalhos de verdade (<h3>), não spans.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Separar Estoque' })).toBeInTheDocument();
    });
    COLUNAS.forEach(rotulo => {
      expect(screen.getByRole('heading', { name: rotulo })).toBeInTheDocument();
    });
  });

  it('não cria coluna para "cancelado", que existe em STATUS_MSG mas está fora do fluxo', async () => {
    montar();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Separar Estoque' })).toBeInTheDocument();
    });
    expect(within(oQuadro()).queryByRole('heading', { name: 'Cancelado' })).toBeNull();
    // Cinco colunas, nem mais nem menos.
    expect(within(oQuadro()).getAllByRole('heading')).toHaveLength(5);
  });

  it('deixa claro na interface que o quadro não é o Kanban de licitações', async () => {
    montar();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Entrega' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Kanban de licitações/i)).toBeInTheDocument();
  });

  it('alterna de Quadro para Lista e de volta, trocando a apresentação de verdade', async () => {
    montar();

    const botaoQuadro = await screen.findByRole('button', { name: 'Quadro' });
    const botaoLista = screen.getByRole('button', { name: 'Lista' });

    // Estado inicial: quadro pressionado, lista não.
    expect(botaoQuadro).toHaveAttribute('aria-pressed', 'true');
    expect(botaoLista).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(botaoLista);

    // Agora existe tabela, e o quadro saiu da tela — não basta o botão acender.
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(botaoLista).toHaveAttribute('aria-pressed', 'true');
    expect(botaoQuadro).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('group', { name: /Quadro de pedidos/i })).toBeNull();

    fireEvent.click(botaoQuadro);

    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(botaoQuadro).toHaveAttribute('aria-pressed', 'true');
    expect(oQuadro()).toBeInTheDocument();
  });

  it('a lista mostra os pedidos carregados', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Lista' }));

    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('#101')).toBeInTheDocument();
    expect(within(tabela).getByText('#105')).toBeInTheDocument();
    // A lista não esconde o cancelado: ele não é COLUNA, mas é um pedido.
    expect(within(tabela).getByText('#106')).toBeInTheDocument();
  });

  it('expõe novoPedido() pela ref, e chamá-lo abre a escolha do tipo de pedido', async () => {
    const ref = createRef<PedidosDeCompraRef>();
    montar(ref);

    await waitFor(() => expect(ref.current).not.toBeNull());
    expect(typeof ref.current?.novoPedido).toBe('function');

    // Não basta existir: tem que fazer alguma coisa. Chamar abre o diálogo.
    act(() => { ref.current!.novoPedido(); });
    expect(await screen.findByRole('dialog')).toHaveTextContent('Novo Pedido');
  });
});
