import { describe, it, expect } from 'vitest';
import { filtroDaBusca, inicioDoPeriodo, quandoEmBrasilia, seloDaLinha, tituloDaLinha } from './historico-do-robo';

/** Histórico do robô no admin (17/09/2026): sininho com 24 horas, histórico com 12 meses. */
const AGORA = new Date('2026-09-17T16:53:47Z'); // 13:53:47 em Brasília

describe('historico-do-robo', () => {
  it('períodos: 24 horas, 7 dias, 30 dias e 12 meses para trás', () => {
    expect(inicioDoPeriodo('24h', AGORA)).toBe('2026-09-16T16:53:47.000Z');
    expect(inicioDoPeriodo('7d', AGORA)).toBe('2026-09-10T16:53:47.000Z');
    expect(inicioDoPeriodo('30d', AGORA)).toBe('2026-08-18T16:53:47.000Z');
    expect(inicioDoPeriodo('12m', AGORA)).toBe('2025-09-17T16:53:47.000Z');
  });

  it('busca: procura em edital, título e mensagem; tira o que quebra o filtro', () => {
    expect(filtroDaBusca('90029/2026')).toBe('edital.ilike.%90029/2026%,titulo.ilike.%90029/2026%,mensagem.ilike.%90029/2026%');
    expect(filtroDaBusca('lance, (recusado)*')).toBe('edital.ilike.%lance recusado%,titulo.ilike.%lance recusado%,mensagem.ilike.%lance recusado%');
    expect(filtroDaBusca('  ,() ')).toBeNull();
  });

  it('título: aviso como chegou; evento em palavras', () => {
    expect(tituloDaLinha({ origem: 'aviso', tipo: 'urgente', titulo: '⚠️ A licitação mudou — 90029/2026' })).toBe('⚠️ A licitação mudou — 90029/2026');
    expect(tituloDaLinha({ origem: 'evento', tipo: 'lance-enviado', titulo: 'Lance Enviado' })).toBe('Lance enviado');
    expect(tituloDaLinha({ origem: 'evento', tipo: 'desconhecido', titulo: 'Desconhecido' })).toBe('Desconhecido');
  });

  it('selo: urgente e recusa em destaque', () => {
    expect(seloDaLinha({ origem: 'aviso', tipo: 'urgente' })).toEqual({ rotulo: 'Aviso urgente', tom: 'critico' });
    expect(seloDaLinha({ origem: 'aviso', tipo: 'info' })).toEqual({ rotulo: 'Aviso', tom: 'neutro' });
    expect(seloDaLinha({ origem: 'evento', tipo: 'lance-recusado' }).tom).toBe('critico');
    expect(seloDaLinha({ origem: 'evento', tipo: 'lance-enviado' })).toEqual({ rotulo: 'Lance', tom: 'ativo' });
  });

  it('data e hora em Brasília, com segundos', () => {
    expect(quandoEmBrasilia('2026-09-17T16:53:47Z')).toBe('17/09/2026 13:53:47');
  });
});
