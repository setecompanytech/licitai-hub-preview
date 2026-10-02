import { describe, expect, it } from 'vitest';
import {
  avisosDaCentral,
  rotuloDaCompra,
  urgenciaDaNotificacao,
  type NotificacaoDoPortal,
} from '../../../../supabase/functions/_shared/notificacoes-do-portal';

/**
 * Os textos abaixo são REAIS, lidos da central e do chat do Compras.gov em
 * 01/10/2026 — incluindo a reabertura do 90029/2026, que é a próxima disputa e
 * apareceu SÓ ali.
 */
const n = (over: Partial<NotificacaoDoPortal> = {}): NotificacaoDoPortal => ({
  id: '1', lida: false, texto: 'texto qualquer', publicada_em: '2026-10-01T13:43:00Z',
  numero_compra: '9/2026', uasg: '980425', modalidade: 'Pregão', item: null, ...over,
});

const CONVOCACAO = 'Sr Fornecedor MAOV COMERCIO LTDA, CNPJ 62.983.096/0001-02, você foi convocado '
  + 'para enviar anexos para o item 4. Prazo para encerrar o envio: 11:28:00 do dia 01/10/2026.';
const REABERTURA = 'Srs. documentos enviados para área técnica, reabertura para o dia 08/10 às 9h.';
const REGISTRO = 'O item 76 está na etapa de julgamento de proposta no período de intenção de recursos.';

describe('urgenciaDaNotificacao', () => {
  it('convocação com prazo é URGENTE', () => {
    expect(urgenciaDaNotificacao(n({ texto: CONVOCACAO }))).toBe('urgente');
  });

  it('reabertura é IMPORTANTE — muda o calendário, sem prazo correndo', () => {
    expect(urgenciaDaNotificacao(n({ texto: REABERTURA }))).toBe('importante');
  });

  it('registro de andamento NÃO vira aviso', () => {
    expect(urgenciaDaNotificacao(n({ texto: REGISTRO }))).toBeNull();
  });

  it('já lida no portal não vira aviso — alguém viu', () => {
    expect(urgenciaDaNotificacao(n({ texto: CONVOCACAO, lida: true }))).toBeNull();
  });

  it('sem texto não vira aviso', () => {
    expect(urgenciaDaNotificacao(n({ texto: '' }))).toBeNull();
    expect(urgenciaDaNotificacao(n({ texto: null }))).toBeNull();
  });

  it('suspensão e cancelamento mudam o calendário', () => {
    expect(urgenciaDaNotificacao(n({ texto: 'Compra SUSPENSA por decisão do pregoeiro.' }))).toBe('importante');
    expect(urgenciaDaNotificacao(n({ texto: 'Licitação cancelada.' }))).toBe('importante');
  });

  it('recurso e diligência pedem ação', () => {
    expect(urgenciaDaNotificacao(n({ texto: 'Aberto prazo para recurso.' }))).toBe('urgente');
    expect(urgenciaDaNotificacao(n({ texto: 'Diligência solicitada ao fornecedor.' }))).toBe('urgente');
  });
});

describe('rotuloDaCompra', () => {
  it('monta como a pessoa chama a compra', () => {
    expect(rotuloDaCompra(n())).toBe('Pregão 9/2026 (UASG 980425)');
  });

  it('sem modalidade, não inventa', () => {
    expect(rotuloDaCompra(n({ modalidade: null }))).toBe('Compra 9/2026 (UASG 980425)');
  });

  it('sem número nem UASG, devolve null', () => {
    expect(rotuloDaCompra(n({ numero_compra: null, uasg: null }))).toBeNull();
  });
});

describe('avisosDaCentral', () => {
  it('filtra: só o que merece sininho', () => {
    const r = avisosDaCentral([
      n({ id: '1', texto: CONVOCACAO }),
      n({ id: '2', texto: REGISTRO }),
      n({ id: '3', texto: REABERTURA }),
    ]);
    expect(r.map((a) => a.chave)).toEqual(['portal:1', 'portal:3']);
  });

  it('URGENTE vem antes de importante', () => {
    const r = avisosDaCentral([
      n({ id: '1', texto: REABERTURA }),
      n({ id: '2', texto: CONVOCACAO }),
    ]);
    expect(r[0].urgencia).toBe('urgente');
  });

  it('dentro do mesmo peso, a mais recente na frente', () => {
    const r = avisosDaCentral([
      n({ id: 'velha', texto: CONVOCACAO, publicada_em: '2026-10-01T08:00:00Z' }),
      n({ id: 'nova', texto: CONVOCACAO, publicada_em: '2026-10-01T13:00:00Z' }),
    ]);
    expect(r[0].chave).toBe('portal:nova');
  });

  it('a central repete o mesmo cartão — o id deduplica', () => {
    const r = avisosDaCentral([n({ id: '7', texto: CONVOCACAO }), n({ id: '7', texto: CONVOCACAO })]);
    expect(r).toHaveLength(1);
  });

  it('notificação sem id é descartada — não dá para deduplicar', () => {
    expect(avisosDaCentral([n({ id: null, texto: CONVOCACAO })])).toEqual([]);
  });

  it('o número do item entra na mensagem', () => {
    const [a] = avisosDaCentral([n({ id: '1', texto: CONVOCACAO, item: 4 })]);
    expect(a.mensagem).toMatch(/^Item 4: /);
    expect(a.item).toBe(4);
  });

  it('o texto do portal vai INTEIRO — é ele que traz o prazo', () => {
    const [a] = avisosDaCentral([n({ id: '1', texto: CONVOCACAO })]);
    expect(a.mensagem).toContain('Prazo para encerrar o envio: 11:28:00 do dia 01/10/2026');
  });

  it('o título diz a compra', () => {
    const [a] = avisosDaCentral([n({ id: '1', texto: CONVOCACAO })]);
    expect(a.titulo).toContain('Pregão 9/2026 (UASG 980425)');
  });

  it('a reabertura do 90029/2026 passaria — foi assim que soubemos de 08/10', () => {
    const r = avisosDaCentral([
      n({ id: 'x', texto: REABERTURA, numero_compra: '90029/2026', uasg: '925448' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].mensagem).toContain('08/10');
    expect(r[0].titulo).toContain('90029/2026');
  });

  it('lista vazia não quebra', () => {
    expect(avisosDaCentral([])).toEqual([]);
  });
});

/**
 * O caso que custou uma correção: a central NARRA na terceira pessoa e CHAMA na
 * segunda. O que narra não pode acordar ninguém — e o texto que narra é o mais
 * comum de todos.
 */
describe('narrar não é chamar', () => {
  const narrativas = [
    'O item 76 está na etapa de julgamento de proposta no período de intenção de recursos, com acréscimo de 10 minutos.',
    'O item 71 está na etapa de habilitação de fornecedores no período de intenção de recursos.',
    'O item 4 teve a solicitação de negociação de valor CANCELADA para o fornecedor RNL TRADE LTDA.',
    'A proposta está em análise pela equipe técnica.',
  ];

  it.each(narrativas)('registro não vira aviso: %s', (texto) => {
    expect(urgenciaDaNotificacao(n({ texto }))).toBeNull();
  });

  const chamados = [
    'Sr Fornecedor, você foi convocado para enviar anexos para o item 4. Prazo para encerrar o envio: 11:28:00.',
    'Fica aberto o prazo para recurso até 15:00 de hoje.',
    'Apresente a proposta readequada em até 2 horas.',
  ];

  it.each(chamados)('chamado vira aviso urgente: %s', (texto) => {
    expect(urgenciaDaNotificacao(n({ texto }))).toBe('urgente');
  });

  it('o texto que narra E convoca é CONVOCAÇÃO', () => {
    const misto = 'O item 4 está na etapa de aceitação. Você foi convocado para enviar anexos, prazo até 11:28.';
    // Os dois erros não são simétricos: perder uma convocação custa
    // desclassificação; um aviso a mais custa um toque no sininho. A regra
    // segue o lado barato.
    expect(urgenciaDaNotificacao(n({ texto: misto }))).toBe('urgente');
  });

  it('mas o registro puro continua sem acordar ninguém', () => {
    expect(urgenciaDaNotificacao(n({
      texto: 'O item 76 está na etapa de julgamento no período de intenção de recursos.',
    }))).toBeNull();
  });
});
