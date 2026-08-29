import { describe, it, expect } from 'vitest';
import {
  validateExtractedContract,
  buildParentUpdates,
} from '@/components/contratos/utils/validateExtractedContract';

/**
 * O elo que faltava.
 *
 * A extração passou a ler prazo e local de entrega do PDF, e o banco ganhou as
 * colunas — mas o validador no meio do caminho não conhecia os campos, então a
 * IA extraía, a função devolvia e o front descartava em silêncio. A cadeia
 * inteira parecia montada e não gravava nada.
 */
describe('validateExtractedContract — prazo e local de entrega', () => {
  it('aceita o par dias + unidade', () => {
    const { normalized } = validateExtractedContract({
      prazo_entrega_dias: 10,
      prazo_entrega_unidade: 'úteis',
      prazo_entrega_clausula: 'Prazo de 10 (dez) dias úteis, contados do recebimento da ordem.',
    });
    expect(normalized.prazo_entrega_dias).toBe(10);
    expect(normalized.prazo_entrega_unidade).toBe('uteis');
    expect(normalized.prazo_entrega_clausula).toMatch(/dez\) dias úteis/);
  });

  it('sem unidade, aplica a regra supletiva do art. 132 — corridos', () => {
    // Não é palpite: a lei diz que, sem menção expressa, o prazo é corrido.
    const { normalized } = validateExtractedContract({ prazo_entrega_dias: 30 });
    expect(normalized.prazo_entrega_unidade).toBe('corridos');
  });

  it('unidade que não existe não vira palpite', () => {
    const { normalized } = validateExtractedContract({
      prazo_entrega_dias: 5,
      prazo_entrega_unidade: 'semanas',
    });
    expect(normalized.prazo_entrega_unidade).toBe('corridos');
  });

  it('rejeita prazo fora da faixa plausível', () => {
    // 20260829 é uma data lida como prazo — daria limite no ano 57 mil.
    const { normalized, rejected } = validateExtractedContract({ prazo_entrega_dias: 20260829 });
    expect(normalized.prazo_entrega_dias).toBeUndefined();
    expect(rejected).toContain('prazo_entrega_dias');
  });

  it('rejeita prazo fracionado', () => {
    const { normalized, rejected } = validateExtractedContract({ prazo_entrega_dias: 10.5 });
    expect(normalized.prazo_entrega_dias).toBeUndefined();
    expect(rejected).toContain('prazo_entrega_dias');
  });

  it('lê local e prazo de recebimento', () => {
    const { normalized } = validateExtractedContract({
      local_entrega: 'Almoxarifado Central — Av. Augusto Montenegro, 4000, Belém/PA',
      prazo_recebimento_dias: 15,
      prazo_recebimento_unidade: 'corridos',
    });
    expect(normalized.local_entrega).toMatch(/Almoxarifado Central/);
    expect(normalized.prazo_recebimento_dias).toBe(15);
    expect(normalized.prazo_recebimento_unidade).toBe('corridos');
  });

  it('documento sem cláusula de entrega não inventa prazo', () => {
    const { normalized } = validateExtractedContract({ numero_contrato: '008/2026' });
    expect(normalized.prazo_entrega_dias).toBeUndefined();
    expect(normalized.prazo_entrega_unidade).toBeUndefined();
    expect(normalized.local_entrega).toBeUndefined();
  });
});

describe('buildParentUpdates — prazo e local de entrega', () => {
  const vazio = {};

  it('grava dias e unidade SEMPRE juntos', () => {
    // O CHECK do banco recusa unidade sem dias. Gravar só o dia deixaria a
    // unidade nula e derrubaria a linha inteira.
    const u = buildParentUpdates(
      { prazo_entrega_dias: 10, prazo_entrega_unidade: 'uteis' },
      vazio,
      'contrato',
    );
    expect(u.prazo_entrega_dias).toBe(10);
    expect(u.prazo_entrega_unidade).toBe('uteis');
  });

  it('não sobrescreve prazo que alguém já preencheu à mão', () => {
    const u = buildParentUpdates(
      { prazo_entrega_dias: 30, prazo_entrega_unidade: 'corridos' },
      { prazo_entrega_dias: 10, prazo_entrega_unidade: 'uteis' },
      'contrato',
    );
    expect(u.prazo_entrega_dias).toBeUndefined();
    expect(u.prazo_entrega_unidade).toBeUndefined();
  });

  it('vale para ata também — é dela que os pedidos saem', () => {
    const u = buildParentUpdates(
      { prazo_entrega_dias: 5, prazo_entrega_unidade: 'uteis', local_entrega: 'Sede' },
      vazio,
      'ata_srp',
    );
    expect(u.prazo_entrega_dias).toBe(5);
    expect(u.local_entrega).toBe('Sede');
  });

  it('local e prazo são independentes: um pode vir sem o outro', () => {
    const u = buildParentUpdates({ local_entrega: 'Sede' }, vazio, 'contrato');
    expect(u.local_entrega).toBe('Sede');
    expect(u.prazo_entrega_dias).toBeUndefined();
  });

  it('a cláusula literal acompanha o prazo que ela justifica', () => {
    const u = buildParentUpdates(
      {
        prazo_entrega_dias: 10,
        prazo_entrega_unidade: 'uteis',
        prazo_entrega_clausula: 'Cláusula Quinta — 10 (dez) dias úteis.',
      },
      vazio,
      'contrato',
    );
    expect(u.prazo_entrega_clausula).toMatch(/Cláusula Quinta/);
  });

  it('nada extraído, nada gravado', () => {
    const u = buildParentUpdates({}, vazio, 'contrato');
    expect(Object.keys(u)).toHaveLength(0);
  });
});

describe('assinatura das partes', () => {
  it('lê os quatro estados', () => {
    for (const v of ['ambas', 'so_contratada', 'so_orgao', 'nenhuma']) {
      expect(validateExtractedContract({ assinatura_situacao: v }).normalized.assinatura_situacao).toBe(v);
    }
  });

  it('valor fora da lista é descartado — "não sei" é melhor que palpite', () => {
    // Um 'ambas' errado libera a execução de um contrato que não vincula
    // ninguém: é o pior erro possível deste campo.
    const { normalized } = validateExtractedContract({ assinatura_situacao: 'parcial' });
    expect(normalized.assinatura_situacao).toBeUndefined();
  });

  it('sobrescreve o valor anterior — o PDF anexado é a fonte', () => {
    // Trocar o PDF pela versão finalmente assinada pelas duas partes tem de
    // refletir. Manter o valor antigo deixaria o alerta preso no passado.
    const u = buildParentUpdates(
      { assinatura_situacao: 'ambas' },
      { assinatura_situacao: 'so_contratada' },
      'contrato',
    );
    expect(u.assinatura_situacao).toBe('ambas');
  });
});
