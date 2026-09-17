import { describe, it, expect } from 'vitest';
import {
  avisoDaNotificacaoDoPortal,
  disputaDaNotificacao,
  gravidadeDaNotificacaoDoPortal,
  notificacoesParaAvisar,
  type NotificacaoDoPortal,
} from '../../../../supabase/functions/_shared/robo-notificacoes-portal';

/**
 * Notificações da central do fornecedor no Compras.gov viram aviso do
 * Praefectus (17/09/2026): convocação e prazo são urgentes; o mesmo aviso não
 * sai duas vezes; o acumulado antigo da primeira leitura não vira enxurrada.
 */

const AGORA = new Date('2026-09-17T13:30:00Z'); // 10:30 em Brasília

const n = (id: string, extra: Partial<NotificacaoDoPortal> = {}): NotificacaoDoPortal => ({
  id,
  lida: false,
  texto: 'Convocação para envio de anexo do item 1 até 18/09/2026 às 14:00',
  publicada_em: '2026-09-17T10:15:00',
  uasg: '925448',
  numero_compra: '90025/2026',
  id_compra: '92544805900252026',
  item: 1,
  ...extra,
});

describe('gravidade', () => {
  it('convocação, anexo, prazo, habilitação e recurso são urgentes; o resto é informativo', () => {
    expect(gravidadeDaNotificacaoDoPortal('Convocação para envio de anexo')).toBe('urgente');
    expect(gravidadeDaNotificacaoDoPortal('Prazo para proposta ajustada termina hoje')).toBe('urgente');
    expect(gravidadeDaNotificacaoDoPortal('Aberto prazo para intenção de recurso')).toBe('urgente');
    expect(gravidadeDaNotificacaoDoPortal('Fase de habilitação iniciada')).toBe('urgente');
    expect(gravidadeDaNotificacaoDoPortal('Nova compra publicada na sua linha de fornecimento')).toBe('info');
    expect(gravidadeDaNotificacaoDoPortal(null)).toBe('info');
  });
});

describe('notificacoesParaAvisar', () => {
  it('só leitura ok, não lida, não avisada, com data, das últimas 48 horas', () => {
    const perfis = [
      {
        perfil: 'comprasgov-aaaa',
        ok: true,
        itens: [
          n('1'),
          n('2', { lida: true }),
          n('3', { publicada_em: '2026-09-10T09:00:00' }), // uma semana: acumulado antigo
          n('4', { publicada_em: null }),
          n('5', { texto: 'Nova compra publicada', publicada_em: '2026-09-16T18:00:00' }),
          n('6'),
        ],
      },
      { perfil: 'comprasgov-bbbb', ok: false, etapa: 'token', itens: [n('9')] },
    ];
    const r = notificacoesParaAvisar(perfis, new Set(['comprasgov-aaaa:6']), AGORA);
    expect(r.map((x) => [x.chave, x.gravidade])).toEqual([
      ['comprasgov-aaaa:1', 'urgente'],
      ['comprasgov-aaaa:5', 'info'],
    ]);
  });

  it('data sem fuso é lida em Brasília', () => {
    // A janela começa em 15/09 às 13:30 UTC (10:30 em Brasília). "10:31" só cai
    // dentro se for lido em Brasília (13:31 UTC); lido como UTC, ficaria fora.
    const r = notificacoesParaAvisar([{ perfil: 'p', ok: true, itens: [n('1', { publicada_em: '2026-09-15T10:31:00' })] }], new Set(), AGORA);
    expect(r).toHaveLength(1);
    const fora = notificacoesParaAvisar([{ perfil: 'p', ok: true, itens: [n('1', { publicada_em: '2026-09-15T10:29:00' })] }], new Set(), AGORA);
    expect(fora).toHaveLength(0);
  });

  it('sem leitura, nada', () => {
    expect(notificacoesParaAvisar(null, new Set(), AGORA)).toEqual([]);
  });
});

describe('aviso e disputa', () => {
  it('urgente: compra, UASG e item no título; o texto do portal e o lembrete do prazo na mensagem', () => {
    expect(avisoDaNotificacaoDoPortal(n('1'), 'urgente')).toEqual({
      tipo: 'urgente',
      titulo: '📣 Compras.gov — compra 90025/2026 (UASG 925448) · item 1',
      mensagem: 'Convocação para envio de anexo do item 1 até 18/09/2026 às 14:00 — confira o prazo no Compras.gov.',
    });
    expect(avisoDaNotificacaoDoPortal(n('2', { numero_compra: null, uasg: null, item: null, texto: 'Aviso do sistema' }), 'info')).toEqual({
      tipo: 'info',
      titulo: '🔔 Compras.gov — notificação do portal',
      mensagem: 'Aviso do sistema',
    });
  });

  it('acha a disputa pela UASG e pelo número/ano, só quando é uma', () => {
    const disputas = [
      { id: 'd1', uasg: '925448', edital: 'PE 90025/2026' },
      { id: 'd2', uasg: '925315', edital: '90025/2026' },
      { id: 'd3', uasg: '925448', edital: '7/2026' },
    ];
    expect(disputaDaNotificacao(n('1'), disputas)?.id).toBe('d1');
    expect(disputaDaNotificacao(n('1'), [...disputas, { id: 'd4', uasg: '925448', edital: '90025/2026' }])).toBeNull();
    expect(disputaDaNotificacao(n('1', { uasg: null }), disputas)).toBeNull();
  });
});
