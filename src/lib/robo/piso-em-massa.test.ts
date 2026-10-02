import { describe, expect, it } from 'vitest';
import {
  aplicarPisoEmMassa,
  pisoPelaRegra,
  resumoDoPisoEmMassa,
  tetoDoPercentual,
  type ItemParaPiso,
} from '@/lib/robo/piso-em-massa';

/** Três itens como os de um pregão de verdade: um sem custo, um já com piso. */
const ITENS: ItemParaPiso[] = [
  { id: 'a', numero: 1, valor: 100, custoUnitario: 60, valorMinimo: null },
  { id: 'b', numero: 2, valor: 597.9, custoUnitario: null, valorMinimo: null },
  { id: 'c', numero: 3, valor: 1034.18, custoUnitario: 800, valorMinimo: 900 },
];

describe('pisoPelaRegra', () => {
  it('tira o percentual do valor unitário', () => {
    expect(pisoPelaRegra({ id: 'x', valor: 100 }, { base: 'valor', percentual: 85 })).toBe(85);
  });

  it('tira o percentual do custo quando a base é o custo', () => {
    expect(pisoPelaRegra({ id: 'x', valor: 100, custoUnitario: 60 }, { base: 'custo', percentual: 110 })).toBe(66);
  });

  it('arredonda em centavos, sem escorregão de ponto flutuante', () => {
    expect(pisoPelaRegra({ id: 'x', valor: 597.9 }, { base: 'valor', percentual: 85 })).toBe(508.22);
  });

  it('sem base, devolve null — e NÃO zero', () => {
    expect(pisoPelaRegra({ id: 'x', valor: null }, { base: 'valor', percentual: 85 })).toBeNull();
    expect(pisoPelaRegra({ id: 'x', valor: 100 }, { base: 'custo', percentual: 85 })).toBeNull();
  });

  it('sobre o VALOR, passar de 100% não vale — o piso nasceria acima do preço', () => {
    expect(pisoPelaRegra({ id: 'x', valor: 100 }, { base: 'valor', percentual: 0 })).toBeNull();
    expect(pisoPelaRegra({ id: 'x', valor: 100 }, { base: 'valor', percentual: 101 })).toBeNull();
    expect(pisoPelaRegra({ id: 'x', valor: 100 }, { base: 'valor', percentual: NaN })).toBeNull();
  });

  it('sobre o CUSTO, passar de 100% é o caso normal (custo + margem)', () => {
    expect(pisoPelaRegra({ id: 'x', custoUnitario: 60 }, { base: 'custo', percentual: 110 })).toBe(66);
    expect(pisoPelaRegra({ id: 'x', custoUnitario: 60 }, { base: 'custo', percentual: 130 })).toBe(78);
    expect(tetoDoPercentual('custo')).toBe(1000);
    expect(tetoDoPercentual('valor')).toBe(100);
  });

  it('valor negativo ou zero não vira base', () => {
    expect(pisoPelaRegra({ id: 'x', valor: 0 }, { base: 'valor', percentual: 85 })).toBeNull();
    expect(pisoPelaRegra({ id: 'x', valor: -10 }, { base: 'valor', percentual: 85 })).toBeNull();
  });
});

describe('aplicarPisoEmMassa', () => {
  it('preenche só os vazios, por padrão', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'valor', percentual: 85 });
    expect(r.itens[0].valorMinimo).toBe(85);
    expect(r.itens[1].valorMinimo).toBe(508.22);
    // o item 3 já tinha piso: fica como estava
    expect(r.itens[2].valorMinimo).toBe(900);
    expect(r.aplicados).toBe(2);
    expect(r.preservados).toBe(1);
  });

  it('com somenteVazios false, regrava tudo', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'valor', percentual: 85, somenteVazios: false });
    expect(r.itens[2].valorMinimo).toBe(879.05);
    expect(r.aplicados).toBe(3);
    expect(r.preservados).toBe(0);
  });

  it('item sem base fica SEM piso e é nomeado', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'custo', percentual: 110 });
    expect(r.itens[0].valorMinimo).toBe(66);
    // o item 2 não tem custo: continua sem piso
    expect(r.itens[1].valorMinimo).toBeNull();
    expect(r.semBase).toEqual([{ id: 'b', numero: 2 }]);
  });

  it('item com piso não perde o piso quando a regra não sabe calcular o dele', () => {
    const itens: ItemParaPiso[] = [{ id: 'z', numero: 9, valor: null, valorMinimo: 500 }];
    const r = aplicarPisoEmMassa(itens, { base: 'valor', percentual: 85, somenteVazios: false });
    expect(r.itens[0].valorMinimo).toBe(500);
    expect(r.semBase).toEqual([]);
  });

  it('não muda a lista original', () => {
    const copia = JSON.parse(JSON.stringify(ITENS));
    aplicarPisoEmMassa(ITENS, { base: 'valor', percentual: 85 });
    expect(ITENS).toEqual(copia);
  });

  it('lista vazia não quebra', () => {
    const r = aplicarPisoEmMassa([], { base: 'valor', percentual: 85 });
    expect(r.itens).toEqual([]);
    expect(r.aplicados).toBe(0);
  });

  it('percentual inválido não aplica em ninguém', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'valor', percentual: 0 });
    expect(r.aplicados).toBe(0);
    expect(r.itens[0].valorMinimo).toBeNull();
  });

  it('um pregão de 182 itens é aplicado de uma vez', () => {
    const muitos: ItemParaPiso[] = Array.from({ length: 182 }, (_, i) => ({
      id: String(i), numero: i + 1, valor: 10 + i, valorMinimo: null,
    }));
    const r = aplicarPisoEmMassa(muitos, { base: 'valor', percentual: 90 });
    expect(r.aplicados).toBe(182);
    expect(r.itens[181].valorMinimo).toBe(171.9);
  });
});

describe('resumoDoPisoEmMassa', () => {
  it('conta o que foi feito, em português', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'valor', percentual: 85 });
    expect(resumoDoPisoEmMassa(r, { base: 'valor', percentual: 85 })).toBe(
      'Piso de 85% do valor unitário aplicado em 2 itens. 1 item já tinha piso e foi preservado.',
    );
  });

  it('diz QUAIS itens ficaram sem piso', () => {
    const r = aplicarPisoEmMassa(ITENS, { base: 'custo', percentual: 110 });
    const texto = resumoDoPisoEmMassa(r, { base: 'custo', percentual: 110 });
    expect(texto).toContain('1 item ficou sem piso por não ter custo (2)');
  });

  it('não finge sucesso quando não aplicou em ninguém', () => {
    const r = aplicarPisoEmMassa([{ id: 'a', numero: 1, valor: null, valorMinimo: null }], {
      base: 'valor', percentual: 85,
    });
    expect(resumoDoPisoEmMassa(r, { base: 'valor', percentual: 85 })).toContain('Nenhum item recebeu piso');
  });
});
