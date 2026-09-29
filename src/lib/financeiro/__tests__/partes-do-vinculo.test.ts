import { describe, it, expect } from 'vitest';
import { avisoDeVariosItens, diferencaParaANota, fatiasPorPartes, fatiasPorSaldo, partesCompletas, sugerirPartes } from '../partes-do-vinculo';

describe('uma nota, vários itens do contrato', () => {
  it('partes informadas item a item: valor = quantidade × unitário, e a soma tem de fechar com a nota', () => {
    const ids = ['acucar', 'arroz'];
    const partes = [{ contrato_item_id: 'acucar', quantidade: 100, valor_unitario: 5.2 }, { contrato_item_id: 'arroz', quantidade: 50, valor_unitario: 8.56 }];
    expect(partesCompletas(ids, partes)).toBe(true);
    expect(partesCompletas(ids, [partes[0]])).toBe(false);
    expect(partesCompletas(ids, [partes[0], { ...partes[1], quantidade: 0 }])).toBe(false);
    const f = fatiasPorPartes(ids, partes);
    expect(f).toEqual([
      { contrato_item_id: 'acucar', quantidade: 100, valor_unitario: 5.2, valor_total: 520 },
      { contrato_item_id: 'arroz', quantidade: 50, valor_unitario: 8.56, valor_total: 428 },
    ]);
    expect(diferencaParaANota(f, 948)).toEqual({ soma: 948, diferenca: 0, fecha: true });
    expect(diferencaParaANota(f, 1000)).toMatchObject({ diferenca: -52, fecha: false });
  });
  it('rateio por saldo (cota principal + reservada): a última fatia fecha o centavo e o unitário fecha com o par', () => {
    const f = fatiasPorSaldo(['principal', 'reservada'], [75, 25], 11250, 500, 22.55);
    expect(f[0]).toMatchObject({ valor_total: 8437.5, quantidade: 375 });
    expect(f[1]).toMatchObject({ valor_total: 2812.5, quantidade: 125 });
    expect(f[0].valor_unitario * f[0].quantidade).toBeCloseTo(8437.5, 2);
    expect(f[0].valor_total + f[1].valor_total).toBe(11250);
  });
  it('sugestão pelas linhas da nota: casa pela descrição; sem par, quantidade zero e unitário do contrato', () => {
    const marcados = [{ id: 'acucar', descricao: 'AÇÚCAR TIPO REFINADO - AÇÚCAR TIPO REFINADO, BRANCO', valor_unitario: 6.81 }, { id: 'arroz', descricao: 'ARROZ TIPO 01 POLIDO', valor_unitario: 8.56 }, { id: 'aveia', descricao: 'AVEIA EM FLOCOS', valor_unitario: 5.2 }];
    const nota = [{ descricao: 'ARROZ POLIDO TIPO 1 PCT 1KG', quantidade: 200, valor_unitario: 8.5 }, { descricao: 'ACUCAR REFINADO 1KG', quantidade: 100, valor_total: 681 }];
    const s = sugerirPartes(marcados, nota);
    expect(s).toEqual([
      { contrato_item_id: 'acucar', quantidade: 100, valor_unitario: 6.81 },
      { contrato_item_id: 'arroz', quantidade: 200, valor_unitario: 8.5 },
      { contrato_item_id: 'aveia', quantidade: 0, valor_unitario: 5.2 },
    ]);
    // O que a pessoa já digitou não é sobrescrito.
    expect(sugerirPartes(marcados, nota, [{ contrato_item_id: 'aveia', quantidade: 7, valor_unitario: 5 }])[2]).toEqual({ contrato_item_id: 'aveia', quantidade: 7, valor_unitario: 5 });
  });
  it('aviso só a partir do terceiro item', () => {
    expect(avisoDeVariosItens(2)).toBeNull();
    expect(avisoDeVariosItens(18)).toMatch(/18 itens marcados/);
  });
});
