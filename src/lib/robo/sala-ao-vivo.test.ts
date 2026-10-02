import { describe, expect, it } from 'vitest';
import {
  formatarRelogio,
  SEGUNDOS_MAXIMOS_DE_ESTIMATIVA,
  tempoRestanteAgora,
  urgenciaDoItem,
  type EstadoNoQuadro,
} from '@/lib/robo/quadro-da-sala';

/**
 * O cronômetro ao vivo (02/10/2026).
 *
 * O que estes testes protegem: **a tela não pode mentir devagar.** O número que
 * chega do robô é de alguns segundos atrás; exibi-lo parado faz "01:56" parecer
 * tempo que se tem. E estimar sobre uma leitura velha é pior ainda — numa
 * disputa, faria a pessoa achar que tem meio minuto quando o item já fechou.
 */
const LIDO = '2026-10-02T12:00:00.000Z';
const emSegundos = (s: number) => new Date(new Date(LIDO).getTime() + s * 1000);

describe('tempoRestanteAgora', () => {
  it('desconta o tempo desde a leitura', () => {
    const t = tempoRestanteAgora(99, LIDO, emSegundos(10));
    expect(t.segundos).toBe(89);
    expect(t.texto).toBe('01:29');
    expect(t.confiavel).toBe(true);
    expect(t.idadeDaLeitura).toBe(10);
  });

  it('no instante da leitura, mostra o que foi lido', () => {
    expect(tempoRestanteAgora(99, LIDO, emSegundos(0)).texto).toBe('01:39');
  });

  it('não desce abaixo de zero', () => {
    const t = tempoRestanteAgora(10, LIDO, emSegundos(60));
    expect(t.segundos).toBe(0);
    expect(t.zerou).toBe(true);
  });

  it('leitura VELHA para de descontar e se declara não confiável', () => {
    const t = tempoRestanteAgora(300, LIDO, emSegundos(SEGUNDOS_MAXIMOS_DE_ESTIMATIVA + 1));
    expect(t.confiavel).toBe(false);
    // devolve o que foi lido, sem inventar precisão
    expect(t.segundos).toBe(300);
    expect(t.zerou).toBe(false);
  });

  it('no limite da idade ainda é confiável', () => {
    const t = tempoRestanteAgora(300, LIDO, emSegundos(SEGUNDOS_MAXIMOS_DE_ESTIMATIVA));
    expect(t.confiavel).toBe(true);
  });

  it('sem hora de leitura, mostra o número mas não se diz confiável', () => {
    const t = tempoRestanteAgora(99, null);
    expect(t.segundos).toBe(99);
    expect(t.confiavel).toBe(false);
    expect(t.idadeDaLeitura).toBeNull();
  });

  it('sem número nenhum, é "não sei" — e não zero', () => {
    const t = tempoRestanteAgora(null, LIDO);
    expect(t.segundos).toBeNull();
    expect(t.texto).toBeNull();
    expect(t.zerou).toBe(false);
  });

  it('valor negativo não vira cronômetro', () => {
    expect(tempoRestanteAgora(-5, LIDO).segundos).toBeNull();
  });

  it('data inválida não quebra', () => {
    const t = tempoRestanteAgora(99, 'nao-e-data');
    expect(t.segundos).toBe(99);
    expect(t.confiavel).toBe(false);
  });
});

describe('formatarRelogio', () => {
  it('abaixo de uma hora, mm:ss', () => {
    expect(formatarRelogio(99)).toBe('01:39');
    expect(formatarRelogio(0)).toBe('00:00');
    expect(formatarRelogio(59)).toBe('00:59');
  });

  it('acima de uma hora, h:mm:ss', () => {
    expect(formatarRelogio(3750)).toBe('1:02:30');
  });
});

describe('urgenciaDoItem', () => {
  const tempo = (s: number | null, confiavel = true) =>
    ({ segundos: s, texto: null, idadeDaLeitura: 0, confiavel, zerou: false });

  const base: EstadoNoQuadro = { item: 1, fase: 'aberta', sou_lider: true };

  it('perder pesa mais que liderar', () => {
    const perdendo = urgenciaDoItem({ ...base, sou_lider: false }, tempo(300));
    const liderando = urgenciaDoItem(base, tempo(300));
    expect(perdendo).toBeGreaterThan(liderando);
  });

  it('relógio acabando pesa mais que relógio folgado', () => {
    const urgente = urgenciaDoItem({ ...base, sou_lider: false }, tempo(20));
    const folgado = urgenciaDoItem({ ...base, sou_lider: false }, tempo(300));
    expect(urgente).toBeGreaterThan(folgado);
  });

  it('item encerrado vai para o fim', () => {
    expect(urgenciaDoItem({ ...base, fase: 'encerrada', sou_lider: false }, tempo(10))).toBe(0);
  });

  it('tempo não confiável não aumenta a urgência', () => {
    const comConfianca = urgenciaDoItem({ ...base, sou_lider: false }, tempo(10, true));
    const sem = urgenciaDoItem({ ...base, sou_lider: false }, tempo(10, false));
    expect(comConfianca).toBeGreaterThan(sem);
  });

  it('a ordem final é a de quem disputa: perdendo e acabando primeiro', () => {
    const itens: Array<[string, EstadoNoQuadro, ReturnType<typeof tempo>]> = [
      ['liderando folgado', { item: 1, fase: 'aberta', sou_lider: true }, tempo(600)],
      ['encerrado', { item: 2, fase: 'encerrada', sou_lider: false }, tempo(null)],
      ['perdendo acabando', { item: 3, fase: 'aberta', sou_lider: false }, tempo(15)],
      ['perdendo folgado', { item: 4, fase: 'aberta', sou_lider: false }, tempo(600)],
    ];
    const ordem = itens
      .map(([nome, e, t]) => ({ nome, peso: urgenciaDoItem(e, t) }))
      .sort((a, b) => b.peso - a.peso)
      .map((x) => x.nome);
    expect(ordem).toEqual(['perdendo acabando', 'perdendo folgado', 'liderando folgado', 'encerrado']);
  });
});
