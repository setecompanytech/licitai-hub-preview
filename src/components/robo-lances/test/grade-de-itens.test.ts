import { describe, it, expect } from 'vitest';
import {
  avisosDaGrade,
  estrategiaUnicaDe,
  estrategiasDoItem,
  modoTemLanceFinalFechado,
  nomesDasEstrategias,
} from '@/lib/robo/estrategia-do-item';

describe('modoTemLanceFinalFechado — quando a grade mostra o campo do lance final', () => {
  it('só o modo aberto e fechado tem lance final fechado', () => {
    expect(modoTemLanceFinalFechado('Aberto e Fechado')).toBe(true);
    expect(modoTemLanceFinalFechado('ABERTO-FECHADO')).toBe(true);
    expect(modoTemLanceFinalFechado('Aberto')).toBe(false); // o 7/2026
    expect(modoTemLanceFinalFechado('Fechado e Aberto')).toBe(false);
  });

  it('modo desconhecido mostra o campo: esconder seria decidir pela empresa', () => {
    expect(modoTemLanceFinalFechado(null)).toBe(true);
    expect(modoTemLanceFinalFechado(undefined)).toBe(true);
    expect(modoTemLanceFinalFechado('  ')).toBe(true);
  });
});

describe('avisosDaGrade', () => {
  it('conta piso, margem, iminência no Compras.gov e lance final abaixo do piso', () => {
    const a = avisosDaGrade({
      itens: [
        { valorMinimo: null, estrategia: 'melhor_preco' },
        { valorMinimo: 100, estrategia: 'desempatar_1o', margemDesempate: null },
        { valorMinimo: 100, estrategia: 'iminencia' },
        { valorMinimo: 100, estrategia: 'melhor_preco', lanceFinalFechado: 90 },
        { valorMinimo: 100, estrategia: 'melhor_preco', lanceFinalFechado: 120 },
      ],
      pisoGeral: null,
      ehComprasGov: true,
    });
    expect(a).toEqual({ semPiso: 1, semEstrategia: 0, semMargem: 1, iminenciaSemTempo: 1, lanceFinalAbaixoDoPiso: 1 });
  });

  it('iminência fora do Compras.gov não avisa', () => {
    const a = avisosDaGrade({ itens: [{ valorMinimo: 100, estrategia: 'iminencia' }], pisoGeral: null, ehComprasGov: false });
    expect(a.iminenciaSemTempo).toBe(0);
  });

  it('o piso geral cobre o item sem piso, também para o lance final', () => {
    const a = avisosDaGrade({
      itens: [{ valorMinimo: null, estrategia: 'melhor_preco', lanceFinalFechado: 40 }],
      pisoGeral: 50,
      ehComprasGov: true,
    });
    expect(a.semPiso).toBe(0);
    expect(a.lanceFinalAbaixoDoPiso).toBe(1);
  });

  it('grade limpa: nada a avisar', () => {
    const a = avisosDaGrade({
      itens: [{ valorMinimo: 100, estrategia: 'melhor_preco', lanceFinalFechado: 110 }],
      pisoGeral: null,
      ehComprasGov: true,
    });
    expect(a).toEqual({ semPiso: 0, semEstrategia: 0, semMargem: 0, iminenciaSemTempo: 0, lanceFinalAbaixoDoPiso: 0 });
  });
});

describe('estratégias cumulativas na grade (Rafael, 17/09)', () => {
  it('lê a lista, cai no formato de antes, e nada escolhido é melhor preço', () => {
    expect(estrategiasDoItem({ estrategias: ['desempatar_1o', 'iminencia'] })).toEqual(['iminencia', 'desempatar_1o']);
    expect(estrategiasDoItem({ estrategia: 'iminencia' })).toEqual(['iminencia']);
    expect(estrategiasDoItem({})).toEqual(['melhor_preco']);
    expect(estrategiasDoItem({ estrategias: [] })).toEqual([]);
  });

  it('a estratégia única gravada junto é a mais ampla marcada', () => {
    expect(estrategiaUnicaDe(['iminencia', 'desempatar_1o'])).toBe('iminencia');
    expect(estrategiaUnicaDe(['melhor_preco', 'desempatar_1o'])).toBe('melhor_preco');
    expect(estrategiaUnicaDe([])).toBeUndefined();
  });

  it('nomes para leitura', () => {
    expect(nomesDasEstrategias(['melhor_preco', 'iminencia'])).toBe('Melhor preço + Iminência');
    expect(nomesDasEstrategias([])).toBe('Nenhuma estratégia');
  });

  it('avisos: sem estratégia, margem com desempate marcado e iminência sem melhor preço', () => {
    const a = avisosDaGrade({
      itens: [
        { valorMinimo: 10, estrategias: [] },
        { valorMinimo: 10, estrategias: ['melhor_preco', 'desempatar_1o'], margemDesempate: null },
        { valorMinimo: 10, estrategias: ['melhor_preco', 'iminencia'] },
        { valorMinimo: 10, estrategias: ['iminencia', 'desempatar_1o'], margemDesempate: 5 },
      ],
      pisoGeral: null,
      ehComprasGov: true,
    });
    expect(a.semEstrategia).toBe(1);
    expect(a.semMargem).toBe(1);
    expect(a.iminenciaSemTempo).toBe(1);
  });
});
