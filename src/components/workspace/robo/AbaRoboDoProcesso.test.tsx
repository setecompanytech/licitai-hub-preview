import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Aba "Robô de Lances" da pasta do processo — o que ela não pode dizer errado.
 *
 *  - Sem participação: diz que não há, e leva a configurar — não simula nada.
 *  - Parar tem dois tempos: pedido sem confirmação do agente é "aguardando
 *    confirmação", NUNCA "Parado".
 *  - Quem só acompanha (viewer) vê o botão desabilitado e o motivo.
 *  - Sinal velho é marcado como velho.
 *  - Fase marcada à mão diz que o portal não confirmou.
 *  - Lance por item casa por lote + número, nunca por descrição; migração
 *    pendente e envio indisponível aparecem como tais.
 *
 * NADA aqui chama portal nem agente: o hook, o comando de parada e o banco
 * são dublês.
 */

const { solicitarParada } = vi.hoisted(() => ({ solicitarParada: vi.fn() }));
vi.mock('@/lib/robo/comandos', () => ({ solicitarParada }));

const papel = { papel: 'operador' as string | null, isAdmin: false, podeOperar: true, isViewer: false };
vi.mock('@/hooks/usePapelEmpresa', () => ({ usePapelEmpresa: () => papel }));

/* O hook devolve o MESMO objeto a cada render. Um literal novo por chamada
   mudaria `lidoEm`, `participacoes` e `recarregar` a cada render — e os
   efeitos que dependem deles releriam para sempre. O hook de verdade guarda
   tudo em estado; o dublê imita guardando a referência aqui fora. */
let estadoDoHook: unknown = null;
vi.mock('@/hooks/useParticipacoesDoRobo', () => ({ useParticipacoesDoRobo: () => estadoDoHook }));

type Resposta = { data: unknown; error: unknown };
const respostas: Record<string, Resposta> = {};

/** Consulta encadeável e "thenable", como a do supabase-js. */
const criarQuery = (tabela: string) => {
  const resolver = () => Promise.resolve(respostas[tabela] ?? { data: [], error: null });
  const q: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'in', 'or', 'order', 'limit', 'maybeSingle', 'single']) {
    q[metodo] = () => q;
  }
  q.then = (ok: unknown, falha: unknown) => resolver().then(ok as never, falha as never);
  return q;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (tabela: string) => criarQuery(tabela) },
}));

import AbaRoboDoProcesso from './AbaRoboDoProcesso';

// ── Dados ─────────────────────────────────────────────────────────────────

const LIDO_EM = new Date();
const recarregar = vi.fn(() => Promise.resolve());
const SEM_CAPACIDADE = { portaisComLanceLiberado: [], fonte: 'nao_verificada', verificadaEm: null };

interface Ajustes {
  projecao?: Record<string, unknown>;
  sessao?: Record<string, unknown> | null;
  disputa?: Record<string, unknown>;
}

function participacao({ projecao = {}, sessao = {}, disputa = {} }: Ajustes = {}) {
  return {
    disputa: {
      id: 'disputa-1',
      empresa_id: 'emp-1',
      licitacao_id: 'lic-1',
      edital: 'PE 90014/2025',
      portal: 'Compras.gov',
      status: 'ativo',
      tipo_disputa: 'item',
      horario: null,
      valor_inicial: 1000,
      valor_minimo: null,
      valor_referencia: null,
      itens: [{ numero: 1, lote: '1', descricao: 'Papel A4', valorMinimo: 800 }],
      modo_automatico: false,
      decremento_min: 5,
      decremento_percentual: 1.5,
      intervalo_segundos: 30,
      max_lances: 20,
      created_at: '2026-09-14T12:00:00Z',
      updated_at: '2026-09-14T12:00:00Z',
      precificacao_versao_id: null,
      limites_confirmados_em: null,
      ...disputa,
    },
    processo: {
      id: 'lic-1',
      numero: '90014/2025',
      orgao: 'Prefeitura Municipal de Exemplo',
      objeto: 'Material de expediente',
      data_abertura: null,
      operador_id: null,
      status: 'Em Disputa',
    },
    sessao:
      sessao === null
        ? null
        : {
            id: 'sessao-1',
            status: 'ativo',
            modo: 'real',
            updated_at: new Date().toISOString(),
            parada_solicitada_em: null,
            parada_confirmada_em: null,
            erro: null,
            licitacao_id: 'lic-1',
            lance_config_id: 'disputa-1',
            portal_nome: 'Compras.gov',
            valor_atual: null,
            rodada_atual: null,
            created_at: '2026-09-14T12:00:00Z',
            ...sessao,
          },
    ultimoLanceProprio: null,
    melhorLanceInformado: null,
    projecao: {
      aba: 'em_disputa',
      faseInformadaPor: 'agente',
      estadoDoRobo: 'operando',
      lanceLiberadoNoPortal: false,
      itensSemLimite: 0,
      pendenciaPrincipal: null,
      proximaAcao: null,
      ...projecao,
    },
  };
}

function definirHook(participacoes: unknown[]) {
  estadoDoHook = {
    participacoes,
    carregando: false,
    erro: null,
    semEmpresa: false,
    lidoEm: LIDO_EM,
    capacidade: SEM_CAPACIDADE,
    recarregar,
  };
}

const montar = () =>
  render(
    <MemoryRouter>
      <AbaRoboDoProcesso licitacaoId="lic-1" empresaId="emp-1" />
    </MemoryRouter>,
  );

beforeEach(() => {
  for (const chave of Object.keys(respostas)) delete respostas[chave];
  papel.papel = 'operador';
  papel.podeOperar = true;
  papel.isViewer = false;
  solicitarParada.mockReset();
  recarregar.mockClear();
});

// ── Casos ─────────────────────────────────────────────────────────────────

describe('AbaRoboDoProcesso', () => {
  it('sem participação: diz que não há e leva a configurar no Robô de Lances', () => {
    definirHook([]);
    montar();
    expect(screen.getByText('Nenhuma participação do robô para este processo')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Configurar no Robô de Lances' }).getAttribute('href')).toBe(
      '/robo-lances?lid=lic-1',
    );
    // Nada foi pedido ao serviço só por abrir a aba.
    expect(solicitarParada).not.toHaveBeenCalled();
  });

  it('parada "solicitada" mostra aguardando confirmação — nunca "Parado"', async () => {
    definirHook([participacao()]);
    solicitarParada.mockResolvedValue({
      estado: 'solicitada',
      sessaoId: 'sessao-1',
      solicitadaEm: '2026-09-14T13:00:05Z',
      confirmadaEm: null,
      motivo: 'O agente ainda não confirmou o encerramento.',
    });
    montar();

    fireEvent.click(screen.getByRole('button', { name: /Parar robô nesta disputa/ }));
    // O diálogo diz, antes do clique final, o que parar NÃO desfaz.
    expect(await screen.findByText(/não cancela lances já aceitos pelo portal/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar parada' }));

    expect(await screen.findByText('Parada solicitada — aguardando confirmação')).toBeTruthy();
    expect(solicitarParada).toHaveBeenCalledWith('sessao-1');
    await waitFor(() => expect(recarregar).toHaveBeenCalled());
    // 13:00:05 UTC é 10:00:05 em Brasília.
    expect(screen.getByText(/Pedido registrado às 10:00:05 • horário de Brasília/)).toBeTruthy();
    expect(screen.queryByText('Parado')).toBeNull();
    expect(screen.queryByText(/Parada confirmada/)).toBeNull();
  });

  it('quem só acompanha vê o botão de parar desabilitado, com o motivo', async () => {
    papel.papel = 'viewer';
    papel.podeOperar = false;
    papel.isViewer = true;
    definirHook([participacao()]);
    montar();
    // Espera a leitura dos itens da sessão assentar antes de medir.
    await screen.findByText('Item 1');

    const botao = screen.getByRole('button', { name: /Parar robô nesta disputa/ }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(screen.getByText(/papel nesta empresa é de acompanhamento/)).toBeTruthy();
    fireEvent.click(botao);
    expect(screen.queryByText(/não cancela lances já aceitos/)).toBeNull();
    expect(solicitarParada).not.toHaveBeenCalled();
  });

  it('sinal velho aparece como "Sem atualização recente", com a hora de Brasília', async () => {
    definirHook([
      participacao({
        projecao: { estadoDoRobo: 'sinal_desatualizado' },
        sessao: { updated_at: '2026-09-14T13:02:13Z' },
      }),
    ]);
    montar();
    await screen.findByText('Item 1');

    expect(screen.getByText('Atualização recebida às 10:02:13 • horário de Brasília')).toBeTruthy();
    // No estado do robô e na marca ao lado da hora do sinal.
    expect(screen.getAllByText('Sem atualização recente').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Monitorando')).toBeNull();
  });

  it('fase marcada manualmente diz que o portal não confirmou', () => {
    definirHook([participacao({ projecao: { aba: 'em_disputa', faseInformadaPor: 'marcacao_manual' }, sessao: null })]);
    montar();

    expect(screen.getByText('Em disputa')).toBeTruthy();
    expect(screen.getByText('marcada manualmente — o portal não confirmou')).toBeTruthy();
    expect(screen.queryByText('informada pelo agente')).toBeNull();
    // Sem sessão, não há o que parar.
    expect(screen.queryByRole('button', { name: /Parar robô nesta disputa/ })).toBeNull();
  });

  it('casa o lance por lote e número (não por descrição) e expõe migração pendente e envio indisponível', async () => {
    respostas.sessao_lance_itens = {
      data: [
        {
          sessao_id: 'sessao-1',
          numero: 2,
          lote: '1',
          // A mesma descrição do item 1 — isca para um casamento por texto.
          descricao: 'Papel A4',
          seu_ultimo_lance: 950,
          melhor_lance: 940,
          sou_lider: false,
          situacao: 'disputando',
          valor_minimo: null,
          licitacao_item_id: null,
        },
      ],
      error: null,
    };
    respostas.precificacao_versoes = {
      data: null,
      error: { code: '42P01', message: 'relation "public.precificacao_versoes" does not exist' },
    };
    definirHook([
      participacao({
        disputa: {
          precificacao_versao_id: 'versao-1',
          itens: [
            { numero: 1, lote: '1', descricao: 'Papel A4', valorMinimo: 800 },
            { numero: 2, lote: '1', descricao: 'Caneta esferográfica', valorMinimo: null },
          ],
        },
      }),
    ]);
    montar();

    const lance = await screen.findByText(/950,00/);
    const linhaDoItem2 = lance.closest('tr')!;
    expect(within(linhaDoItem2).getByText('Item 2')).toBeTruthy();
    expect(within(linhaDoItem2).getByText('Outro participante lidera')).toBeTruthy();

    const linhaDoItem1 = screen.getByText('Item 1').closest('tr')!;
    expect(within(linhaDoItem1).queryByText(/950,00/)).toBeNull();
    expect(within(linhaDoItem1).getAllByText('Não informado').length).toBeGreaterThanOrEqual(2);
    expect(within(linhaDoItem1).getByText('não confirmado pelo serviço')).toBeTruthy();

    expect(await screen.findByText(/Migração pendente — as versões da precificação/)).toBeTruthy();
    expect(screen.getByText('Envio de lances indisponível — somente monitoramento')).toBeTruthy();
    expect(screen.getByText('Não rastreada — sem confirmação do portal')).toBeTruthy();
  });
});
