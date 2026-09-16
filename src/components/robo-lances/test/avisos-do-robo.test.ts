import { describe, it, expect } from 'vitest';
import {
  acaoDoAviso,
  avisosParaMostrar,
  ehAvisoDoRobo,
  gravidadeDoAviso,
  quandoDoAviso,
  sininhoDeveChamar,
  type NotificacaoDoRobo,
} from '@/lib/robo/avisos-do-robo';

/**
 * Os avisos do robô como caixinha no canto da tela, além do sininho (Fase 8).
 */

const AGORA = new Date('2026-09-16T18:45:00Z'); // 15:45 em Brasília

const n = (id: string, extra: Partial<NotificacaoDoRobo> = {}): NotificacaoDoRobo => ({
  id,
  titulo: '⏰ Pregão em 1 hora — 07/2026',
  mensagem: 'Hoje às 16:32 é a sessão do pregão 07/2026.',
  tipo: 'lembrete',
  link: '/robo-lances/disputa/9ed940f2',
  lida: false,
  created_at: '2026-09-16T18:43:00Z',
  ...extra,
});

describe('avisosParaMostrar', () => {
  it('só do robô, não lidos, não dispensados e das últimas 24 horas — o mais novo primeiro', () => {
    const lista = [
      n('lembrete'),
      n('mais-novo', { created_at: '2026-09-16T18:44:00Z', tipo: 'urgente' }),
      n('documento', { link: '/documentos' }),
      n('lido', { lida: true }),
      n('dispensado'),
      n('antigo', { created_at: '2026-09-15T18:00:00Z' }),
      n('tela-remota', { link: '/admin/robo-lances', created_at: '2026-09-16T18:30:00Z' }),
    ];
    expect(avisosParaMostrar(lista, new Set(['dispensado']), AGORA).map((x) => x.id)).toEqual(['mais-novo', 'lembrete', 'tela-remota']);
  });
});

describe('ehAvisoDoRobo, gravidade e ação', () => {
  it('reconhece as telas do robô', () => {
    expect(ehAvisoDoRobo({ link: '/robo-lances/disputa/x' })).toBe(true);
    expect(ehAvisoDoRobo({ link: '/admin/robo-lances' })).toBe(true);
    expect(ehAvisoDoRobo({ link: '/kanban' })).toBe(false);
    expect(ehAvisoDoRobo({ link: null })).toBe(false);
  });

  it('gravidade pelo tipo da notificação', () => {
    expect(gravidadeDoAviso('urgente')).toBe('urgente');
    expect(gravidadeDoAviso('alerta')).toBe('urgente');
    expect(gravidadeDoAviso('lembrete')).toBe('atencao');
    expect(gravidadeDoAviso('info')).toBe('informativo');
    expect(gravidadeDoAviso(null)).toBe('informativo');
  });

  it('o botão diz para onde leva', () => {
    expect(acaoDoAviso('/robo-lances/disputa/x')).toBe('Abrir a disputa');
    expect(acaoDoAviso('/admin/robo-lances')).toBe('Abrir a tela remota do robô');
    expect(acaoDoAviso('/robo-lances')).toBe('Ver no Robô de Lances');
  });
});

describe('quandoDoAviso', () => {
  it('recente em minutos; do dia com a hora de Brasília; de outro dia com a data', () => {
    expect(quandoDoAviso('2026-09-16T18:44:40Z', AGORA)).toBe('agora');
    expect(quandoDoAviso('2026-09-16T18:40:00Z', AGORA)).toBe('há 5 min');
    expect(quandoDoAviso('2026-09-16T16:55:00Z', AGORA)).toBe('às 13:55');
    expect(quandoDoAviso('2026-09-15T20:10:00Z', AGORA)).toBe('15/09 às 17:10');
    expect(quandoDoAviso('lixo', AGORA)).toBe('');
  });
});

describe('sininhoDeveChamar', () => {
  it('chama com aviso do robô não lido que chegou depois da última abertura do painel', () => {
    expect(sininhoDeveChamar([n('a')], '2026-09-16T18:40:00Z')).toBe(true);
    expect(sininhoDeveChamar([n('a')], null)).toBe(true);
  });

  it('abrir o painel depois do aviso faz parar, mesmo sem marcar como lida', () => {
    expect(sininhoDeveChamar([n('a')], '2026-09-16T18:44:00Z')).toBe(false);
  });

  it('notificação lida ou que não é do robô não faz o sininho chamar', () => {
    expect(sininhoDeveChamar([n('a', { lida: true }), n('b', { link: '/documentos' })], null)).toBe(false);
  });
});
