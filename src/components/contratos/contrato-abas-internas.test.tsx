import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContratoItens from './ContratoItens';
import ContratoArquivos from './ContratoArquivos';

/**
 * As duas abas internas que a reestruturação de 13/09 reescreveu por inteiro e
 * que não tinham cobertura nenhuma: Itens/Lotes e Arquivos-Aditivos.
 *
 * Um arquivo só porque as duas montam sobre o MESMO conjunto de dublês —
 * supabase, permissões, empresa, sessão. Separá-las custaria duplicar sessenta
 * linhas de mock que teriam de mudar juntas.
 *
 * O que fica preso aqui:
 *  1. Itens/Lotes renderiza indicadores + busca + tabela, e clicar no item
 *     abre o painel lateral (que substituiu o diálogo de leitura);
 *  2. Arquivos-Aditivos tem as três subabas e troca de conteúdo entre elas;
 *  3. a subaba Auditoria traz a tabela de eventos com a coluna Responsável e,
 *     ao selecionar um evento, o painel "Comparar alteração" com as colunas
 *     "Antes (contrato atual)" × "Proposto (novo aditivo)" e as duas ações.
 */

type Linha = Record<string, unknown>;

const { dados } = vi.hoisted(() => ({
  dados: {
    contrato: {} as Linha,
    itens: [] as Linha[],
    aditivos: [] as Linha[],
    arquivos: [] as Linha[],
    produtos: [] as Linha[],
    auditoria: [] as Linha[],
  },
}));

function consulta(linhas: Linha[] | Linha | null) {
  const resultado = { data: linhas, error: null };
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit', 'neq', 'not']) b[m] = () => b;
  b.single = () => Promise.resolve({ data: Array.isArray(linhas) ? linhas[0] ?? null : linhas, error: null });
  b.maybeSingle = b.single;
  b.then = (r: (v: typeof resultado) => unknown) => Promise.resolve(resultado).then(r);
  return b;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => {
      if (t === 'contratos') return consulta(dados.contrato);
      if (t === 'contrato_itens') return consulta(dados.itens);
      if (t === 'contrato_aditivos') return consulta(dados.aditivos);
      if (t === 'contrato_arquivos') return consulta(dados.arquivos);
      if (t === 'produtos') return consulta(dados.produtos);
      if (t === 'contrato_ia_auditoria') return consulta(dados.auditoria);
      return consulta([]);
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
    channel: () => { const c: Record<string, unknown> = {}; c.on = () => c; c.subscribe = () => c; return c; },
    removeChannel: () => {},
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  },
}));
vi.mock('@/hooks/useMembroPermissoes', () => ({
  useMembroPermissoes: () => ({ isFinanceiro: true, isAdmin: true, temPermissao: () => true }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1', email: 'a@b.test' } }) }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => ({ empresaAtiva: { id: 'e-1' } }) }));
vi.mock('@/hooks/useAuthorization', () => ({ useAuthorization: () => ({ isSystemAdmin: false }) }));
vi.mock('./EstruturaDocumentoCard', () => ({ default: () => <div data-testid="estrutura" /> }));
vi.mock('./DocumentDetectionDialog', () => ({ default: () => <div data-testid="deteccao" /> }));
vi.mock('./EventoAuditoriaDetalheDialog', () => ({ default: () => <div data-testid="evento" /> }));

const envolver = (no: React.ReactNode) => {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={c}><MemoryRouter>{no}</MemoryRouter></QueryClientProvider>);
};

beforeEach(() => {
  dados.contrato = {
    id: 'c-1', tipo_documento: 'contrato', ata_srp_id: null, tipo_estrutura: 'itens',
    valor_global: 1000, valor_consumido: 400, empresa_id: 'e-1',
  };
  dados.itens = [{
    id: 'i-1', contrato_id: 'c-1', descricao: 'Item de teste', unidade: 'UN',
    quantidade_contratada: 10, valor_unitario: 10, valor_total: 100,
    quantidade_consumida: 4, saldo_quantitativo: 6, saldo_financeiro: 60,
    codigo_item: 'IT-1', observacoes: null, origem_aditivo_id: null,
    ata_item_id: null, quantidade_ata_consumida: null, custo_unitario: 5, custo_total: 50,
  }];
  dados.aditivos = [{ id: 'a-1', numero_aditivo: '1º Aditivo', tipo: 'valor', valor_acrescimo: 100, valor_supressao: 0, quantidade_acrescimo: 0, quantidade_supressao: 0, arquivo_id: null, justificativa: 'Motivo de teste', data_assinatura: '2026-02-01' }];
  dados.arquivos = [{ id: 'f-1', nome_arquivo: 'contrato.pdf', tipo: 'contrato_original', tamanho_bytes: 1024, created_at: '2026-01-05T12:00:00Z', descricao: null, storage_path: 'x/y.pdf' }];
  dados.produtos = [];
  dados.auditoria = [];
});

describe('smoke — Itens/Lotes', () => {
  it('renderiza indicadores, filtros e tabela, e abre o painel do item', async () => {
    envolver(<ContratoItens contratoId="c-1" />);
    await waitFor(() => expect(screen.getByText('Item de teste')).toBeInTheDocument());
    expect(screen.getByText('Total efetivo')).toBeInTheDocument();
    expect(screen.getByText('Saldo dos itens')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar por descrição/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Item de teste'));
    await waitFor(() => expect(screen.getByText('Item do contrato')).toBeInTheDocument());
  });
});

describe('smoke — Arquivos e aditivos', () => {
  it('renderiza as três subabas e troca entre elas', async () => {
    envolver(<ContratoArquivos contratoId="c-1" />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Arquivos/ })).toBeInTheDocument());
    expect(screen.getByText('contrato.pdf')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Aditivos/ }), { button: 0 });
    await waitFor(() => expect(screen.getByText('1º Aditivo')).toBeInTheDocument());
    expect(screen.getByText('Saldo de valor')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Auditoria/ }), { button: 0 });
    await waitFor(() => expect(screen.getByText('Auditoria & Recálculos Automáticos')).toBeInTheDocument());
  });

  it('a aba Auditoria mostra a tabela de eventos e o painel de comparação', async () => {
    dados.auditoria = [{
      id: 'ev-1', contrato_id: 'c-1', arquivo_id: 'f-1', arquivo_nome: 'contrato.pdf',
      campo: 'valor_global', valor_anterior: '1000', valor_novo: '1100',
      origem: 'ia_extracao', created_at: '2026-02-10T12:00:00Z',
    }];
    envolver(<ContratoArquivos contratoId="c-1" />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Auditoria/ })).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Auditoria/ }), { button: 0 });

    await waitFor(() => expect(screen.getByText('Valor Global')).toBeInTheDocument());
    expect(screen.getByText('Responsável')).toBeInTheDocument();
    expect(screen.getByText('IA de leitura de documentos')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Valor Global'));
    await waitFor(() => expect(screen.getByText('Antes (contrato atual)')).toBeInTheDocument());
    expect(screen.getByText('Proposto (novo aditivo)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conferir alteração/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver documento/ })).toBeInTheDocument();
  });
});
