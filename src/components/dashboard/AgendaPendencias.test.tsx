import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Agenda do painel — o que o print de 16/09 mostrou quebrado.
 *
 *  1. o cartão dizia "86": o campo `numero` do PNCP é só o sequencial, e a
 *     identidade de um processo é modalidade + número + ano;
 *  2. processo ARQUIVADO aparecia como "Atrasado" — a regra já estava escrita
 *     no componente, mas `arquivado_em` não vinha na consulta do painel;
 *  3. o rodapé somava o atraso ao "nos próximos 30 dias", que é futuro.
 *
 * Os documentos vêm de um hook próprio, mockado vazio: o que está sob teste é
 * o tratamento dos processos.
 */

vi.mock('@/hooks/useVencimentosDeDocumentos', () => ({
  useVencimentosDeDocumentos: () => ({
    documentos: [], carregando: false, erro: null, recarregar: vi.fn(),
  }),
  ROTA_DA_ORIGEM: {
    documento: '/documentos',
    certificado_empresa: '/configuracoes',
    certificado_portal: '/robo-lances',
  },
}));

/** O espelho PNCP também vem de hook próprio; cada teste diz o que o órgão publicou. */
const espelho = vi.hoisted(() => ({
  situacoes: {} as Record<string, { situacao: string | null; atualizadoEm: string | null }>,
}));

vi.mock('@/hooks/useSituacaoDoEspelhoPNCP', () => ({
  useSituacaoDoEspelhoPNCP: () => ({
    situacoes: espelho.situacoes, carregando: false, erro: null, recarregar: vi.fn(),
  }),
}));

import AgendaPendencias, { type ProcessoDaAgenda } from './AgendaPendencias';

beforeEach(() => {
  espelho.situacoes = {};
});

/** Data relativa ao dia de hoje — nada de data fixa, que expira com o tempo. */
const emDias = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString();

const processo = (over: Partial<ProcessoDaAgenda> & { id: string }): ProcessoDaAgenda => ({
  numero: '86',
  modalidade: 'Pregão - Eletrônico',
  ano_compra: '2026',
  orgao: 'TRIBUNAL SUPERIOR ELEITORAL',
  status: 'Em Disputa',
  data_abertura: null,
  data_encerramento: emDias(-3),
  arquivado_em: null,
  ...over,
});

const montar = (processos: ProcessoDaAgenda[]) =>
  render(
    <MemoryRouter>
      <AgendaPendencias processos={processos} carregandoProcessos={false} />
    </MemoryRouter>,
  );

describe('AgendaPendencias', () => {
  it('nomeia o processo pela identidade, não pelo sequencial cru do PNCP', () => {
    montar([processo({ id: 'p1' })]);

    expect(screen.getByText('PE nº 86/2026')).toBeInTheDocument();
    expect(screen.queryByText('86')).not.toBeInTheDocument();
  });

  it('processo arquivado não entra na agenda — nem vencido, nem programado', () => {
    montar([
      processo({ id: 'p1', numero: '15', orgao: 'COMANDO DO EXERCITO', status: 'Monitorando', arquivado_em: emDias(-6) }),
      processo({ id: 'p2', numero: '21', orgao: 'CRECI', status: 'Monitorando', arquivado_em: emDias(-6), data_encerramento: emDias(5) }),
      processo({ id: 'p3', numero: '90', orgao: 'MUNICIPIO DE BELEM' }),
    ]);

    expect(screen.queryByText('PE nº 15/2026')).not.toBeInTheDocument();
    expect(screen.queryByText('PE nº 21/2026')).not.toBeInTheDocument();
    expect(screen.getByText('PE nº 90/2026')).toBeInTheDocument();
  });

  it('processo decidido não vira atraso: o prazo passou porque ele terminou', () => {
    montar([processo({ id: 'p1', numero: '30', status: 'Perdida', data_encerramento: emDias(-5) })]);

    expect(screen.queryByText('PE nº 30/2026')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum prazo nos próximos 30 dias')).toBeInTheDocument();
  });

  it('processo EM JOGO com encerramento passado está em andamento — não é atraso', () => {
    // Encerramento é o fim do recebimento de propostas, não do processo: quem
    // está em disputa não está atrasado (dono, 19/09).
    montar([processo({ id: 'p1', status: 'Em Disputa', data_encerramento: emDias(-3) })]);

    expect(screen.getByText('PE nº 86/2026')).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument();
    expect(screen.getByText(/Propostas encerradas ·/)).toBeInTheDocument();
  });

  it('processo no RADAR com encerramento passado pede atualização da situação', () => {
    montar([processo({ id: 'p1', status: 'Monitorando', data_encerramento: emDias(-3) })]);

    expect(screen.getByText('Situação a atualizar')).toBeInTheDocument();
    expect(screen.queryByText('Atrasado')).not.toBeInTheDocument();
  });

  it('sessão passada de processo em jogo é "Sessão realizada", não prazo', () => {
    montar([processo({ id: 'p1', status: 'Proposta Enviada', data_abertura: emDias(-1), data_encerramento: null })]);

    expect(screen.getByText(/Sessão realizada ·/)).toBeInTheDocument();
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });

  it('o rodapé separa o que pede ação do que vai acontecer e do que está em andamento', () => {
    const semSituacao = Array.from({ length: 8 }, (_, i) =>
      processo({ id: `a${i}`, numero: String(100 + i), status: 'Monitorando', data_encerramento: emDias(-(i + 1)) }));
    const futuros = Array.from({ length: 2 }, (_, i) =>
      processo({ id: `f${i}`, numero: String(200 + i), data_encerramento: emDias(i + 2) }));
    const emAndamento = [processo({ id: 'e1', numero: '300', status: 'Em Disputa', data_encerramento: emDias(-2) })];

    montar([...semSituacao, ...futuros, ...emAndamento]);

    // 6 cabem na lista (os 8 sem situação vêm primeiro); sobram 2 sem situação,
    // 2 programados e 1 em andamento.
    expect(screen.getByText('+5 com prazo · 2 com situação a atualizar · 2 nos próximos 30 dias · 1 em andamento')).toBeInTheDocument();
  });

  it('compra revogada no espelho PNCP pede desfecho — no lugar do prazo', () => {
    espelho.situacoes = { 'PNCP-1': { situacao: 'Revogada', atualizadoEm: emDias(-1) } };
    montar([processo({ id: 'p1', status: 'Monitorando', numero_controle_pncp: 'PNCP-1', data_encerramento: emDias(-3) })]);

    expect(screen.getByText('Revogada no PNCP')).toBeInTheDocument();
    expect(screen.getByText(/Desfecho a registrar ·/)).toBeInTheDocument();
    // A linha do encerramento não aparece junto: seria cobrar prazo de compra que não existe mais.
    expect(screen.queryByText('Situação a atualizar')).not.toBeInTheDocument();
    expect(screen.queryByText(/Propostas encerradas/)).not.toBeInTheDocument();
  });

  it('compra suspensa pede conferência, não desfecho — e vale também para processo em jogo', () => {
    espelho.situacoes = { 'PNCP-2': { situacao: 'Suspensa', atualizadoEm: emDias(0) } };
    montar([processo({ id: 'p1', status: 'Em Disputa', numero_controle_pncp: 'PNCP-2' })]);

    expect(screen.getByText('Suspensa no PNCP')).toBeInTheDocument();
    expect(screen.getByText(/Suspensão a conferir ·/)).toBeInTheDocument();
    expect(screen.queryByText('Em andamento')).not.toBeInTheDocument();
  });

  it('espelho revogado de processo já decidido não entra: o desfecho já foi registrado', () => {
    espelho.situacoes = { 'PNCP-3': { situacao: 'Revogada', atualizadoEm: emDias(-1) } };
    montar([processo({ id: 'p1', status: 'Perdida', numero_controle_pncp: 'PNCP-3', data_encerramento: emDias(-5) })]);

    expect(screen.queryByText('Revogada no PNCP')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum prazo nos próximos 30 dias')).toBeInTheDocument();
  });

  it('situação normal do espelho ("Divulgada no PNCP") não muda nada', () => {
    espelho.situacoes = { 'PNCP-4': { situacao: 'Divulgada no PNCP', atualizadoEm: emDias(-1) } };
    montar([processo({ id: 'p1', status: 'Monitorando', numero_controle_pncp: 'PNCP-4', data_encerramento: emDias(-3) })]);

    expect(screen.getByText('Situação a atualizar')).toBeInTheDocument();
    expect(screen.queryByText(/no PNCP$/)).not.toBeInTheDocument();
  });
});
