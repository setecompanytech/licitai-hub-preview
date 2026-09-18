import { describe, expect, it } from 'vitest';
import { autoridadeDoArquivo, buildParentUpdates, validateExtractedContract } from './validateExtractedContract';
import { clausulaFalaDePrazo } from '@/lib/contratos/prazo-de-entrega';

/**
 * O caso de 17/09 no contrato 17/2025 (GRUPO SANTA ROSA): uma nota de empenho
 * relida pôs no contrato "481 dias" de prazo — a evidência era a linha de um
 * item, "23/04/2026 Inclusão 481,78950 38,0000 18.308,00" (481,79 kg × R$ 38)
 * — e "assinado só pelo órgão", porque empenho não tem assinatura da
 * contratada. O painel mandou não iniciar a execução de um contrato que o
 * próprio sistema tinha lido, em 30/08, como assinado pelos dois.
 */

const LINHA_DE_ITEM = '23/04/2026 Inclusão 481,78950 38,0000 18.308,00';

describe('clausulaFalaDePrazo', () => {
  it('reconhece a cláusula que fala em dias, inclusive com acento', () => {
    expect(clausulaFalaDePrazo('O prazo de entrega será de 10 (dez) dias úteis contados da ordem de fornecimento.')).toBe(true);
    expect(clausulaFalaDePrazo('entrega em até 5 dias corridos')).toBe(true);
    expect(clausulaFalaDePrazo('O pagamento será efetuado no prazo de 30 (trinta) dias')).toBe(true);
  });

  it('não aceita linha de tabela de itens nem ausência de frase', () => {
    expect(clausulaFalaDePrazo(LINHA_DE_ITEM)).toBe(false);
    expect(clausulaFalaDePrazo('AV. ALMIRANTE BARROSO Nº 1155')).toBe(false);
    expect(clausulaFalaDePrazo(null)).toBe(false);
    expect(clausulaFalaDePrazo('')).toBe(false);
  });
});

describe('validateExtractedContract — prazo só com evidência', () => {
  it('descarta o prazo cuja frase citada não fala em prazo, e diz por quê', () => {
    const { normalized, rejected } = validateExtractedContract({
      prazo_entrega_dias: 481,
      prazo_entrega_unidade: 'corridos',
      prazo_entrega_clausula: LINHA_DE_ITEM,
    });
    expect(normalized.prazo_entrega_dias).toBeUndefined();
    expect(normalized.prazo_entrega_unidade).toBeUndefined();
    expect(normalized.prazo_entrega_clausula).toBeUndefined();
    expect(rejected).toContain('prazo_entrega_sem_evidencia');
  });

  it('descarta o prazo que vem sem frase nenhuma', () => {
    const { normalized, rejected } = validateExtractedContract({ prazo_pagamento_dias: 30 });
    expect(normalized.prazo_pagamento_dias).toBeUndefined();
    expect(rejected).toContain('prazo_pagamento_sem_evidencia');
  });

  it('aceita o prazo com cláusula que fala em dias, e guarda a frase junto', () => {
    const { normalized, rejected } = validateExtractedContract({
      prazo_entrega_dias: 10,
      prazo_entrega_unidade: 'úteis',
      prazo_entrega_clausula: 'O prazo de entrega será de 10 (dez) dias úteis contados da ordem de fornecimento.',
      prazo_recebimento_dias: 15,
      prazo_recebimento_clausula: 'O recebimento definitivo ocorrerá em até 15 dias após a entrega.',
      prazo_pagamento_dias: 30,
      prazo_pagamento_marco: 'ateste',
      prazo_pagamento_clausula: 'O pagamento será efetuado em 30 (trinta) dias contados do ateste da nota fiscal.',
    });
    expect(normalized.prazo_entrega_dias).toBe(10);
    expect(normalized.prazo_entrega_unidade).toBe('uteis');
    expect(normalized.prazo_entrega_clausula).toContain('10 (dez) dias úteis');
    expect(normalized.prazo_recebimento_dias).toBe(15);
    expect(normalized.prazo_pagamento_dias).toBe(30);
    expect(normalized.prazo_pagamento_marco).toBe('ateste');
    expect(rejected).toEqual([]);
  });
});

describe('autoridadeDoArquivo — o que cada arquivo pode dizer sobre o contrato', () => {
  it('só o instrumento responde por tudo', () => {
    expect(autoridadeDoArquivo('contrato_original', 'contrato')).toBe('instrumento');
    expect(autoridadeDoArquivo('ata_srp', 'ata_srp')).toBe('instrumento');
    // Chamador antigo, sem o tipo: é o próprio instrumento sendo cadastrado.
    expect(autoridadeDoArquivo(undefined, 'contrato')).toBe('instrumento');
  });

  it('aditivos e a ata de referência só preenchem cláusulas', () => {
    expect(autoridadeDoArquivo('aditivo_valor', 'contrato')).toBe('clausulas');
    expect(autoridadeDoArquivo('prorrogacao_continuo', 'contrato')).toBe('clausulas');
    expect(autoridadeDoArquivo('ata_srp', 'contrato')).toBe('clausulas');
  });

  it('empenho, ordem de fornecimento, publicação e "outro" não alimentam nada', () => {
    expect(autoridadeDoArquivo('ordem_fornecimento', 'contrato')).toBe('nenhuma');
    expect(autoridadeDoArquivo('publicacao', 'contrato')).toBe('nenhuma');
    expect(autoridadeDoArquivo('outro', 'contrato')).toBe('nenhuma');
  });
});

describe('buildParentUpdates — respeita a autoridade do arquivo', () => {
  const lido = {
    numero_contrato: '99/2026',
    valor_global: 18308,
    data_assinatura: '2026-04-24',
    prazo_entrega_dias: 10,
    prazo_entrega_unidade: 'corridos' as const,
    prazo_entrega_clausula: 'entrega em 10 dias corridos',
    assinatura_situacao: 'so_orgao' as const,
    assinatura_orgao: 'ALDELICE DIAS ALVES - CHEFE',
  };
  const contratoEmBranco = { id: 'c1' };

  it('a nota de empenho não escreve nada no contrato — nem o prazo, nem a assinatura', () => {
    expect(buildParentUpdates(lido, contratoEmBranco, 'contrato', 'ordem_fornecimento')).toEqual({});
  });

  it('o aditivo preenche cláusulas em branco, mas não fala por assinatura, valor nem datas do contrato', () => {
    const u = buildParentUpdates(lido, contratoEmBranco, 'contrato', 'aditivo_valor');
    expect(u.prazo_entrega_dias).toBe(10);
    expect(u.prazo_entrega_unidade).toBe('corridos');
    expect(u.assinatura_situacao).toBeUndefined();
    expect(u.valor_global).toBeUndefined();
    expect(u.data_assinatura).toBeUndefined();
    expect(u.numero_contrato).toBeUndefined();
  });

  it('o contrato original fala por tudo, inclusive sobrescrevendo a assinatura lida antes', () => {
    const u = buildParentUpdates(lido, { ...contratoEmBranco, assinatura_situacao: 'ambas' }, 'contrato', 'contrato_original');
    expect(u.numero_contrato).toBe('99/2026');
    expect(u.valor_global).toBe(18308);
    expect(u.prazo_entrega_dias).toBe(10);
    expect(u.assinatura_situacao).toBe('so_orgao');
    expect(u.assinatura_observacao).toContain('Órgão: ALDELICE DIAS ALVES');
  });

  it('nunca sobrescreve prazo já preenchido, seja de onde for a leitura', () => {
    const u = buildParentUpdates(lido, { ...contratoEmBranco, prazo_entrega_dias: 5 }, 'contrato', 'contrato_original');
    expect(u.prazo_entrega_dias).toBeUndefined();
  });
});
