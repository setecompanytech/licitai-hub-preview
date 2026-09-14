import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * A tela onde o cálculo vira limite do robô. O que se trava aqui:
 *
 *  - migration não aplicada aparece como tal — nunca como "sem versões";
 *  - "Aprovar limites" não é clicável por quem não administra, nem com
 *    pendência que bloqueia, e diz o motivo em texto visível;
 *  - aprovar passa pela função do banco (que confere papel e pendências);
 *  - a memória de cálculo nomeia a margem como "sobre a venda".
 *
 * Nenhuma chamada sai para o banco: supabase, sessão e papel são dublês.
 */

// ── Dublês ────────────────────────────────────────────────────────────────

type Resposta = { data: unknown; error: unknown };
const respostas: Record<string, Resposta> = {};
const rpc = vi.fn();

const criarQuery = (tabela: string) => {
  let operacao = 'select';
  const q: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single']) q[metodo] = () => q;
  for (const metodo of ['insert', 'update', 'delete']) {
    q[metodo] = () => {
      operacao = metodo;
      return q;
    };
  }
  q.then = (ok: unknown, falha: unknown) =>
    Promise.resolve(respostas[`${tabela}:${operacao}`] ?? { data: null, error: null }).then(ok as never, falha as never);
  return q;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => criarQuery(tabela),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => {
  const auth = { user: { id: 'user-1' } };
  return { useAuth: () => auth };
});

/* Papel trocado por teste. O objeto é o MESMO a cada render (o hook real
   devolve um useMemo); só os campos mudam entre casos. */
const papel = { papel: 'admin' as string | null, isAdmin: true, podeOperar: true, isViewer: false };
vi.mock('@/hooks/usePapelEmpresa', () => ({ usePapelEmpresa: () => papel }));

import AprovacaoDePrecificacao from './AprovacaoDePrecificacao';
import { calcularVersao, type ItemDePrecificacao, type PremissasDaVersao } from '@/lib/precificacao/versao';

// ── Dados ─────────────────────────────────────────────────────────────────

const informado = { fonte: 'informado_pelo_usuario' as const };

/** Valores de teste, não padrão do produto: 10 + 5 + 0 + 10 = 25% → divisor 0,75. */
const premissas = (over: Partial<PremissasDaVersao> = {}): PremissasDaVersao => ({
  camadas: { pctImpostos: 10, pctDespesasAdmin: 5, pctDespesasOperacionais: 0, pctMargem: 10 },
  origem: { pctImpostos: informado, pctDespesasAdmin: informado, pctDespesasOperacionais: informado, pctMargem: informado },
  criterio: 'menor_preco_item',
  ...over,
});

const ITEM: ItemDePrecificacao = {
  licitacaoItemId: 'it-1',
  numero: 1,
  lote: null,
  descricao: 'Caneta esferográfica azul',
  quantidade: 10,
  unidade: 'UN',
  custoUnitario: 75,
  limite: 90,
};

/** Uma versão gravada como a tela gravaria: linhas produzidas pelo próprio cálculo. */
function versaoGravada(p: PremissasDaVersao, over: Record<string, unknown> = {}) {
  const calculada = calcularVersao([ITEM], p);
  return {
    id: 'v-2',
    empresa_id: 'emp-1',
    licitacao_id: 'lic-1',
    numero: 2,
    situacao: 'rascunho',
    criterio_disputa: p.criterio,
    premissas: p,
    documentos_usados: [],
    total_inicial_centavos: calculada.totalInicialCentavos,
    observacao: null,
    criado_por: 'user-1',
    submetida_por: null,
    submetida_em: null,
    aprovada_por: null,
    aprovada_em: null,
    substituida_por_versao_id: null,
    created_at: '2026-09-14T12:00:00Z',
    updated_at: '2026-09-14T12:00:00Z',
    itens: calculada.itens.map((c, i) => ({
      id: `linha-${i}`,
      versao_id: 'v-2',
      empresa_id: 'emp-1',
      licitacao_item_id: c.item.licitacaoItemId,
      numero: c.item.numero,
      lote: c.item.lote,
      descricao: c.item.descricao,
      quantidade: c.item.quantidade,
      unidade: c.item.unidade,
      fornecedor: null,
      cotacao_referencia: null,
      cotacao_data: null,
      cotacao_validade: null,
      marca: null,
      fabricante: null,
      modelo: null,
      custo_unitario: c.item.custoUnitario,
      frete_unitario: null,
      seguro_unitario: null,
      outras_despesas_unitario: null,
      valor_estimado_orgao: null,
      preco_sugerido_centavos: c.precoSugeridoCentavos,
      preco_inicial_centavos: c.precoInicialCentavos,
      limite_centavos: c.limiteCentavos,
      autorizado: c.autorizado,
      memoria: c.memoria,
    })),
    ...over,
  };
}

const montar = () =>
  render(
    <MemoryRouter>
      <AprovacaoDePrecificacao licitacaoId="lic-1" empresaId="emp-1" />
    </MemoryRouter>,
  );

function comoAdmin(admin: boolean) {
  papel.papel = admin ? 'admin' : 'operador';
  papel.isAdmin = admin;
  papel.podeOperar = true;
  papel.isViewer = false;
}

beforeEach(() => {
  for (const k of Object.keys(respostas)) delete respostas[k];
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  comoAdmin(true);
  respostas['licitacao_itens:select'] = { data: [], error: null };
  respostas['financeiro_indicadores_adotados:select'] = { data: null, error: null };
  respostas['profiles:select'] = { data: [], error: null };
});

// ── Casos ─────────────────────────────────────────────────────────────────

describe('AprovacaoDePrecificacao', () => {
  it('migration não aplicada: diz que falta atualizar o banco, em vez de mostrar tela vazia', async () => {
    respostas['precificacao_versoes:select'] = {
      data: null,
      error: { code: '42P01', message: 'relation "public.precificacao_versoes" does not exist' },
    };
    montar();
    expect(
      await screen.findByText('Migração pendente — peça ao administrador para aplicar a atualização do banco'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar limites' })).not.toBeInTheDocument();
  });

  it('processo sem itens extraídos aponta para a extração do edital', async () => {
    respostas['precificacao_versoes:select'] = { data: [], error: null };
    montar();
    expect(await screen.findByText('Nenhum item extraído para este processo')).toBeInTheDocument();
  });

  it('operador não aprova: botão desabilitado com o motivo à vista', async () => {
    comoAdmin(false);
    respostas['precificacao_versoes:select'] = { data: [versaoGravada(premissas())], error: null };
    montar();
    const botao = await screen.findByRole('button', { name: 'Aprovar limites' });
    expect(botao).toBeDisabled();
    expect(screen.getByText('Aprovar limites exige administrador da empresa.')).toBeInTheDocument();
    // O próximo passo de quem opera é submeter.
    expect(screen.getByRole('button', { name: 'Submeter para aprovação' })).toBeEnabled();
    expect(screen.getByText('Versão 2 ainda não liberada para o robô')).toBeInTheDocument();
  });

  it('pendência que bloqueia trava a aprovação mesmo para administrador', async () => {
    respostas['precificacao_versoes:select'] = {
      data: [versaoGravada(premissas({ criterio: 'nao_informado' }))],
      error: null,
    };
    montar();
    const botao = await screen.findByRole('button', { name: 'Aprovar limites' });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/1 pendência bloqueia a aprovação/)).toBeInTheDocument();
    expect(screen.getByText(/Critério de disputa não informado/)).toBeInTheDocument();
  });

  it('administrador aprova pela função do banco, depois de confirmar', async () => {
    respostas['precificacao_versoes:select'] = { data: [versaoGravada(premissas())], error: null };
    montar();
    const botao = await screen.findByRole('button', { name: 'Aprovar limites' });
    expect(botao).toBeEnabled();
    expect(
      screen.getAllByText(
        'Aprovar limites não envia proposta nem ativa o robô. Disputas em andamento não mudam de limite automaticamente.',
      ).length,
    ).toBeGreaterThan(0);

    fireEvent.click(botao);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar aprovação' }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('aprovar_precificacao_versao', { p_versao_id: 'v-2' }),
    );
  });

  it('a mensagem de recusa do servidor aparece como veio', async () => {
    respostas['precificacao_versoes:select'] = { data: [versaoGravada(premissas())], error: null };
    rpc.mockResolvedValue({ data: null, error: { message: '1 item(ns) autorizado(s) sem preço inicial ou com limite inválido.' } });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar limites' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar aprovação' }));
    expect(
      await screen.findByText('1 item(ns) autorizado(s) sem preço inicial ou com limite inválido.'),
    ).toBeInTheDocument();
  });

  it('a memória de cálculo do item nomeia a margem como sobre a venda', async () => {
    respostas['precificacao_versoes:select'] = { data: [versaoGravada(premissas())], error: null };
    montar();
    fireEvent.click(await screen.findByText('Caneta esferográfica azul'));

    const memoria = await screen.findByRole('region', { name: 'Memória de cálculo' });
    expect(within(memoria).getByText('Margem sobre a venda')).toBeInTheDocument();
    expect(within(memoria).getByText('Acréscimo sobre o custo (conferência)')).toBeInTheDocument();
    // 75 ÷ 0,75 = R$ 100,00, arredondado uma vez, no cálculo.
    expect(within(memoria).getAllByText('R$ 100,00').length).toBeGreaterThan(0);
    expect(within(memoria).getByText('Cálculo determinístico, arredondado ao centavo. A IA não altera estes valores.')).toBeInTheDocument();
  });

  it('quem só acompanha vê limites, sem custo, pela função de limites operacionais', async () => {
    papel.papel = 'viewer';
    papel.isAdmin = false;
    papel.podeOperar = false;
    papel.isViewer = true;
    rpc.mockImplementation(async (nome: string) =>
      nome === 'limites_operacionais_do_processo'
        ? {
            data: [
              {
                versao_id: 'v-1', versao_numero: 1, aprovada_em: '2026-09-13T18:30:00Z', criterio_disputa: 'menor_preco_item',
                licitacao_item_id: 'it-1', numero: 1, lote: null, descricao: 'Caneta esferográfica azul',
                preco_inicial_centavos: 10_000, limite_centavos: 9_000,
              },
            ],
            error: null,
          }
        : { data: null, error: null },
    );
    montar();
    expect(await screen.findByText(/Custos restritos ao seu papel/)).toBeInTheDocument();
    expect(await screen.findByText('R$ 90,00')).toBeInTheDocument();
    expect(screen.queryByText('Custo unitário')).not.toBeInTheDocument();
  });
});
