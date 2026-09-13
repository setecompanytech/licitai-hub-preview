import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

/**
 * Compras, pedidos e estoque — o que a reestruturação de 13/09 não pode perder.
 *
 * Três afirmações desta tela são fáceis de quebrar sem ninguém notar, porque
 * nenhuma delas aparece como erro: a aba volta para "Pedidos" num F5, o saldo
 * reservado vira 0 quando a apuração falha, e o certificado se diz "Válido"
 * com a coluna `validade` nula. Os casos abaixo travam as três, mais a
 * existência das seis abas com os `value` canônicos.
 *
 * A verificação manual não chega aqui: a tela exige empresa ativa e uma base
 * com contratos, produtos e NF-e — e o estado que interessa (apuração que
 * FALHOU) só acontece quando o banco recusa a consulta.
 */

// ── Supabase: respostas por tabela, montadas caso a caso ─────────
const { respostas } = vi.hoisted(() => ({
  respostas: new Map<string, { data: unknown; error: { message: string } | null }>(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const criarConsulta = (tabela: string) => {
    const resultado = () => respostas.get(tabela) ?? { data: [], error: null };
    const proxy: unknown = new Proxy(
      {},
      {
        get(_alvo, prop) {
          if (prop === 'then') {
            return (aoResolver: (v: unknown) => unknown) =>
              Promise.resolve(resultado()).then(aoResolver);
          }
          // Qualquer elo da cadeia (select, eq, in, order, not, single…)
          // devolve o próprio encadeável; o `await` no fim é quem resolve.
          return () => proxy;
        },
      },
    );
    return proxy;
  };
  return {
    supabase: {
      from: (tabela: string) => criarConsulta(tabela),
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
      storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) },
    },
  };
});

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'emp1', cnpj: '00000000000191' } }),
}));

vi.mock('@/hooks/useFinanceiro', () => ({
  usePessoas: () => ({ data: [] }),
  useDeletePessoa: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/components/financeiro/PessoaFormDialog', () => ({ default: () => null }));

vi.mock('@/components/gestao-compras/ProdutosOmie', () => ({
  default: () => <div>catálogo de produtos</div>,
}));

vi.mock('@/components/gestao-compras/PedidosOmie', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef<{ novoPedido: () => void }>((_p, ref) => {
      useImperativeHandle(ref, () => ({ novoPedido: vi.fn() }));
      return <div>quadro de pedidos</div>;
    }),
  };
});

// Painel ao lado da tabela, não em gaveta: o conteúdo fica na árvore e dá
// para afirmar sobre ele.
vi.mock('@/hooks/useLarguraMinima', () => ({
  useLarguraMinima: () => true,
  LARGURA_PAINEL_LATERAL: 1280,
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import GestaoCompras from './GestaoCompras';

const PRODUTOS = [
  {
    id: 'p1', empresa_id: 'emp1', codigo: 'PRD00001', descricao: 'Resma de papel',
    unidade: 'CX', categoria: 'Expediente', saldo_atual: 10, saldo_minimo: 4,
    preco_custo_medio: 25, ativo: true, created_at: '2026-01-01', updated_at: '2026-01-01',
    ncm: null, cfop: null, cst_icms: null, csosn: null, cst_pis: null, cst_cofins: null,
    p_icms: null, p_pis: null, p_cofins: null,
  },
];

const NFES = [
  {
    id: 'n1', empresa_id: 'emp1', pedido_id: null, fornecedor_id: null,
    numero: '4021', serie: '1', chave: '3'.repeat(44), data_emissao: '2026-03-02',
    emitente_cnpj: '11222333000181', emitente_nome: 'Distribuidora Sul',
    valor_total: 980, xml: '<nfeProc/>', itens: [], recebida_em: '2026-03-03T10:00:00Z',
    origem: 'importacao_compras',
  },
];

/** Base saudável: produtos, NF-e e a apuração de reserva respondendo. */
function baseCompleta() {
  respostas.clear();
  respostas.set('produtos', { data: PRODUTOS, error: null });
  respostas.set('nfe_entradas', { data: NFES, error: null });
  respostas.set('pedidos_compra', { data: [], error: null });
  respostas.set('fornecedores', { data: [], error: null });
  respostas.set('estoque_movimentos', { data: [], error: null });
  respostas.set('contratos', { data: [], error: null });
  respostas.set('certificados_digitais', { data: [], error: null });
  respostas.set('contrato_itens', {
    data: [{
      id: 'ci1', produto_id: 'p1',
      contratos: { numero_contrato: 'CT-77', empresa_id: 'emp1', excluido_em: null },
    }],
    error: null,
  });
  respostas.set('contrato_pedidos', {
    data: [{ contrato_item_id: 'ci1', quantidade: 3 }],
    error: null,
  });
}

function Localizacao() {
  const loc = useLocation();
  return <span data-testid="url">{loc.pathname + loc.search}</span>;
}

const montar = (rota = '/gestao-compras') =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <GestaoCompras />
      <Localizacao />
    </MemoryRouter>,
  );

const ABAS = ['Pedidos', 'Produtos', 'Fornecedores', 'Estoque', 'NF-e', 'Certificado'];

describe('GestaoCompras — a moldura de abas', () => {
  beforeEach(() => { baseCompleta(); });

  it('mostra as seis abas do módulo', async () => {
    montar();
    for (const rotulo of ABAS) {
      expect(await screen.findByRole('tab', { name: new RegExp(rotulo, 'i') })).toBeTruthy();
    }
  });

  it('abre em Pedidos quando a URL não diz nada', async () => {
    montar();
    const pedidos = await screen.findByRole('tab', { name: /Pedidos/i });
    expect(pedidos.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('quadro de pedidos')).toBeTruthy();
  });

  it('a aba vive na URL: recarregar em ?aba=nfe cai na NF-e, não em Pedidos', async () => {
    // É exatamente o F5: a mesma URL, o componente montando do zero.
    montar('/gestao-compras?aba=nfe');
    const nfe = await screen.findByRole('tab', { name: /NF-e/i });
    await waitFor(() => expect(nfe.getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByRole('tab', { name: /^Pedidos/i }).getAttribute('aria-selected')).toBe('false');
    expect(await screen.findByText('Distribuidora Sul')).toBeTruthy();
  });

  it('trocar de aba escreve o estado na URL — é o que faz o F5 funcionar', async () => {
    montar();
    const estoque = await screen.findByRole('tab', { name: /Estoque/i });
    // O Radix ativa a aba no mousedown, não no click sintético.
    fireEvent.mouseDown(estoque);
    fireEvent.click(estoque);
    await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('aba=estoque'));
  });
});

describe('GestaoCompras — cada aba monta sem quebrar', () => {
  beforeEach(() => { baseCompleta(); });

  // A tela branca de 02/09 veio de um ramo que só falhava quando visitado.
  // Estes casos abrem os seis, um a um.
  const esperado: Record<string, RegExp> = {
    pedidos: /quadro de pedidos/i,
    produtos: /catálogo de produtos/i,
    fornecedores: /Nenhum fornecedor cadastrado/i,
    estoque: /Resma de papel/i,
    nfe: /Distribuidora Sul/i,
    certificado: /Certificado A3/i,
  };

  for (const [aba, texto] of Object.entries(esperado)) {
    it(`renderiza a aba ${aba}`, async () => {
      montar(`/gestao-compras?aba=${aba}`);
      expect(await screen.findByText(texto)).toBeTruthy();
    });
  }
});

describe('GestaoCompras — painéis laterais', () => {
  beforeEach(() => { baseCompleta(); });

  it('o produto abre com subabas, resumo e aviso de reposição', async () => {
    respostas.set('produtos', { data: [{ ...PRODUTOS[0], saldo_atual: 2 }], error: null });
    montar('/gestao-compras?aba=estoque');
    fireEvent.click(await screen.findByText('Resma de papel'));

    expect(await screen.findByRole('tab', { name: /Movimentações/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Vínculos/i })).toBeTruthy();
    // 2 no físico contra mínimo 4: o ponto de reposição avisa e oferece ação.
    expect(screen.getByText(/Abaixo do ponto de reposição/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Gerar pedido/i })).toBeTruthy();
  });

  it('a NF-e abre com as quatro subabas e a ação de conferir entrada', async () => {
    montar('/gestao-compras?aba=nfe');
    fireEvent.click(await screen.findByText('Distribuidora Sul'));

    for (const nome of [/^Resumo$/, /Itens \(/, /XML\/PDF/, /^Histórico$/]) {
      expect(await screen.findByRole('tab', { name: nome })).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: /Conferir/i }).length).toBeGreaterThan(0);
  });
});

describe('GestaoCompras — estoque: físico, reserva e disponível', () => {
  beforeEach(() => { baseCompleta(); });

  it('apurada a reserva, mostra os três números derivados do contrato', async () => {
    montar('/gestao-compras?aba=estoque');
    expect(await screen.findByText('Resma de papel')).toBeTruthy();
    // 10 físico − 3 reservados em pedido de contrato pendente = 7 disponíveis.
    const linha = screen.getByText('Resma de papel').closest('tr')!;
    expect(linha.textContent).toContain('10');
    expect(linha.textContent).toContain('3');
    expect(linha.textContent).toContain('7');
  });

  it('declara de onde vêm as colunas derivadas — elas não são do estoque', async () => {
    montar('/gestao-compras?aba=estoque');
    expect(
      await screen.findByText(/Disponível = físico − reservado/i),
    ).toBeTruthy();
  });

  it('sem apuração, reserva e disponível saem como indisponíveis — nunca zero', async () => {
    respostas.set('contrato_itens', { data: null, error: { message: 'permission denied' } });
    montar('/gestao-compras?aba=estoque');
    const nome = await screen.findByText('Resma de papel');
    const linha = nome.closest('tr')!;
    await waitFor(() => expect(linha.textContent).toContain('Não apurado'));
    // As DUAS colunas derivadas se declaram indisponíveis…
    expect(linha.textContent!.match(/Não apurado/g)).toHaveLength(2);
    // …e o saldo físico, que é coluna de verdade, continua sendo dito.
    expect(linha.textContent).toContain('10');
    // E a falha aparece com a razão, em vez de sumir.
    expect(await screen.findByText(/permission denied/)).toBeTruthy();
  });
});

describe('GestaoCompras — certificado digital', () => {
  beforeEach(() => { baseCompleta(); });

  it('não afirma validade que não tem: sem a data, nada de selo "Válido"', async () => {
    respostas.set('certificados_digitais', {
      data: [{
        id: 'c1', tipo: 'A1', nome_titular: null, cnpj_titular: null,
        validade: null, ativo: true, storage_path: 'emp1/certificados/1_a.pfx',
        created_at: '2026-02-01T12:00:00Z', updated_at: '2026-02-01T12:00:00Z',
      }],
      error: null,
    });
    montar('/gestao-compras?aba=certificado');

    expect((await screen.findAllByText(/Validade não informada/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Válido$/)).toBeNull();
    expect(screen.queryByText(/^Vencido$/)).toBeNull();
    expect(screen.queryByText(/Válido até/)).toBeNull();
  });

  it('não promete detecção de token A3 — o sistema não lê dispositivo', async () => {
    montar('/gestao-compras?aba=certificado');
    expect(await screen.findByText(/não verifica dispositivo/i)).toBeTruthy();
    expect(await screen.findByText(/Não administrado aqui/i)).toBeTruthy();
    // O texto antigo prometia o que nenhuma linha de código faz.
    expect(screen.queryByText(/detectar automaticamente/i)).toBeNull();
  });
});
