import { describe, expect, it } from 'vitest';
import { disputasAoVivo, resumirDisputa, type DisputaParaResumir } from '@/lib/robo/disputas-ao-vivo';

/**
 * Com quatro pregões no ar, a pergunta deixa de ser "como mostrar uma disputa" e
 * passa a ser "como mostrar quatro sem a pessoa perder a que importa".
 *
 * O que estes testes guardam: a ordem é a de quem disputa, e a disputa que
 * PAROU esperando uma pessoa vem antes de qualquer cronômetro — porque aí o
 * robô não está trabalhando, e só um clique o destrava.
 */
const LIDO = '2026-10-02T09:00:00.000Z';
const AGORA = new Date(LIDO);

const item = (over: Record<string, unknown> = {}) => ({
  item: 1, fase: 'aberta', sou_lider: true, segundos_restantes: 600, ...over,
});

const disputa = (over: Partial<DisputaParaResumir> = {}): DisputaParaResumir => ({
  id: 'd1',
  edital: '37/2026',
  orgao: 'H. Clínicas Gaspar Vianna',
  status: 'ativo',
  estadoSalaEm: LIDO,
  estadoSala: { por_item: { '1': item() } },
  ...over,
});

describe('resumirDisputa', () => {
  it('conta itens abertos, perdendo e encerrados', () => {
    const r = resumirDisputa(disputa({
      estadoSala: {
        por_item: {
          '1': item({ item: 1, sou_lider: true }),
          '2': item({ item: 2, sou_lider: false }),
          '3': item({ item: 3, fase: 'encerrada', sou_lider: false }),
        },
      },
    }), AGORA);
    expect(r.emDisputa).toBe(2);
    expect(r.perdendo).toBe(1);
    expect(r.encerrados).toBe(1);
    expect(r.totalDeItens).toBe(3);
  });

  it('o menor cronômetro é o que aperta primeiro', () => {
    const r = resumirDisputa(disputa({
      estadoSala: {
        por_item: {
          '1': item({ item: 1, segundos_restantes: 600 }),
          '2': item({ item: 2, segundos_restantes: 45 }),
        },
      },
    }), AGORA);
    expect(r.menorTempo?.segundos).toBe(45);
  });

  it('item ENCERRADO não entra no menor cronômetro', () => {
    const r = resumirDisputa(disputa({
      estadoSala: {
        por_item: {
          '1': item({ item: 1, segundos_restantes: 600 }),
          '2': item({ item: 2, fase: 'encerrada', segundos_restantes: 5 }),
        },
      },
    }), AGORA);
    expect(r.menorTempo?.segundos).toBe(600);
  });

  it('tempo de leitura VELHA não vira pressa', () => {
    const r = resumirDisputa(disputa({ estadoSalaEm: '2026-10-02T08:50:00.000Z' }), AGORA);
    expect(r.menorTempo).toBeNull();
  });

  it('a urgência da disputa é a do item MAIS urgente, não a média', () => {
    const tranquila = resumirDisputa(disputa({
      estadoSala: { por_item: { '1': item({ sou_lider: true, segundos_restantes: 600 }) } },
    }), AGORA);
    // 181 itens tranquilos e UM perdendo com 20s: a disputa é urgente.
    const porItem: Record<string, unknown> = {};
    for (let i = 1; i <= 181; i++) porItem[String(i)] = item({ item: i, sou_lider: true, segundos_restantes: 600 });
    porItem['182'] = item({ item: 182, sou_lider: false, segundos_restantes: 20 });
    const comUmApertado = resumirDisputa(disputa({ estadoSala: { por_item: porItem } }), AGORA);
    expect(comUmApertado.urgencia).toBeGreaterThan(tranquila.urgencia);
  });

  it('esperar uma pessoa supera qualquer cronômetro', () => {
    const esperando = resumirDisputa(disputa({ esperandoPessoa: true, estadoSala: null }), AGORA);
    const apertada = resumirDisputa(disputa({
      estadoSala: { por_item: { '1': item({ sou_lider: false, segundos_restantes: 5 }) } },
    }), AGORA);
    expect(esperando.urgencia).toBeGreaterThan(apertada.urgencia);
    expect(esperando.porque).toContain('esperando uma pessoa');
  });

  it('pausada não acumula urgência de itens', () => {
    const r = resumirDisputa(disputa({
      status: 'pausado',
      estadoSala: { por_item: { '1': item({ sou_lider: false, segundos_restantes: 10 }) } },
    }), AGORA);
    expect(r.pausada).toBe(true);
    expect(r.urgencia).toBe(0);
    expect(r.porque).toContain('pausado');
  });

  it('sessão encerrada é dita como tal', () => {
    const r = resumirDisputa(disputa({ status: 'encerrado' }), AGORA);
    expect(r.viva).toBe(false);
    expect(r.porque).toBe('Sessão encerrada');
  });

  it('sem leitura da sala não quebra', () => {
    const r = resumirDisputa(disputa({ estadoSala: null }), AGORA);
    expect(r.totalDeItens).toBe(0);
    expect(r.porque).toContain('Nenhum item');
  });

  it('a frase explica a posição — perdendo e o mais apertado', () => {
    const r = resumirDisputa(disputa({
      estadoSala: {
        por_item: {
          '1': item({ item: 1, sou_lider: false, segundos_restantes: 95 }),
          '2': item({ item: 2, sou_lider: false, segundos_restantes: 600 }),
        },
      },
    }), AGORA);
    expect(r.porque).toBe('perdendo em 2 itens · o mais apertado fecha em 01:35');
  });

  it('liderando também é dito', () => {
    const r = resumirDisputa(disputa(), AGORA);
    expect(r.porque).toContain('liderando');
  });
});

describe('disputasAoVivo', () => {
  it('ordena: quem espera pessoa, depois perdendo e apertado, depois o resto', () => {
    const r = disputasAoVivo([
      disputa({ id: 'tranquila', edital: 'A', estadoSala: { por_item: { '1': item({ sou_lider: true, segundos_restantes: 600 }) } } }),
      disputa({ id: 'encerrada', edital: 'B', status: 'encerrado' }),
      disputa({ id: 'apertada', edital: 'C', estadoSala: { por_item: { '1': item({ sou_lider: false, segundos_restantes: 20 }) } } }),
      disputa({ id: 'esperando', edital: 'D', esperandoPessoa: true }),
    ], AGORA);
    expect(r.map((x) => x.id)).toEqual(['esperando', 'apertada', 'tranquila', 'encerrada']);
  });

  it('empate de urgência é desfeito pelo menor cronômetro', () => {
    const r = disputasAoVivo([
      disputa({ id: 'folgada', edital: 'A', estadoSala: { por_item: { '1': item({ sou_lider: false, segundos_restantes: 25 }) } } }),
      disputa({ id: 'urgente', edital: 'B', estadoSala: { por_item: { '1': item({ sou_lider: false, segundos_restantes: 8 }) } } }),
    ], AGORA);
    expect(r[0].id).toBe('urgente');
  });

  it('quatro disputas ao mesmo tempo — o limite do agente', () => {
    const r = disputasAoVivo([1, 2, 3, 4].map((i) => disputa({ id: `d${i}`, edital: `${i}/2026` })), AGORA);
    expect(r).toHaveLength(4);
  });

  it('lista vazia não quebra', () => {
    expect(disputasAoVivo([], AGORA)).toEqual([]);
  });
});
