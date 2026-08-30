import { describe, it, expect } from 'vitest';
import { avaliarCabimento } from '@/lib/contratos/cabimento';

const cheio = {
  empenho: { rotulo: 'cota principal do empenho 2026NE003716', saldoQtd: 306000, tipo: 'ordinario' },
  item: { rotulo: 'item cód. 01', saldoQtd: 306000 },
  contrato: { saldoValor: 175440 },
};

describe('avaliarCabimento', () => {
  it('cabe quando os três comportam, e diz qual é o mais apertado', () => {
    const c = avaliarCabimento({ quantidade: 10000, valor: 4300 }, cheio);
    expect(c.cabe).toBe(true);
    expect(c.limites).toHaveLength(3);
    expect(c.frase).toMatch(/Cabe/);
  });

  it('o empenho barra mesmo com item e contrato folgados', () => {
    // O caso do global fracionado: restam 60 na cota, o item tem 300 mil e o
    // contrato tem quase tudo. Verificar só o item deixaria passar.
    const c = avaliarCabimento({ quantidade: 70, valor: 30 }, {
      empenho: { rotulo: 'cota principal', saldoQtd: 60, tipo: 'global' },
      item: { rotulo: 'item cód. 01', saldoQtd: 300000 },
      contrato: { saldoValor: 170000 },
    });
    expect(c.cabe).toBe(false);
    expect(c.gargalo?.origem).toBe('empenho');
    expect(c.frase).toMatch(/Faltam 10/);
  });

  it('o item barra mesmo com empenho e contrato folgados', () => {
    const c = avaliarCabimento({ quantidade: 500, valor: 215 }, {
      empenho: { rotulo: 'cota principal', saldoQtd: 100000, tipo: 'global' },
      item: { rotulo: 'item cód. 02', saldoQtd: 400 },
      contrato: { saldoValor: 170000 },
    });
    expect(c.gargalo?.origem).toBe('item');
    expect(c.gargalo?.providencia).toMatch(/aditivo de quantidade/);
  });

  it('o contrato barra pelo VALOR, não pela quantidade', () => {
    const c = avaliarCabimento({ quantidade: 10, valor: 5000 }, {
      empenho: { rotulo: 'cota', saldoQtd: 100000, tipo: 'global' },
      item: { rotulo: 'item', saldoQtd: 100000 },
      contrato: { saldoValor: 1000 },
    });
    expect(c.gargalo?.origem).toBe('contrato');
    expect(c.gargalo?.unidade).toBe('valor');
  });

  it('a providência muda com a espécie do empenho', () => {
    const estimativo = avaliarCabimento({ quantidade: 100, valor: 43 }, {
      empenho: { rotulo: 'cota', saldoQtd: 10, tipo: 'estimativo' },
    });
    const global = avaliarCabimento({ quantidade: 100, valor: 43 }, {
      empenho: { rotulo: 'cota', saldoQtd: 10, tipo: 'global' },
    });
    // Ultrapassar um estimativo é rotina que pede reforço; um global é despesa
    // sem cobertura. Mesma falta, providências diferentes.
    expect(estimativo.gargalo?.providencia).toMatch(/rotina/);
    expect(global.gargalo?.providencia).toMatch(/art\. 60/);
  });

  it('saldo ausente não é avaliado — nem como zero, nem como infinito', () => {
    // Tratar ausência como "cabe" libera o que ninguém conferiu; como "não
    // cabe" trava a maioria dos contratos, que não têm empenho registrado.
    const c = avaliarCabimento({ quantidade: 10, valor: 5 }, {
      empenho: null,
      item: { rotulo: 'item', saldoQtd: 100 },
      contrato: { saldoValor: null },
    });
    expect(c.limites).toHaveLength(1);
    expect(c.limites[0].origem).toBe('item');
  });

  it('sem saldo nenhum registrado, passa e diz que não verificou', () => {
    const c = avaliarCabimento({ quantidade: 10, valor: 5 }, {});
    expect(c.cabe).toBe(true);
    expect(c.frase).toMatch(/sem verificação/);
  });

  it('empate no limite exato ainda cabe', () => {
    const c = avaliarCabimento({ quantidade: 100, valor: 43 }, {
      empenho: { rotulo: 'cota', saldoQtd: 100, tipo: 'global' },
    });
    expect(c.cabe).toBe(true);
    expect(c.gargalo?.folga).toBe(0);
  });

  it('no empate de folga, o empenho manda — é a consequência mais grave', () => {
    const c = avaliarCabimento({ quantidade: 100, valor: 43 }, {
      empenho: { rotulo: 'cota', saldoQtd: 50, tipo: 'global' },
      item: { rotulo: 'item', saldoQtd: 50 },
    });
    expect(c.gargalo?.origem).toBe('empenho');
  });
});
