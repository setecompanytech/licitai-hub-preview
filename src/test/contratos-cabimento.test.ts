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
    // Cada espécie é conferida na SUA unidade: o estimativo pelo valor, que é
    // o que ele reservou; o global pela quantidade, que ele empenhou de fato.
    const estimativo = avaliarCabimento({ quantidade: 100, valor: 43 }, {
      empenho: { rotulo: 'empenho', saldoQtd: 10, saldoValor: 10, tipo: 'estimativo' },
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

describe('a espécie do empenho muda a unidade conferida', () => {
  /**
   * O 149/2024: contrato de 3.600 pacotes a R$ 22,55, e a nota estimativa traz
   * "1 pacote". Conferir a entrega contra esse 1 acusaria falta em TODA
   * entrega — e alerta que sempre dispara é alerta que ninguém lê.
   */
  it('estimativo NÃO é conferido por quantidade — a nota traz formalidade', () => {
    const r = avaliarCabimento(
      { quantidade: 300, valor: 6765 },
      {
        empenho: { rotulo: 'empenho 2025NE000064', saldoQtd: 1, saldoValor: 20000, tipo: 'estimativo' },
        item: { rotulo: 'item 1', saldoQtd: 3600 },
        contrato: { saldoValor: 81180 },
      },
    );
    expect(r.cabe).toBe(true);
    // O empenho entra pelo VALOR, que é o que ele de fato reservou.
    const doEmpenho = r.limites.find(l => l.origem === 'empenho')!;
    expect(doEmpenho.unidade).toBe('valor');
    expect(doEmpenho.disponivel).toBe(20000);
  });

  it('estimativo estourado no VALOR avisa, e a providência é reforço', () => {
    const r = avaliarCabimento(
      { quantidade: 1000, valor: 22550 },
      {
        empenho: { rotulo: 'empenho 2025NE000064', saldoQtd: 1, saldoValor: 20000, tipo: 'estimativo' },
        item: { rotulo: 'item 1', saldoQtd: 3600 },
        contrato: { saldoValor: 81180 },
      },
    );
    expect(r.cabe).toBe(false);
    expect(r.gargalo?.origem).toBe('empenho');
    expect(r.gargalo?.providencia).toContain('reforço');
  });

  it('global e ordinário continuam conferidos por quantidade', () => {
    // "100 pacotes" num global são 100 pacotes, e a centésima entrega esgota.
    const r = avaliarCabimento(
      { quantidade: 120, valor: 500 },
      {
        empenho: { rotulo: 'cota principal do empenho', saldoQtd: 100, saldoValor: 99999, tipo: 'global' },
        contrato: { saldoValor: 99999 },
      },
    );
    expect(r.cabe).toBe(false);
    expect(r.gargalo?.unidade).toBe('quantidade');
    expect(r.gargalo?.providencia).toContain('art. 60');
  });

  it('estimativo sem valor registrado não é avaliado — nem liberado, nem barrado', () => {
    const r = avaliarCabimento(
      { quantidade: 300, valor: 6765 },
      {
        empenho: { rotulo: 'empenho', saldoQtd: 1, saldoValor: null, tipo: 'estimativo' },
        item: { rotulo: 'item 1', saldoQtd: 3600 },
      },
    );
    expect(r.limites.find(l => l.origem === 'empenho')).toBeUndefined();
    expect(r.limites.find(l => l.origem === 'item')).toBeTruthy();
  });
});
