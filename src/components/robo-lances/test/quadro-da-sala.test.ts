import { describe, it, expect } from 'vitest';
import { posicaoNoQuadro, resumoDoQuadro, type EstadoNoQuadro } from '@/lib/robo/quadro-da-sala';

/**
 * O quadro de status da aba Acompanhamento (D13): uma linha com onde a empresa
 * está e o que o robô está fazendo, sem abrir a tela remota.
 */

// Como o webhook grava a BAQPLAST no item 1 do 7/2026, com a trava fechada.
const BAQPLAST: EstadoNoQuadro = {
  item: 1,
  melhor_lance: 3100,
  nosso_lance: 4999.7,
  posicao: 8,
  sou_lider: false,
  tem_proposta: true,
  nossa_desclassificada: false,
  modo: 'Aberto',
  fase: null,
  decisao: {
    acao: 'aguardar',
    motivo: 'Portal "comprasgov" nao esta liberado...',
    motivo_legivel: 'Só acompanhando: o envio de lances ainda não foi liberado para este portal',
  },
};

// O separador de milhar e o espaço do "R$" vêm do Intl; a comparação ignora espaços.
const semEspacos = (s: string) => s.replace(/\s/g, '');

describe('resumoDoQuadro', () => {
  it('a BAQPLAST em 8º no item 1: a linha que o Rafael vai ver', () => {
    const r = resumoDoQuadro(BAQPLAST, { sessaoViva: true, estadoEm: '2026-09-16T17:00:00Z', agora: new Date('2026-09-16T17:00:20Z') });
    expect(semEspacos(r.partes.join(' · '))).toBe(semEspacos('Item 1 · Modo aberto · 8º lugar · Melhor R$ 3.100,00 · Nosso R$ 4.999,70'));
    expect(r.motivo).toBe('Só acompanhando: o envio de lances ainda não foi liberado para este portal');
    expect(r.aviso).toBeNull();
  });

  it('sem notícia há 2 min ou mais com a sessão de pé: avisa', () => {
    const r = resumoDoQuadro(BAQPLAST, { sessaoViva: true, estadoEm: '2026-09-16T17:00:00Z', agora: new Date('2026-09-16T17:03:10Z') });
    expect(r.aviso).toBe('Sem notícia do robô há 3 min — a leitura pode estar desatualizada');
  });

  it('sessão terminada: diz que é a última leitura', () => {
    expect(resumoDoQuadro(BAQPLAST, { sessaoViva: false }).aviso).toBe('Última leitura antes de a sessão do robô terminar');
  });

  it('o que não foi lido não aparece — nem como zero', () => {
    const r = resumoDoQuadro({ item: 1, decisao: { acao: 'aguardar', motivo: 'Não foi possível ler o melhor lance no portal' } }, { sessaoViva: true });
    expect(r.partes).toEqual(['Item 1']);
    expect(r.motivo).toBe('Não foi possível ler o melhor lance no portal');
  });

  it('a fase lida entra com rótulo', () => {
    expect(resumoDoQuadro({ ...BAQPLAST, fase: 'aberta' }, { sessaoViva: true }).partes).toContain('Etapa aberta');
  });
});

describe('posicaoNoQuadro', () => {
  it('liderança, desclassificada e sem proposta', () => {
    expect(posicaoNoQuadro({ ...BAQPLAST, sou_lider: true, posicao: 1 })).toBe('1º lugar');
    expect(posicaoNoQuadro({ ...BAQPLAST, nossa_desclassificada: true })).toBe('Proposta desclassificada');
    expect(posicaoNoQuadro({ ...BAQPLAST, tem_proposta: false, posicao: null })).toBe('Sem proposta da empresa');
    expect(posicaoNoQuadro({ item: 1 })).toBeNull();
  });
});
