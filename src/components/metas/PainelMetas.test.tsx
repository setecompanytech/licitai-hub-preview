import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PainelMetas from './PainelMetas';
import { APURACAO } from '@/lib/metas/apuracao';
import type { BaseMeta } from '@/lib/metas/painel';

/**
 * O painel de Metas mistura números que NÃO compartilham critério de apuração.
 *
 * `vw_comercial_realizado_mensal` põe cada métrica num mês por uma data
 * diferente: participação pela data de envio da proposta, contrato pela
 * assinatura, pedido pela data do pedido, NF-e pela quitação. Lidos lado a
 * lado sem essa informação, "ganhou 3 e faturou 2" parece queda de desempenho
 * e costuma ser só o calendário.
 *
 * Estes casos travam duas regras que se perdem com facilidade num refactor
 * visual:
 *
 *  1. todo número exibido declara a DATA que o define;
 *  2. valor que não existe aparece como ausência declarada, nunca como zero —
 *     zero é uma afirmação sobre o mês ("não faturou"), a ausência é uma
 *     afirmação sobre o sistema ("ninguém definiu o alvo").
 */

// Radix mede o gatilho do Select ao montar; o jsdom não traz ResizeObserver.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as never;

const hojeSP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const [ANO, MES] = hojeSP.split('-').map(Number);

const MEMBRO = {
  user_id: 'u1',
  nome: 'Ana Vendas',
  email: 'ana@exemplo.com',
  equipe: 'comercial',
  papel: 'operador',
  praca_uf: null,
  praca_municipio: null,
};

const CONFIG = {
  id: 'cfg', empresa_id: 'e1',
  janela_historica_meses: 6,
  alerta_dias_limite: 10,
  alerta_percentual_minimo: 70,
  min_amostra_ticket: 3,
  tx_ganho_padrao: 0.25,
  tx_faturamento_padrao: 0.8,
  min_anos_sazonalidade: 2,
};

/** Movimento do mês, com valores diferentes em cada ponta de propósito. */
const REALIZADO = [{
  empresa_id: 'e1', user_id: 'u1', ano: ANO, mes: MES,
  participados: 10, ganhos: 3, perdidos: 1,
  valor_ganho: 80000, valor_perdido: 0,
  pedidos_faturados: 2, valor_faturado: 30000,
  nfe_quitadas: 1, valor_quitado: 12000,
}];

const metaCom = (patch: Partial<{ meta_faturamento: number; meta_quitacao: number | null; meta_contratos: number | null; base_meta: BaseMeta }>) => ([{
  id: 'm1', empresa_id: 'e1', user_id: 'u1', ano: ANO, mes: MES,
  meta_faturamento: 100000,
  meta_quitacao: 60000,
  meta_contratos: 5,
  meta_participacoes: 20,
  base_meta: 'faturamento' as BaseMeta,
  observacao: null,
  ...patch,
}]);

// Estado que cada caso ajusta antes de montar.
const dados = {
  metas: metaCom({}) as ReturnType<typeof metaCom>,
  valoresAlvo: [] as unknown[],
  contratos: [] as unknown[],
};

vi.mock('@/hooks/useMetasComercial', () => ({
  useMetasConfig: () => ({ data: CONFIG }),
  useValoresAlvo: () => ({ data: dados.valoresAlvo }),
  useRealizadoMensal: () => ({ data: REALIZADO, isLoading: false }),
  useFeriados: () => ({ data: [] }),
  useColaboradores: () => ({ data: [MEMBRO], isLoading: false }),
  useMetas: () => ({ data: dados.metas }),
  useContratosAssinados: () => ({ data: dados.contratos }),
}));

vi.mock('@/hooks/useAuthorization', () => ({
  useAuthorization: () => ({ isAdmin: true, loading: false }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'ana@exemplo.com' } }),
}));

const montar = () =>
  render(<MemoryRouter><PainelMetas /></MemoryRouter>);

/** Texto da tela com o espaço fino do R$ normalizado, para casar por regex. */
const textoDaTela = (container: HTMLElement) =>
  (container.textContent ?? '').replace(/[\u00a0\u202f]/g, ' ');

describe('PainelMetas — cada número diz por qual data foi apurado', () => {
  beforeEach(() => {
    dados.metas = metaCom({});
    dados.valoresAlvo = [];
    dados.contratos = [];
  });

  it('as três pontas do mês declaram, cada uma, a própria base de apuração', () => {
    const { container } = montar();
    const texto = textoDaTela(container);

    // Contrato pela assinatura, pedido pela data do pedido, NF-e pela quitação.
    expect(texto).toContain(APURACAO.ganhos.curto);
    expect(texto).toContain(APURACAO.pedidos_faturados.curto);
    expect(texto).toContain(APURACAO.nfe_quitadas.curto);

    // E o aviso que impede a soma das três.
    expect(screen.getAllByText(/não se somam/i).length).toBeGreaterThan(0);
  });

  it('o realizado declara a data da base escolhida — faturamento pelo pedido', () => {
    const { container } = montar();
    expect(textoDaTela(container)).toContain(APURACAO.pedidos_faturados.curto);
  });

  it('trocar a base principal troca a data declarada no realizado', () => {
    dados.metas = metaCom({ base_meta: 'nf_quitada' });
    const { container } = montar();
    const texto = textoDaTela(container);

    // O realizado agora é medido pela quitação, e a linha de Progresso diz isso.
    expect(texto).toContain(`Progresso · ${APURACAO.nfe_quitadas.curto}`);
  });

  it('participações e contratos a fazer declaram as datas que os medem', () => {
    const { container } = montar();
    const texto = textoDaTela(container);

    expect(texto).toContain(`propostas a enviar · ${APURACAO.participados.curto}`);
    expect(texto).toContain(`a ganhar · ${APURACAO.ganhos.curto}`);
  });

  it('a base de apuração está escrita, não só no title do elemento', () => {
    montar();
    // `getAllByText` só acha o que está no texto renderizado — um `title`
    // sozinho não passaria neste caso.
    expect(screen.getAllByText(APURACAO.nfe_quitadas.curto, { exact: false }).length)
      .toBeGreaterThan(0);
  });
});

describe('PainelMetas — número ausente não vira zero', () => {
  beforeEach(() => {
    dados.metas = metaCom({});
    dados.valoresAlvo = [];
    dados.contratos = [];
  });

  /**
   * O motor projeta sempre contra `meta_faturamento`. Com a principal em
   * contratos ganhos e nenhum alvo em reais escrito, o painel exibia
   * "Meta do mês R$ 0,00 · Falta R$ 0,00 · Meta batida" — para quem não tinha
   * faturado nada.
   */
  it('sem alvo de faturamento, os valores monetários declaram a ausência', () => {
    dados.metas = metaCom({ base_meta: 'contratos_ganhos', meta_faturamento: 0, meta_quitacao: null });
    const { container } = montar();
    const texto = textoDaTela(container);

    expect(texto).toContain('Meta de faturamento não definida');
    expect(texto).not.toMatch(/R\$ 0,00/);
    expect(screen.queryByText('Meta batida')).toBeNull();
    expect(screen.queryByText(/Bate a meta no ritmo atual/)).toBeNull();
  });

  it('sem alvo de faturamento, a ponta principal continua medida', () => {
    dados.metas = metaCom({ base_meta: 'contratos_ganhos', meta_faturamento: 0, meta_quitacao: null });
    const { container } = montar();
    const texto = textoDaTela(container);

    // 3 contratos ganhos de uma meta de 5 — a ponta não some junto com a projeção.
    expect(texto).toContain('3');
    expect(texto).toContain(APURACAO.ganhos.curto);
  });

  /**
   * Ticket zerado não é "ticket de R$ 0,00": é ausência de apuração — nem
   * carteira na janela, nem valor-alvo cadastrado para a modalidade.
   */
  it('ticket ponderado sem carteira e sem valor-alvo aparece como indisponível', () => {
    const { container } = montar();
    const texto = textoDaTela(container);

    expect(texto).toContain('Sem carteira na janela e sem valor-alvo cadastrado');
    expect(screen.getAllByText('Indisponível.').length).toBeGreaterThan(0);
  });

  it('sem meta no mês, o vazio orienta E oferece ação — inclusive voltar um mês', () => {
    dados.metas = [];
    montar();

    expect(screen.getByText(/Sem meta definida para/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver o mês anterior/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Definir em Ferramentas/ })).toBeTruthy();
  });
});
