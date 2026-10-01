import { describe, it, expect } from 'vitest';
import { janelasDoContrato, janelaDoLancamento, rotuloDaSituacao, diaAnterior } from '../janelas-do-contrato';

/**
 * O 772/2024 (Barcarena) como está no banco em 30/09/2026: 18 itens, 4 termos
 * (reequilíbrio em 12 itens, duas renovações de 67.508 un, reequilíbrio em 4),
 * 36 pedidos (duas notas de 2024, 100 cestas cada) e 13 empenhos.
 */
const T1 = 't1', T2 = 't2', T3 = 't3', T4 = 't4';
const contrato = { data_inicio: '2024-06-12', data_fim: '2027-06-11' };
const termos = [
  { id: T1, numero_aditivo: '1º Termo Aditivo', tipo: 'reequilibrio', data_efeitos: '2025-05-06', valor_acrescimo: 162236.19, quantidade_acrescimo: 0 },
  { id: T2, numero_aditivo: '2º Termo Aditivo', tipo: 'prorrogacao', data_efeitos: '2025-06-11', periodo_inicio: '2025-06-11', periodo_fim: '2026-06-11', valor_acrescimo: 578929.32, quantidade_acrescimo: 67508 },
  { id: T3, numero_aditivo: '3º Termo Aditivo', tipo: 'prorrogacao', data_efeitos: '2026-06-12', periodo_inicio: '2026-06-11', periodo_fim: '2027-06-11', valor_acrescimo: 578929.32, quantidade_acrescimo: 67508 },
  { id: T4, numero_aditivo: '4º Termo Aditivo', tipo: 'reequilibrio', data_efeitos: '2026-08-20', valor_acrescimo: 39516.29, quantidade_acrescimo: 0 },
];
// [código, contratada, original, 1º TA, 4º TA]
const base: Array<[string, number, number, number | null, number | null]> = [
  ['1', 4822, 5.04, 6.81, null], ['2', 4822, 6.5, 8.56, null], ['3', 2411, 5.2, null, null], ['4', 2411, 5.25, 7.15, 8.95],
  ['5', 4822, 8.1, 22.05, null], ['6', 2411, 1.5, null, 3.21], ['7', 4822, 10.8, 14.91, null], ['8', 4822, 8.35, 10.82, null],
  ['9', 4822, 9, null, 13.68], ['10', 4822, 7.8, 9.93, null], ['11', 4822, 4, 5.84, 7.6], ['12', 2411, 3.8, 5.26, null],
  ['13', 2411, 8, 10.57, null], ['14', 2411, 2.25, null, null], ['15', 2411, 2.15, 2.97, null], ['16', 4822, 5.6, null, null],
  ['17', 4822, 6.05, 7.99, null], ['18', 2411, 2.2, null, null],
];
const itens = base.map(([c, q, o, p1, p4]) => ({ id: `i${c}`, codigo_item: c, descricao: `Item ${c}`, quantidade_contratada: q, valor_unitario: p4 ?? p1 ?? o, valor_unitario_original: o }));
const linhas = base.flatMap(([c, q, o, p1, p4]) => {
  const out = [];
  if (p1) out.push({ aditivo_id: T1, contrato_item_id: `i${c}`, valor_unitario_novo: p1, valor_unitario_anterior: o, quantidade_acrescimo: 0, quantidade_supressao: 0, aplicado_em: '2026-09-27' });
  const vig1 = p1 ?? o;
  out.push({ aditivo_id: T2, contrato_item_id: `i${c}`, valor_unitario_novo: null, valor_unitario_anterior: vig1, quantidade_acrescimo: q, quantidade_supressao: 0, aplicado_em: '2026-09-27' });
  out.push({ aditivo_id: T3, contrato_item_id: `i${c}`, valor_unitario_novo: null, valor_unitario_anterior: vig1, quantidade_acrescimo: q, quantidade_supressao: 0, aplicado_em: '2026-09-28' });
  if (p4) out.push({ aditivo_id: T4, contrato_item_id: `i${c}`, valor_unitario_novo: p4, valor_unitario_anterior: vig1, quantidade_acrescimo: 0, quantidade_supressao: 0, aplicado_em: '2026-09-30' });
  return out;
});
// Duas notas de 100 cestas: item de 4.822 leva 2 por cesta, item de 2.411 leva 1.
const pedidos = ['2024-06-28', '2024-10-21'].flatMap((data, k) => base.map(([c, q, o]) => {
  const un = q === 4822 ? 200 : 100;
  return { id: `p${k}-${c}`, contrato_item_id: `i${c}`, quantidade: un, valor_total: Math.round(un * o * 100) / 100, data_pedido: data, origem_aditivo_id: null, status: 'pendente', empenho_id: `e${k}` };
}));
const empenhos = [
  { id: 'e0', numero: '0062352024', quantidade: 2800, valor: 17283, data_emissao: '2024-06-14' },
  { id: 'e1', numero: '0098332024', quantidade: 2800, valor: 17283, data_emissao: '2024-09-11' },
  { id: 'e2', numero: '48202025', quantidade: 8400, valor: 72036, data_emissao: '2025-05-21' },
  { id: 'e3', numero: '62712025', quantidade: 2800, valor: 24012, data_emissao: '2025-06-27' },
  { id: 'e4', numero: '129102025', quantidade: 28000, valor: 240120, data_emissao: '2025-11-27' },
  { id: 'e5', numero: '0884722026', quantidade: 5600, valor: 51302, data_emissao: '2026-08-24' },
];
const HOJE = '2026-09-30';
const visao = () => janelasDoContrato(contrato, termos, linhas, itens, pedidos, empenhos, HOJE);

describe('janelas do contrato — 772/2024', () => {
  it('cada termo abre uma janela de tempo; a renovação abre um período', () => {
    const v = visao();
    expect(v.janelas.map((j) => [j.id, j.inicio, j.fim, j.periodo, j.abrePeriodo])).toEqual([
      ['original', '2024-06-12', '2025-05-05', 0, true],
      [T1, '2025-05-06', '2025-06-10', 0, false],
      [T2, '2025-06-11', '2026-06-10', 1, true],
      [T3, '2026-06-11', '2026-08-19', 2, true],
      [T4, '2026-08-20', '2027-06-11', 2, false],
    ]);
    expect(v.periodos.map((p) => [p.indice, p.encerrado, p.corrente])).toEqual([[0, true, false], [1, true, false], [2, false, true]]);
    expect(v.janelas.find((j) => j.id === T4)?.corrente).toBe(true);
  });

  it('a renovação REPÕE a quantidade: o período corrente tem 67.508, não 196.924', () => {
    const v = visao();
    const acucar = v.porItem.get('i1')!;
    expect(acucar.porJanela.get('original')).toMatchObject({ quantidade: 4822, consumido: 400, saldo: 4422, preco: 5.04, origemPreco: 'contratação' });
    expect(acucar.porJanela.get(T1)).toMatchObject({ quantidade: 4422, consumido: 0, saldo: 4422, preco: 6.81, precoAnterior: 5.04, deltaPct: 35.12, origemPreco: '1º TA', origemQtd: 'Original' });
    expect(acucar.porJanela.get(T2)).toMatchObject({ quantidade: 4822, preco: 6.81, origemQtd: '2º TA', origemPreco: '1º TA', precoMudouAqui: false });
    expect(acucar.porJanela.get(T4)).toMatchObject({ quantidade: 4822, saldo: 4822, preco: 6.81 });
    expect(acucar.vida).toMatchObject({ contratado: 14466, consumido: 400, naoExecutado: 4422 + 4822, saldoCorrente: 4822, precoVigente: 6.81 });
    const saldoCorrente = [...v.porItem.values()].reduce((s, x) => s + x.vida.saldoCorrente, 0);
    expect(saldoCorrente).toBe(67508);
  });

  it('o reequilíbrio vale para o que restava do período, e o 4º TA aplica sobre o 1º', () => {
    const v = visao();
    const biscoito = v.porItem.get('i4')!;
    expect(biscoito.porJanela.get(T1)).toMatchObject({ preco: 7.15, precoAnterior: 5.25, quantidade: 2411 - 200 });
    expect(biscoito.porJanela.get(T4)).toMatchObject({ preco: 8.95, precoAnterior: 7.15, deltaPct: 25.17, origemPreco: '4º TA', origemQtd: '3º TA', quantidade: 2411 });
    expect(rotuloDaSituacao(biscoito.porJanela.get(T4)!)).toBe('Preço: 4º TA · Qtd: 3º TA');
    // O valor do 4º TA = Δ × quantidade do período: bate ao centavo com o termo registrado.
    expect(v.totais.porJanela.get(T4)!.valor).toBe(39516.29);
    // Renovações valem a quantidade reposta ao preço vigente: 578.929,32 cada.
    expect(v.totais.porJanela.get(T2)!.valor).toBe(578929.32);
    expect(v.totais.porJanela.get(T3)!.valor).toBe(578929.32);
    // O 1º TA, sobre o que restava (5.600 já consumidas), fica abaixo do registrado sobre o ano inteiro.
    expect(v.totais.porJanela.get(T1)!.valor).toBe(148778.19);
  });

  it('a conciliação fecha com o Valor Global dentro de 1%', () => {
    const v = visao();
    expect(v.totais.porJanela.get('original')!.valor).toBe(416693.13);
    expect(v.totais.vida.contratadoRS).toBe(1762846.25);
    expect(Math.abs(v.totais.vida.contratadoRS - 1776304.25) / 1776304.25).toBeLessThan(0.01);
    expect(v.totais.vida.executadoRS).toBe(34566);
    expect(v.totais.vida.saldoCorrenteRS).toBe(618445.61);
  });

  it('o empenho reserva por janela: empenhado a faturar, sem baixar item', () => {
    const v = visao();
    expect(v.totais.porJanela.get('original')).toMatchObject({ empenhos: 2, empenhadoRS: 34566, faturadoDosEmpenhosRS: 34566, aFaturarRS: 0 });
    expect(v.totais.porJanela.get(T1)).toMatchObject({ empenhos: 1, empenhadoUn: 8400, aFaturarRS: 72036 });
    expect(v.totais.porJanela.get(T2)).toMatchObject({ empenhos: 2, empenhadoUn: 30800 });
    expect(v.totais.porJanela.get(T4)).toMatchObject({ empenhos: 1, empenhadoUn: 5600, aFaturarRS: 51302 });
    expect(v.totais.vida.empenhadoAFaturarRS).toBe(72036 + 24012 + 240120 + 51302);
  });

  it('o carimbo do termo manda; sem carimbo, a data', () => {
    const v = visao();
    expect(janelaDoLancamento(v.janelas, T2, '2024-06-28').id).toBe(T2);
    expect(janelaDoLancamento(v.janelas, null, '2024-06-28').id).toBe('original');
    expect(janelaDoLancamento(v.janelas, null, '2026-09-01').id).toBe(T4);
    expect(janelaDoLancamento(v.janelas, null, '2020-01-01').id).toBe('original');
    expect(janelaDoLancamento(v.janelas, 'inexistente', '2025-07-01').id).toBe(T2);
  });

  it('o não executado só aparece quando o período encerra pela data', () => {
    const antes = janelasDoContrato(contrato, termos, linhas, itens, pedidos, empenhos, '2025-01-15');
    expect(antes.periodos.map((p) => p.corrente)).toEqual([true, false, false]);
    expect(antes.porItem.get('i1')!.vida).toMatchObject({ naoExecutado: 0, saldoCorrente: 4422 });
  });
});

describe('contrato sem renovação', () => {
  it('um só período, e o acréscimo quantitativo soma dentro dele (comportamento anterior)', () => {
    const v = janelasDoContrato(
      { data_inicio: '2026-01-01', data_fim: '2026-12-31' },
      [{ id: 'a', numero_aditivo: '1º TA', tipo: 'acrescimo', data_efeitos: '2026-05-01', quantidade_acrescimo: 25 }],
      [{ aditivo_id: 'a', contrato_item_id: 'x', valor_unitario_novo: null, valor_unitario_anterior: 10, quantidade_acrescimo: 25, quantidade_supressao: 0, aplicado_em: '2026-05-01' }],
      [{ id: 'x', quantidade_contratada: 100, valor_unitario: 10 }],
      [{ id: 'p', contrato_item_id: 'x', quantidade: 30, valor_total: 300, data_pedido: '2026-03-01', status: 'pendente' }],
      [], '2026-09-30',
    );
    expect(v.periodos).toHaveLength(1);
    expect(v.porItem.get('x')!.porJanela.get('a')).toMatchObject({ quantidade: 95, saldo: 95, valor: 250, origemQtd: 'Original + 1º TA' });
    expect(v.porItem.get('x')!.vida).toMatchObject({ contratado: 125, consumido: 30, saldoCorrente: 95, naoExecutado: 0 });
    expect(v.totais.vida.contratadoRS).toBe(1250);
  });

  it('renovação sem período registrado não abre período (fica como acréscimo, com aviso)', () => {
    const v = janelasDoContrato(
      { data_inicio: '2025-01-01', data_fim: '2026-12-31' },
      [{ id: 'r', numero_aditivo: '1º TA', tipo: 'prorrogacao', data_efeitos: '2026-01-01', quantidade_acrescimo: 100 }],
      [],
      [{ id: 'x', quantidade_contratada: 100, valor_unitario: 10 }],
      [], [], '2026-09-30',
    );
    expect(v.janelas[1]).toMatchObject({ semPeriodo: true, abrePeriodo: false });
    expect(v.porItem.get('x')!.porJanela.get('r')!.quantidade).toBe(200);
  });

  it('dia anterior', () => {
    expect(diaAnterior('2025-06-11')).toBe('2025-06-10');
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28');
  });
});

describe('[layout] rótulos das janelas cabem na coluna Situação', () => {
  it('origem do preço e da quantidade têm no máximo 12 caracteres nos termos do 772', () => {
    const v = janelasDoContrato(contrato, termos, linhas, itens, pedidos, empenhos, HOJE);
    for (const x of v.porItem.values()) {
      for (const cel of x.porJanela.values()) {
        expect(cel.origemPreco.length).toBeLessThanOrEqual(12);
        expect(cel.origemQtd.length).toBeLessThanOrEqual(12);
      }
    }
    for (const j of v.janelas) expect(j.rotuloCurto.length).toBeLessThanOrEqual(12);
  });
});
