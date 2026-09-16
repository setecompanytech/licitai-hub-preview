import { describe, it, expect } from 'vitest';
import { identidadeDoProcesso, siglaDaModalidade, objetoLegivel } from '@/lib/licitacao/identidade-do-processo';

describe('identidadeDoProcesso', () => {
  it('o caso do print: "033" ganha a modalidade e vira identidade', () => {
    expect(identidadeDoProcesso({ numero: '033', modalidade: 'Pregão Eletrônico' }))
      .toBe('PE nº 33');
  });

  // A duplicidade de 12/09: o portal grava a modalidade DENTRO do campo
  // número, e o card virava "PREGÃO Pregão Eletrônico SRP Nº 014".
  it('número que carrega modalidade e SRP não duplica no card', () => {
    expect(identidadeDoProcesso({ numero: 'Pregão Eletrônico SRP Nº 014', modalidade: 'Pregão - Eletrônico' }))
      .toBe('PE nº 14 · SRP');
    expect(identidadeDoProcesso({ numero: 'P.E. 044', modalidade: 'Pregão - Eletrônico' }))
      .toBe('PE nº 44');
    expect(identidadeDoProcesso({ numero: '00046', modalidade: 'Pregão Eletrônico' }))
      .toBe('PE nº 46');
    expect(identidadeDoProcesso({ numero: '011/2026', modalidade: 'Pregão Eletrônico' }))
      .toBe('PE nº 11/2026');
  });

  it('"Pregão - Eletrônico" com hífen vira PE, não PREGÃO', () => {
    expect(siglaDaModalidade('Pregão - Eletrônico')).toBe('PE');
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

  /* O caso do painel de 16/09: o PNCP grava só o sequencial em `numero` (70 dos
     97 processos da base), e o ano vive em `ano_compra`. A agenda mostrava "86". */
  it('o sequencial do PNCP ganha o ano de ano_compra', () => {
    expect(identidadeDoProcesso({ numero: '86', modalidade: 'Pregão - Eletrônico', ano_compra: '2026' }))
      .toBe('PE nº 86/2026');
  });

  it('sem ano_compra, não inventa ano', () => {
    expect(identidadeDoProcesso({ numero: '86', modalidade: 'Pregão - Eletrônico' }))
      .toBe('PE nº 86');
  });

  it('ano publicado no próprio número manda — ano_compra só socorre quem não tem', () => {
    expect(identidadeDoProcesso({ numero: '17/2026', modalidade: 'Pregão - Eletrônico', ano_compra: '2025' }))
      .toBe('PE nº 17/2026');
  });

  it('sem modalidade, o número segura a identidade sozinho', () => {
    expect(identidadeDoProcesso({ numero: '99023/2026', modalidade: null })).toBe('nº 99023/2026');
  });

  it('nunca devolve vazio — card sem identidade é o defeito de origem', () => {
    expect(identidadeDoProcesso({})).toBe('Processo manual');
    expect(identidadeDoProcesso({ numero: '', modalidade: '' })).toBe('Processo manual');
  });
});

describe('objetoLegivel', () => {
  it('caixa alta inteira vira caixa de sentença', () => {
    expect(objetoLegivel('REGISTRO DE PREÇO PARA AQUISIÇÃO DE MATERIAL DE ESCRITÓRIO'))
      .toBe('Registro de preço para aquisição de material de escritório');
  });

  it('texto misto fica como veio — já foi escrito por gente', () => {
    expect(objetoLegivel('Registro de preços para a aquisição de gêneros alimentícios'))
      .toBe('Registro de preços para a aquisição de gêneros alimentícios');
  });

  it('sentenças múltiplas recapitalizam após o ponto', () => {
    expect(objetoLegivel('AQUISIÇÃO DE CARNES. ENTREGA PARCELADA.'))
      .toBe('Aquisição de carnes. Entrega parcelada.');
  });

  it('texto curto demais não é julgado', () => {
    expect(objetoLegivel('PMPA')).toBe('PMPA');
  });

  it('vazio devolve vazio', () => {
    expect(objetoLegivel(null)).toBe('');
  });
});
