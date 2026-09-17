import { describe, it, expect } from 'vitest';
import {
  anteriorDoItem,
  avisoDoPrimeiroLance,
  eventosDoEstado,
  mesclarEstadoDoItem,
  motivoParaPessoas,
  situacaoDoItem,
  type EstadoDaSala,
} from '../../../../supabase/functions/_shared/robo-estado-da-sala';

/**
 * O estado da sala lido para pessoas (D13, 16/09/2026): o motivo em linguagem
 * de cliente e o que entra na linha do tempo da disputa.
 */

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// O retrato da BAQPLAST no item 1 do 7/2026 às 11:04, com a trava fechada.
const BAQPLAST: EstadoDaSala = {
  item: 1,
  melhor_lance: 3100,
  nosso_lance: 4999.7,
  posicao: 8,
  sou_lider: false,
  tem_proposta: true,
  propostas_validas: 13,
  desclassificadas: 0,
  nossa_desclassificada: false,
  modo: 'Aberto',
  intervalo_minimo: 0.01,
  fase: null,
  estrategia: 'melhor_preco',
  decisao: {
    acao: 'aguardar',
    valor: null,
    motivo: 'Portal "comprasgov" nao esta liberado para enviar lance — o souLider() dele ainda nao foi conferido contra a tela real',
  },
  rodada: 1,
};

describe('motivoParaPessoas', () => {
  it('a trava vira frase de cliente, sem nome de função', () => {
    const t = motivoParaPessoas(BAQPLAST)!;
    expect(t).toBe('Só acompanhando: o envio de lances ainda não foi liberado para este portal');
    expect(t).not.toMatch(/souLider|comprasgov/);
  });

  it('"não informou quem lidera" depende de ter proposta', () => {
    const base = { ...BAQPLAST, decisao: { acao: 'aguardar', motivo: 'O portal não informou quem está liderando' } };
    expect(motivoParaPessoas({ ...base, tem_proposta: false })).toMatch(/não tem proposta/);
    expect(motivoParaPessoas({ ...base, nossa_desclassificada: true })).toMatch(/desclassificada/);
    expect(motivoParaPessoas(base)).toMatch(/Não foi possível confirmar a posição/);
  });

  it('iminência diz quanto falta', () => {
    const e = { ...BAQPLAST, decisao: { acao: 'aguardar', motivo: 'Estrategia de iminencia: faltam 300 s; o robo age nos 2 minutos finais' } };
    expect(motivoParaPessoas(e)).toBe('Iminência: faltam 300 s — o robô age nos 2 minutos finais');
  });

  it('lance e motivo desconhecido', () => {
    expect(motivoParaPessoas({ ...BAQPLAST, decisao: { acao: 'lance', valor: 3099.99, motivo: 'Cobrindo' } })).toBe('Enviando lance');
    expect(motivoParaPessoas({ ...BAQPLAST, decisao: { acao: 'aguardar', motivo: 'algo novo' } })).toBe('algo novo');
  });
});

describe('eventosDoEstado', () => {
  it('primeiro retrato: onde a empresa está e por que o robô aguarda', () => {
    const ev = eventosDoEstado(null, BAQPLAST, brl);
    expect(ev.map((e) => e.tipo)).toEqual(['acompanhando', 'aguardando']);
    expect(ev[0].mensagem).toBe('Robô acompanhando o item 1 — empresa em 8º lugar (R$ 4.999,70) · melhor R$ 3.100,00 · modo Aberto');
    expect(ev[0].item).toBe(1);
  });

  it('o mesmo estado repetido não vira evento', () => {
    expect(eventosDoEstado(BAQPLAST, { ...BAQPLAST, rodada: 9, segundos_restantes: 40 }, brl)).toEqual([]);
  });

  it('mudança de posição vira evento; melhor lance oscilando sem mexer na posição, não', () => {
    expect(eventosDoEstado(BAQPLAST, { ...BAQPLAST, posicao: 5 }, brl).map((e) => e.mensagem)).toEqual([
      'A empresa passou do 8º para o 5º lugar · melhor R$ 3.100,00',
    ]);
    expect(eventosDoEstado(BAQPLAST, { ...BAQPLAST, melhor_lance: 3050 }, brl)).toEqual([]);
  });

  it('assumir e perder o 1º lugar', () => {
    const lider = { ...BAQPLAST, posicao: 1, sou_lider: true, nosso_lance: 3000 };
    expect(eventosDoEstado(BAQPLAST, lider, brl).map((e) => e.tipo)).toEqual(['lideranca-assumida']);
    const perdeu = { ...lider, posicao: 2, sou_lider: false, melhor_lance: 2990 };
    expect(eventosDoEstado(lider, perdeu, brl).map((e) => e.mensagem)).toEqual([
      'A empresa perdeu o 1º lugar — melhor lance agora R$ 2.990,00',
    ]);
  });

  it('desclassificação, mudança de fase e motivo novo', () => {
    const ev = eventosDoEstado(
      BAQPLAST,
      { ...BAQPLAST, nossa_desclassificada: true, fase: 'aberta', decisao: { acao: 'aguardar', motivo: 'O portal não informou quem está liderando' } },
      brl,
    );
    expect(ev.map((e) => e.tipo)).toEqual(['desclassificada', 'fase', 'aguardando']);
    expect(ev[1].mensagem).toBe('Fase da disputa: etapa aberta');
  });
});

describe('situacaoDoItem', () => {
  it('a coluna Situação pela fase lida', () => {
    expect(situacaoDoItem(null)).toBe('aguardando');
    expect(situacaoDoItem('aberta')).toBe('disputando');
    expect(situacaoDoItem('desempate_me_epp')).toBe('disputando');
    expect(situacaoDoItem('encerrada')).toBe('encerrado');
  });
});

describe('vários itens na mesma sessão (Fase 7)', () => {
  const item2: EstadoDaSala = { ...BAQPLAST, item: 2, posicao: 3, nosso_lance: 4247.7, melhor_lance: 4100 };

  it('grava o último de cada item e compara cada um com o seu', () => {
    const depoisDo1 = mesclarEstadoDoItem(null, BAQPLAST);
    const depoisDo2 = mesclarEstadoDoItem(depoisDo1, item2);
    expect(Object.keys(depoisDo2.por_item!)).toEqual(['1', '2']);
    expect(depoisDo2.item).toBe(2); // o formato de antes continua com o último recebido
    expect(anteriorDoItem(depoisDo2, 1)?.posicao).toBe(8);
    expect(anteriorDoItem(depoisDo2, 2)?.posicao).toBe(3);
    expect(anteriorDoItem(depoisDo1, 2)).toBeNull();
  });

  it('a troca de item não vira mudança de posição na linha do tempo', () => {
    const gravado = mesclarEstadoDoItem(mesclarEstadoDoItem(null, BAQPLAST), item2);
    // chega de novo o item 1, igual: nada a registrar
    expect(eventosDoEstado(anteriorDoItem(gravado, 1), BAQPLAST, brl)).toEqual([]);
    // primeira vez do item 3: retrato inicial dele
    expect(eventosDoEstado(anteriorDoItem(gravado, 3), { ...BAQPLAST, item: 3 }, brl).map((e) => e.tipo)).toEqual(['acompanhando', 'aguardando']);
  });

  it('o formato antigo (um item, sem por_item) é lido como o estado daquele item', () => {
    expect(anteriorDoItem(BAQPLAST, 1)?.posicao).toBe(8);
    expect(anteriorDoItem(BAQPLAST, 2)).toBeNull();
    expect(Object.keys(mesclarEstadoDoItem(BAQPLAST, item2).por_item!)).toEqual(['1', '2']);
  });
});

describe('motivos do lance ligado (16/09/2026)', () => {
  it('modo automático desligado e campo de lance fora da tela viram frase de gente', () => {
    expect(motivoParaPessoas({ decisao: { acao: 'aguardar', motivo: 'Modo automatico desligado nesta disputa: o robo acompanha e nao da lance' } } as never))
      .toBe('Modo automático desligado nesta disputa: o robô acompanha e não dá lance');
    expect(motivoParaPessoas({ decisao: { acao: 'aguardar', valor: 85, motivo: 'Lance de R$ 85.00 decidido, mas o campo de lance deste item nao esta na tela' } } as never))
      .toBe('Lance decidido, mas o campo de lance deste item não está na tela do robô — acompanhando');
  });
});

describe('avisoDoPrimeiroLance', () => {
  const formatar = (n: number) => n.toFixed(2).replace('.', ',');

  it('o primeiro lance aceito do item avisa, com valor e item', () => {
    expect(avisoDoPrimeiroLance({ edital: '07/2026', item: 3, valor: 85, lancesAnterioresDoItem: 0, formatar })).toEqual({
      titulo: '💰 Primeiro lance do robô — 07/2026',
      mensagem: 'O portal aceitou o lance de R$ 85,00 no item 3. Os próximos lances deste item ficam na linha do tempo da disputa.',
    });
  });

  it('os lances seguintes do mesmo item não avisam', () => {
    expect(avisoDoPrimeiroLance({ edital: '07/2026', item: 3, valor: 84.99, lancesAnterioresDoItem: 1, formatar })).toBeNull();
  });

  it('sem número de item, o aviso não inventa um', () => {
    expect(avisoDoPrimeiroLance({ edital: '07/2026', item: null, valor: 85, lancesAnterioresDoItem: 0, formatar })?.mensagem)
      .toBe('O portal aceitou o lance de R$ 85,00. Os próximos lances deste item ficam na linha do tempo da disputa.');
  });
});
