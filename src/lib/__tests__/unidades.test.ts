import { describe, it, expect } from 'vitest';
import {
  UNIDADES, normalizarUnidade, rotuloDaUnidade, buscarUnidades, paraNfe,
  unidadesMaisUsadas,
} from '../unidades';

describe('vocabulário de unidades', () => {
  it('não tem dois códigos para o mesmo conceito', () => {
    const codigos = UNIDADES.map((u) => u.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    // E nenhum sinônimo pode ser o código de outra unidade.
    const porCodigo = new Set(codigos);
    for (const u of UNIDADES) {
      for (const s of u.sinonimos ?? []) {
        expect(porCodigo.has(s), `${s} é sinônimo de ${u.codigo} e código de outra`).toBe(false);
      }
    }
  });

  it('traz grafias diferentes ao mesmo código', () => {
    ['UNID', 'Unid.', 'unidade', 'UND'].forEach((g) =>
      expect(normalizarUnidade(g), g).toBe('UN'));
    ['QUILO', 'kg', 'Kg.'].forEach((g) => expect(normalizarUnidade(g), g).toBe('KG'));
    // FRC e FR eram duas entradas para frasco antes da unificação.
    expect(normalizarUnidade('FRC')).toBe('FR');
    expect(normalizarUnidade('LATA')).toBe('LT');
    expect(normalizarUnidade('SACO')).toBe('SC');
  });

  it('não descarta unidade desconhecida vinda de edital', () => {
    // Melhor guardar o que o órgão escreveu do que perder a informação.
    expect(normalizarUnidade('BANDEJ')).toBe('BANDEJ');
    expect(normalizarUnidade('')).toBe('');
    expect(normalizarUnidade(null)).toBe('');
  });

  it('rótulo legível, com o código entre parênteses', () => {
    expect(rotuloDaUnidade('kg')).toBe('Quilograma (KG)');
    expect(rotuloDaUnidade('BANDEJ')).toBe('BANDEJ');
  });

  it('busca por código, nome ou sinônimo', () => {
    expect(buscarUnidades('quilo').map((u) => u.codigo)).toContain('KG');
    expect(buscarUnidades('cx').map((u) => u.codigo)).toContain('CX');
    expect(buscarUnidades('').length).toBe(UNIDADES.length);
  });

  it('as mais usadas são recorte da lista, não outra lista', () => {
    const codigos = new Set(UNIDADES.map((u) => u.codigo));
    unidadesMaisUsadas().forEach((u) => expect(codigos.has(u.codigo)).toBe(true));
  });

  it('diz o que a NF-e aceita, e avisa quando não há correspondência', () => {
    expect(paraNfe('quilo')).toBe('KG');
    expect(paraNfe('FRC')).toBeNull();   // frasco não está na tabela da SEFAZ
    expect(paraNfe('BANDEJ')).toBeNull();
  });
});
