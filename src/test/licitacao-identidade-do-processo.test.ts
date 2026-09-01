import { describe, it, expect } from 'vitest';
import { identidadeDoProcesso, siglaDaModalidade } from '@/lib/licitacao/identidade-do-processo';

describe('identidadeDoProcesso', () => {
  it('o caso do print: "033" ganha a modalidade e vira identidade', () => {
    expect(identidadeDoProcesso({ numero: '033', modalidade: 'Pregão Eletrônico' }))
      .toBe('PE 033');
  });

  it('as modalidades correntes viram as siglas do setor', () => {
    expect(siglaDaModalidade('Pregão Presencial')).toBe('PP');
    expect(siglaDaModalidade('Dispensa de Licitação')).toBe('DL');
    expect(siglaDaModalidade('Inexigibilidade')).toBe('INEX');
    expect(siglaDaModalidade('Concorrência Pública')).toBe('CONC');
  });

  it('modalidade desconhecida volta como veio — sigla inventada confunde mais', () => {
    expect(siglaDaModalidade('Chamamento Público')).toBe('Chamamento Público');
  });

  it('"Processo Manual" no campo número não é número', () => {
    expect(identidadeDoProcesso({ numero: 'Processo Manual', modalidade: null }))
      .toBe('Processo manual');
    expect(identidadeDoProcesso({ numero: 'Processo Manual', modalidade: 'Pregão Eletrônico' }))
      .toBe('PE · processo manual');
  });

  it('sem modalidade, o número segura a identidade sozinho', () => {
    expect(identidadeDoProcesso({ numero: '99023/2026', modalidade: null })).toBe('99023/2026');
  });

  it('nunca devolve vazio — card sem identidade é o defeito de origem', () => {
    expect(identidadeDoProcesso({})).toBe('Processo manual');
    expect(identidadeDoProcesso({ numero: '', modalidade: '' })).toBe('Processo manual');
  });
});
