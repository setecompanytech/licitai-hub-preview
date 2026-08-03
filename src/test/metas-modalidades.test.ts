import { describe, it, expect } from 'vitest';
import { normalizarModalidade, rotuloModalidade } from '@/lib/metas/modalidades';

describe('normalizarModalidade', () => {
  it('reconhece as grafias reais de pregão eletrônico vistas no banco', () => {
    const variantes = [
      'Pregão Eletrônico',
      'Pregão - Eletrônico',
      'PREGAO ELETRONICO',
      'pregao eletronico',
      'Pregão eletrônico (SRP)',
    ];
    for (const v of variantes) {
      expect(normalizarModalidade(v)).toBe('pregao_eletronico');
    }
  });

  it('separa pregão presencial de eletrônico', () => {
    expect(normalizarModalidade('Pregão Presencial')).toBe('pregao_presencial');
    expect(normalizarModalidade('Pregão - Presencial')).toBe('pregao_presencial');
  });

  it('trata pregão sem qualificador como eletrônico', () => {
    expect(normalizarModalidade('Pregão')).toBe('pregao_eletronico');
  });

  it('reconhece dispensa e inexigibilidade', () => {
    expect(normalizarModalidade('Dispensa de Licitação')).toBe('dispensa');
    expect(normalizarModalidade('DISPENSA ELETRONICA')).toBe('dispensa');
    expect(normalizarModalidade('Inexigibilidade')).toBe('inexigibilidade');
  });

  it('reconhece concorrência, inclusive a grafia do workspace', () => {
    expect(normalizarModalidade('Concorrência - Eletrônica')).toBe('concorrencia');
    expect(normalizarModalidade('Concorrencia')).toBe('concorrencia');
  });

  it('não confunde concorrência com concurso', () => {
    expect(normalizarModalidade('Concurso')).toBe('concurso');
    expect(normalizarModalidade('Concorrência')).toBe('concorrencia');
  });

  it('cai em "outra" para vazio, nulo e texto desconhecido', () => {
    expect(normalizarModalidade('')).toBe('outra');
    expect(normalizarModalidade(null)).toBe('outra');
    expect(normalizarModalidade(undefined)).toBe('outra');
    expect(normalizarModalidade('Chamamento Público')).toBe('outra');
  });
});

describe('rotuloModalidade', () => {
  it('traduz o código para o rótulo em português', () => {
    expect(rotuloModalidade('pregao_eletronico')).toBe('Pregão Eletrônico');
    expect(rotuloModalidade('dispensa')).toBe('Dispensa de Licitação');
  });

  it('devolve o próprio código quando não conhece', () => {
    expect(rotuloModalidade('modalidade_inexistente')).toBe('modalidade_inexistente');
  });
});
