import { describe, it, expect } from 'vitest';
import { processoEncerradoNaLista, prazoDaDisputa } from './prazo-da-disputa';

/**
 * Processo vencido no cadastro do robô (Rafael, 17/09/2026): a 90029/2026, com
 * propostas até 30/07/2026, cadastrava como disputa normal.
 */
const AGORA = new Date('2026-09-17T14:00:00Z'); // 11:00 em Brasília

describe('prazoDaDisputa', () => {
  it('a compra de julho (o caso do Rafael) está encerrada, com data e hora de Brasília', () => {
    expect(prazoDaDisputa({ encerramentoPropostas: '2026-07-30T12:30:00Z', agora: AGORA })).toEqual({
      tipo: 'encerrado',
      quando: '30/07/2026 às 09:30',
      fonte: 'compra',
    });
  });

  it('sessão de hoje que já abriu avisa, mas não trava: a disputa pode estar em andamento', () => {
    expect(prazoDaDisputa({ encerramentoPropostas: '2026-09-17T12:00:00Z', agora: AGORA })).toEqual({
      tipo: 'comecou-hoje',
      quando: '09:00',
      fonte: 'compra',
    });
    expect(prazoDaDisputa({ encerramentoPropostas: '2026-09-17T18:00:00Z', agora: AGORA }).tipo).toBe('aberto');
  });

  it('dia é o de Brasília: 23:30 de ontem em Brasília já é 02:30 de hoje em UTC', () => {
    expect(prazoDaDisputa({ encerramentoPropostas: '2026-09-17T02:30:00Z', agora: AGORA }).tipo).toBe('encerrado');
  });

  it('a compra lida manda mais que a data digitada', () => {
    const p = prazoDaDisputa({ encerramentoPropostas: '2026-09-20T12:00:00Z', dataSessao: '2026-07-30', horario: '09:30', agora: AGORA });
    expect(p.tipo).toBe('aberto');
  });

  it('sem compra, vale a data da disputa — com ou sem horário', () => {
    expect(prazoDaDisputa({ dataSessao: '2026-09-16', horario: '09:00', agora: AGORA })).toEqual({
      tipo: 'encerrado',
      quando: '16/09/2026 às 09:00',
      fonte: 'disputa',
    });
    expect(prazoDaDisputa({ dataSessao: '2026-09-16', agora: AGORA }).quando).toBe('16/09/2026');
    expect(prazoDaDisputa({ dataSessao: '2026-09-17', horario: '10:00', agora: AGORA }).tipo).toBe('comecou-hoje');
    expect(prazoDaDisputa({ dataSessao: '2026-09-17', agora: AGORA }).tipo).toBe('aberto');
    expect(prazoDaDisputa({ dataSessao: '2026-09-18', horario: '09:00', agora: AGORA }).tipo).toBe('aberto');
  });

  it('sem data nenhuma não trava nada', () => {
    expect(prazoDaDisputa({ agora: AGORA }).tipo).toBe('sem-data');
    expect(prazoDaDisputa({ encerramentoPropostas: 'lixo', dataSessao: '', agora: AGORA }).tipo).toBe('sem-data');
  });
});

describe('processoEncerradoNaLista', () => {
  const vivo = { status: 'Monitorando', resultado: null, arquivado_em: null, data_encerramento: '2026-09-20T12:00:00Z' };

  it('processo em aberto aparece', () => {
    expect(processoEncerradoNaLista(vivo, AGORA)).toBeNull();
    expect(processoEncerradoNaLista({ ...vivo, data_encerramento: null }, AGORA)).toBeNull();
  });

  it('Perdida, cancelado (que cai em Perdida), Homologada e desfecho em resultado são decididos', () => {
    expect(processoEncerradoNaLista({ ...vivo, status: 'Perdida' }, AGORA)).toBe('decidido');
    expect(processoEncerradoNaLista({ ...vivo, status: 'cancelado' }, AGORA)).toBe('decidido');
    expect(processoEncerradoNaLista({ ...vivo, status: 'Homologada' }, AGORA)).toBe('decidido');
    expect(processoEncerradoNaLista({ ...vivo, resultado: 'Deserto' }, AGORA)).toBe('decidido');
  });

  it('arquivado vence o resto', () => {
    expect(processoEncerradoNaLista({ ...vivo, status: 'Perdida', arquivado_em: '2026-09-01T00:00:00Z' }, AGORA)).toBe('arquivado');
  });

  it('prazo de propostas em dia anterior esconde; hoje ainda aparece', () => {
    expect(processoEncerradoNaLista({ ...vivo, data_encerramento: '2026-07-30T12:30:00Z' }, AGORA)).toBe('prazo');
    expect(processoEncerradoNaLista({ ...vivo, data_encerramento: '2026-09-17T12:00:00Z' }, AGORA)).toBeNull();
  });
});
