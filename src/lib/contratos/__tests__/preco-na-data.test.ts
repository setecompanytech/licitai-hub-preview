import { describe, it, expect } from 'vitest';
import { dataDoTermo, precoDoItemEm, precosNoTermo, tabelaDePrecosPorTermo } from '../preco-na-data';

const termos = [
  { id: 'ta1', numero_aditivo: '1', data_efeitos: '2024-09-01', data_assinatura: '2024-08-20' },
  { id: 'ta4', numero_aditivo: '4', data_efeitos: null, data_assinatura: '2025-06-10' },
  { id: 'ta2', numero_aditivo: '2', data_efeitos: '2025-01-01' },
];
const passos = [
  { aditivo_id: 'ta1', contrato_item_id: 'acucar', valor_unitario_novo: 6.81, aplicado_em: '2024-08-21T00:00:00Z' },
  { aditivo_id: 'ta4', contrato_item_id: 'acucar', valor_unitario_novo: 8.95, aplicado_em: '2025-06-11T00:00:00Z' },
  { aditivo_id: 'ta4', contrato_item_id: 'arroz', valor_unitario_novo: 9.5, aplicado_em: null }, // não aplicado: não vale
];
const acucar = { id: 'acucar', valor_unitario: 8.95, valor_unitario_original: 5.2 };
const arroz = { id: 'arroz', valor_unitario: 8.56, valor_unitario_original: 8.56 };

describe('preço do item na data do documento', () => {
  it('a data do termo é efeitos, senão assinatura, senão registro', () => {
    expect(dataDoTermo(termos[0])).toBe('2024-09-01');
    expect(dataDoTermo(termos[1])).toBe('2025-06-10');
    expect(dataDoTermo(null)).toBeNull();
  });
  it('nota anterior ao primeiro termo: preço original; depois, o do último termo até a data', () => {
    expect(precoDoItemEm(acucar, termos, passos, { data: '2024-06-28' })).toEqual({ valor: 5.2, origem: 'original', rotulo: 'contrato original', data: '2024-06-28' });
    expect(precoDoItemEm(acucar, termos, passos, { data: '2024-09-01' })).toMatchObject({ valor: 6.81, origem: 'termo', rotulo: '1º TA' });
    expect(precoDoItemEm(acucar, termos, passos, { data: '2025-12-31' })).toMatchObject({ valor: 8.95, rotulo: '4º TA' });
  });
  it('sem data nem termo escolhido: o vigente; termo escolhido à mão manda', () => {
    expect(precoDoItemEm(acucar, termos, passos)).toMatchObject({ valor: 8.95, origem: 'vigente' });
    expect(precoDoItemEm(acucar, termos, passos, { data: '2024-06-28', origemAditivoId: 'ta1' })).toMatchObject({ valor: 6.81, rotulo: '1º TA' });
    // Termo que não mexeu no item: vale o que estava em vigor na data dele.
    expect(precoDoItemEm(acucar, termos, passos, { origemAditivoId: 'ta2' })).toMatchObject({ valor: 6.81, rotulo: '1º TA' });
  });
  it('item sem termo aplicado: original na data; passo não aplicado é ignorado', () => {
    expect(precoDoItemEm(arroz, termos, passos, { data: '2025-12-31' })).toMatchObject({ valor: 8.56, origem: 'original' });
    expect(precoDoItemEm({ id: 'x', valor_unitario: 3, valor_unitario_original: null }, termos, passos, { data: '2024-01-01' })).toMatchObject({ valor: 3, origem: 'vigente' });
  });
  it('tabela por termo: cada coluna é acumulada — o item que o termo não mexeu carrega o preço anterior; Δ em R$ e %', () => {
    // O 772/2024 como o dono descreveu: 1º TA reequilibra (12 itens), 2º e 3º renovam sem mexer em preço, 4º reequilibra 4.
    const t = [
      { id: 't1', numero_aditivo: '1º Termo Aditivo', data_efeitos: '2025-05-06' },
      { id: 't2', numero_aditivo: '2º Termo Aditivo', data_efeitos: '2025-06-11' },
      { id: 't3', numero_aditivo: '3º Termo Aditivo', data_efeitos: '2026-06-12' },
      { id: 't4', numero_aditivo: '4º Termo Aditivo', data_efeitos: '2026-08-20' },
    ];
    const itens = [
      { id: 'i4', codigo_item: '4', descricao: 'BISCOITO', valor_unitario: 8.95, valor_unitario_original: 5.25 },
      { id: 'i6', codigo_item: '6', descricao: 'COLORÍFICO', valor_unitario: 3.21, valor_unitario_original: 1.5 },
      { id: 'i3', codigo_item: '3', descricao: 'AVEIA', valor_unitario: 5.2, valor_unitario_original: null },
    ];
    const p = [
      { aditivo_id: 't1', contrato_item_id: 'i4', valor_unitario_novo: 7.15, aplicado_em: 'x' },
      { aditivo_id: 't4', contrato_item_id: 'i4', valor_unitario_novo: 8.95, aplicado_em: 'x' },
      { aditivo_id: 't4', contrato_item_id: 'i6', valor_unitario_novo: 3.21, aplicado_em: 'x' },
    ];
    const { colunas, linhas } = tabelaDePrecosPorTermo(itens, t, p);
    expect(colunas.map((c) => [c.rotulo, c.itensAlterados])).toEqual([['1º TA', 1], ['2º TA', 0], ['3º TA', 0], ['4º TA', 2]]);
    const bisc = linhas.find((l) => l.codigo_item === '4')!;
    expect(bisc.original).toBe(5.25);
    expect(bisc.porTermo.map((c) => [c.valor, c.mudou, c.deltaReais, c.deltaPct])).toEqual([
      [7.15, true, 1.9, 36.19], [7.15, false, 0, 0], [7.15, false, 0, 0], [8.95, true, 1.8, 25.17],
    ]);
    const aveia = linhas.find((l) => l.codigo_item === '3')!;
    expect(aveia.original).toBe(5.2);
    expect(aveia.porTermo.every((c) => c.valor === 5.2 && !c.mudou)).toBe(true);
    // A coluna do termo escolhido, item a item; nulo = contrato original.
    expect(precosNoTermo(itens, t, p, 't2').get('i4')).toBe(7.15);
    expect(precosNoTermo(itens, t, p, 't4').get('i6')).toBe(3.21);
    expect(precosNoTermo(itens, t, p, null).get('i4')).toBe(5.25);
  });
});
