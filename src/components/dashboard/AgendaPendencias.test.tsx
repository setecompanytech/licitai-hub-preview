import { describe, expect, it, vi } from 'vitest';
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

import AgendaPendencias, { type ProcessoDaAgenda } from './AgendaPendencias';

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

  it('processo em aberto com prazo vencido é atraso de verdade e continua na agenda', () => {
    montar([processo({ id: 'p1', status: 'Em Disputa', data_encerramento: emDias(-3) })]);

    expect(screen.getByText('PE nº 86/2026')).toBeInTheDocument();
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });

  it('o rodapé separa o que está em atraso do que ainda vai acontecer', () => {
    const atrasados = Array.from({ length: 8 }, (_, i) =>
      processo({ id: `a${i}`, numero: String(100 + i), data_encerramento: emDias(-(i + 1)) }));
    const futuros = Array.from({ length: 2 }, (_, i) =>
      processo({ id: `f${i}`, numero: String(200 + i), data_encerramento: emDias(i + 2) }));

    montar([...atrasados, ...futuros]);

    // 6 cabem na lista (todos atrasados); sobram 2 atrasados e 2 programados.
    expect(screen.getByText('+4 com prazo · 2 em atraso · 2 nos próximos 30 dias')).toBeInTheDocument();
  });
});
