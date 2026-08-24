import { describe, it, expect } from 'vitest';
import {
  adiar,
  chaveDoLembrete,
  diasAteVencer,
  diasDeAdiamento,
  estaAdiado,
  lembretesDe,
  prazoPorExtenso,
  semOsObsoletos,
} from '@/lib/documentos/lembretes';

const HOJE = new Date(2026, 7, 24); // 24/08/2026, hora local

describe('diasAteVencer', () => {
  it('conta por data, sem deixar a hora deslocar o resultado', () => {
    expect(diasAteVencer('2026-09-18', HOJE)).toBe(25);
    expect(diasAteVencer('2026-08-24', HOJE)).toBe(0);
    expect(diasAteVencer('2026-08-23', HOJE)).toBe(-1);
  });

  // Ler a validade como meia-noite UTC e comparar com o "agora" local fazia o
  // documento que vence hoje contar como vencido desde as 21h da véspera.
  it('não antecipa o vencimento no fuso do Brasil', () => {
    const fimDaTarde = new Date(2026, 7, 24, 23, 30);
    expect(diasAteVencer('2026-08-24', fimDaTarde)).toBe(0);
  });
});

describe('lembretesDe', () => {
  const docs = [
    { id: 'a', nome: 'CND Federal', validade: '2026-09-18' },   // 25 dias
    { id: 'b', nome: 'CRF / FGTS', validade: '2026-08-07' },    // vencido
    { id: 'c', nome: 'CND Municipal', validade: '2026-12-20' }, // longe
    { id: 'd', nome: 'CNDT', validade: '2026-08-28' },          // 4 dias
  ];

  it('só fala do que está dentro da janela de trinta dias', () => {
    expect(lembretesDe(docs, HOJE).map((l) => l.id)).toEqual(['b', 'd', 'a']);
  });

  it('põe o mais urgente primeiro', () => {
    const [primeiro] = lembretesDe(docs, HOJE);
    expect(primeiro.gravidade).toBe('vencido');
  });

  it('separa o que impede do que avisa', () => {
    const porId = Object.fromEntries(lembretesDe(docs, HOJE).map((l) => [l.id, l.gravidade]));
    expect(porId).toEqual({ b: 'vencido', d: 'critico', a: 'atencao' });
  });
});

describe('o × adia, não apaga', () => {
  it('cala por menos tempo quanto mais perto do vencimento', () => {
    expect(diasDeAdiamento(25)).toBe(7);
    expect(diasDeAdiamento(12)).toBe(3);
    expect(diasDeAdiamento(4)).toBe(1);
    expect(diasDeAdiamento(-5)).toBe(1);
  });

  it('volta a aparecer quando o prazo do adiamento passa', () => {
    const l = { chave: 'a:2026-09-18', dias: 25 };
    const guardado = adiar({}, l, HOJE);
    expect(estaAdiado(guardado, l.chave, new Date(2026, 7, 27))).toBe(true);
    expect(estaAdiado(guardado, l.chave, new Date(2026, 8, 1))).toBe(false);
  });

  // A exigência do dono do produto: "deve ficar aparecendo como um lembrete, até
  // o documento ser atualizado". Como a chave carrega a validade, renovar o
  // documento invalida o adiamento sem o sistema precisar detectar nada.
  it('renovar o documento anula o adiamento', () => {
    const antigo = { id: 'a', validade: '2026-09-18' };
    const guardado = adiar({}, { chave: chaveDoLembrete(antigo), dias: 25 }, HOJE);
    const renovado = { id: 'a', validade: '2027-03-18' };
    expect(estaAdiado(guardado, chaveDoLembrete(renovado), HOJE)).toBe(false);
  });

  it('descarta adiamento de documento que saiu da lista', () => {
    const guardado = { 'a:2026-09-18': '2099-01-01T00:00:00.000Z', 'z:2020-01-01': '2099-01-01T00:00:00.000Z' };
    const vivos = lembretesDe([{ id: 'a', nome: 'CND', validade: '2026-09-18' }], HOJE);
    expect(Object.keys(semOsObsoletos(guardado, vivos))).toEqual(['a:2026-09-18']);
  });
});

describe('prazoPorExtenso', () => {
  it('diz o prazo em português, sem obrigar a contar', () => {
    expect(prazoPorExtenso(25)).toBe('vence em 25 dias');
    expect(prazoPorExtenso(1)).toBe('vence amanhã');
    expect(prazoPorExtenso(0)).toBe('vence hoje');
    expect(prazoPorExtenso(-1)).toBe('venceu ontem');
    expect(prazoPorExtenso(-17)).toBe('venceu há 17 dias');
  });
});
