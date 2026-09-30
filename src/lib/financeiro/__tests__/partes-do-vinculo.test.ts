import { describe, it, expect } from 'vitest';
import { avisoDeVariosItens, diferencaParaANota, divergenciasDasPartes, fatiasPorPartes, fatiasPorSaldo, linhasDaNfe, ordenarItensDoContrato, partesCompletas, resumoDaUnidadeComposta, rotuloDoItem, semelhancaDaLinha, sugerirPartes, sugerirUnidadesCompostas } from '../partes-do-vinculo';

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
  it('linhas da NF-e viram linhas da nota (descrição, quantidade, unitário, total); linha vazia fica de fora', () => {
    expect(linhasDaNfe([{ x_prod: ' MACARRAO ESPAGUETE 500G ', q_com: 120, v_un_com: 5.84, v_prod: 700.8 }, { x_prod: '', q_com: 0, v_un_com: 0, v_prod: 0 }, null as never]))
      .toEqual([{ descricao: 'MACARRAO ESPAGUETE 500G', quantidade: 120, valor_unitario: 5.84, valor_total: 700.8 }]);
    expect(linhasDaNfe(null)).toEqual([]);
  });
  it('o casamento é pelo melhor par global: o primeiro item não rouba a linha que casa melhor com outro', () => {
    const marcados = [{ id: 'salgado', descricao: 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G', valor_unitario: 7.15 }, { id: 'maisena', descricao: 'BISCOITO DOCE TIPO MAISENA 400G', valor_unitario: 6.1 }];
    const nota = [{ descricao: 'BISCOITO MAISENA 400G', quantidade: 30, valor_unitario: 6 }, { descricao: 'BISCOITO AGUA E SAL 400G', quantidade: 50, valor_unitario: 7 }];
    expect(sugerirPartes(marcados, nota)).toEqual([
      { contrato_item_id: 'salgado', quantidade: 50, valor_unitario: 7 },
      { contrato_item_id: 'maisena', quantidade: 30, valor_unitario: 6 },
    ]);
  });
  it('conferência item a item: unitário contra o preço do PRÓPRIO item, quantidade e valor contra o saldo dele', () => {
    const itens = [
      { id: 'mac', codigo_item: '1', descricao: 'MACARRÃO ESPAGUETE 500G', unidade: 'UN', valor_unitario: 5.84, saldo_quantitativo: 14466, saldo_financeiro: 84481.44 },
      { id: 'oleo', codigo_item: '2', descricao: 'ÓLEO DE SOJA 900ML', unidade: 'UN', valor_unitario: 10.57, saldo_quantitativo: 10, saldo_financeiro: 105.7 },
      { id: 'cafe', codigo_item: '18', descricao: 'CAFÉ EM PÓ 250G', unidade: 'UN', valor_unitario: 22.05, saldo_quantitativo: 100, saldo_financeiro: 2205 },
    ];
    // Preço igual ao contrato: nada a acusar — é o caso da nota correta que saía "+195,94%".
    expect(divergenciasDasPartes(itens, [{ contrato_item_id: 'mac', quantidade: 120, valor_unitario: 5.84 }])).toEqual([]);
    const d = divergenciasDasPartes(itens, [
      { contrato_item_id: 'mac', quantidade: 120, valor_unitario: 5.9 },   // +1,03% → aviso
      { contrato_item_id: 'oleo', quantidade: 12, valor_unitario: 10.57 }, // quantidade e valor acima do saldo
      { contrato_item_id: 'cafe', quantidade: 0, valor_unitario: 30 },     // sem quantidade: ainda não confere
    ]);
    expect(d.map((x) => [x.level, x.titulo])).toEqual([
      ['warning', 'Unitário difere do contrato — Item 1'],
      ['error', 'Quantidade excede o saldo — Item 2'],
      ['error', 'Valor excede o saldo financeiro — Item 2'],
    ]);
    expect(d[0].detalhe).toContain('nota R$ 5,90 · contrato R$ 5,84 · diferença +1.03%');
    expect(divergenciasDasPartes(itens, [{ contrato_item_id: 'cafe', quantidade: 1, valor_unitario: 30 }])[0]).toMatchObject({ level: 'error', titulo: 'Unitário difere do contrato — Item 18' });
  });
  it('itens na ordem numérica do item; sem número, no fim, na ordem em que vieram', () => {
    const ordem = ordenarItensDoContrato([{ codigo_item: '10' }, { codigo_item: null }, { codigo_item: '2' }, { codigo_item: 'x' }, { codigo_item: '1' }]);
    expect(ordem.map((i) => i.codigo_item)).toEqual(['1', '2', '10', null, 'x']);
    expect(rotuloDoItem({ codigo_item: '7' }, 0)).toBe('Item 7');
    expect(rotuloDoItem({ codigo_item: null }, 3)).toBe('Item 4');
  });
  it('cesta básica: nº de cestas sugerido pelas quantidades; preço faturado × contratado por cesta e composição', () => {
    expect(sugerirUnidadesCompostas([{ quantidade: 2000 }, { quantidade: 1000 }, { quantidade: 1000 }])).toBe(1000);
    expect(sugerirUnidadesCompostas([{ quantidade: 1500 }, { quantidade: 1000 }])).toBeNull();
    expect(sugerirUnidadesCompostas([{ quantidade: 1000 }])).toBeNull();
    const fatias = [
      { contrato_item_id: 'mac', quantidade: 2000, valor_unitario: 5.0 },
      { contrato_item_id: 'acucar', quantidade: 1000, valor_unitario: 5.2 },
    ];
    const preco = (id: string) => ({ mac: 5.84, acucar: 6.81 } as Record<string, number>)[id] ?? null;
    expect(resumoDaUnidadeComposta(fatias, preco, 1000)).toEqual({
      unidades: 1000, faturadoPorUnidade: 15.2, contratadoPorUnidade: 18.49, diferencaPct: -17.79,
      composicao: [{ contrato_item_id: 'mac', porUnidade: 2 }, { contrato_item_id: 'acucar', porUnidade: 1 }],
    });
    // Item sem preço de contrato conhecido: o contratado por cesta fica em aberto, o faturado não.
    expect(resumoDaUnidadeComposta(fatias, () => null, 1000)).toMatchObject({ faturadoPorUnidade: 15.2, contratadoPorUnidade: null, diferencaPct: null });
    expect(resumoDaUnidadeComposta(fatias, preco, 0)).toBeNull();
  });
  it('a NF-e 595 do 772/2024, como o emissor escreveu: as 18 linhas abreviadas casam com os 18 itens', () => {
    const itens = [
      ['1', 'AÇÚCAR TIPO REFINADO - AÇÚCAR TIPO REFINADO, BRANCO, DE PRIMEIRA QUALIDADE, EMBALAGEM DE 1KG'],
      ['2', 'ARROZ TIPO 01 POLIDO - NÃO PARBOLIZADO, POLIDO, CLASSE LONGO FINO, PACOTE DE 1KG'],
      ['3', 'AVEIA EM FLOCOS GROSSOS 200G – AVEIA BENEFICIADA, CLASSE BRANCA, EM FLOCOS GROSSOS'],
      ['4', 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G - BISCOITO CLASSIFICAÇÃO SALGADA, APRESENTAÇÃO QUADRADA, SEM RECHEIO'],
      ['5', 'CAFÉ EM PÓ 250G - CAFÉ EM PÓ, TORRADO E MOÍDO, TIPO TRADICIONAL'],
      ['6', 'COLORÍFICO 100G – CONDIMENTO EM PÓ, CONSTITUÍDO DE MATÉRIA PRIMA DE BOA QUALIDADE'],
      ['7', 'CARNE BOVINA TIPO EM CONSERVA - PESO LÍQUIDO DE 320G. EMBALAGEM: LATA'],
      ['8', 'FARINHA DE MANDIOCA GROSSA - GRUPO: D´ÁGUA, SUBGRUPO: BRANCA, CLASSE: GROSSA, EMBALADA EM SACOS PLÁSTICOS DE 1KG'],
      ['9', 'FEIJÃO CARIOCA TIPO 01 - DE PRIMEIRA QUALIDADE, CONSTITUÍDO DE 95% DE GRÃOS INTEIROS, PACOTE 1KG'],
      ['10', 'LEITE EM PÓ INTEGRAL 200G - LEITE EM PÓ, ORIGEM: DE VACA, TEOR GORDURA: INTEGRAL, EMBALADO EM PACOTE DE 200G'],
      ['11', 'MACARRÃO ESPAGUETE 500G - MACARRÃO COMPRIDO TIPO ESPAGUETE, INGREDIENTES: SÊMOLA DE TRIGO ENRIQUECIDA COM FERRO'],
      ['12', 'MARGARINA 250G - MARGARINA A BASE DE ÓLEO VEGETAL COMESTÍVEL, LEITE E SEUS CONSTITUINTES, COM SAL'],
      ['13', 'ÓLEO DE SOJA 900ML - PREPARADO A PARTIR DE GRÃOS DE SOJA SÃOS E LIMPOS, SEM CONSERVANTES'],
      ['14', 'PIMENTA E COMINHO 100G – CONDIMENTO TEMPERO MISTO, CONTENDO PIMENTA DO REINO PRETA E COMINHO, EM PÓ'],
      ['15', 'SAL REFINADO - SAL IODADO REFINADO, EM EMBALAGENS PLÁSTICAS DE 1KG'],
      ['16', 'SALSICHA EM CONSERVA TIPO VIENA 180G - SALSICHA EM CONSERVA, SEM TEMPEROS, ORIGEM CARNE SUÍNA/BOVINA EM LATA'],
      ['17', 'SARDINHA ÓLEO LATA 125G - SARDINHA EM CONSERVA, PEIXE EM CONSERVA, TIPO SARDINHA INTEIRA SEM CABEÇA, ÓLEO COMESTÍVEL'],
      ['18', 'SACO TRANSPARENTE - EMBALAGEM PLÁSTICA, FORMA: SACO, LARGURA: 50 CM, ALTURA: 80 CM, MATERIAL: PLÁSTICO TRANSPARENTE'],
    ].map(([id, descricao]) => ({ id, descricao, valor_unitario: 1 }));
    const linhas = ['ACUC TRIT 1KG', 'ARROZ BCO BOM DE GOSTO T1 1KG', 'AVEIA QUAKER 165G FLOCOS REGULAR', 'BISC CREAM CRACKER TOST 350G', 'CAFE TRADICIONAL VACUO 250G', 'COLORIFICO EM PO', 'FIAMBRE KITUT CARNE BOV 320G', 'FARINHA MAND BCA D PARA FINA 1KG', 'FEIJAO CARIOCA TP1 1KG', 'LEITE PO CAMPONESA INT 200G', 'MAC.ESP.POTY 400G.', 'MARGARINA PRIMOR CSAL 250G', 'OLEO SOJA PET 900ML (20x01)', 'PIMENTA EM GRAO 1KG', 'SAL MOIDO 1KG', 'SALS T VIENA CARIOCA 180G', 'SARDINHA PALMEIRA 75G DREN 125G LIQ OLEO', 'SACO 50X80 30KG(10) BD I E S LISO CENTO']
      .map((descricao, i) => ({ descricao, quantidade: 100 + i, valor_unitario: 2 }));
    const s = sugerirPartes(itens, linhas);
    // Cada item recebe a linha de mesma posição — inclusive o biscoito ("BISC … 350G") e o macarrão ("MAC.ESP.").
    expect(s.map((p) => p.quantidade)).toEqual(linhas.map((l) => l.quantidade));
    expect(semelhancaDaLinha(itens[3].descricao, 'BISC CREAM CRACKER TOST 350G')).toBeGreaterThan(0);
    expect(semelhancaDaLinha(itens[10].descricao, 'MAC.ESP.POTY 400G.')).toBeGreaterThan(semelhancaDaLinha(itens[3].descricao, 'MAC.ESP.POTY 400G.'));
  });
});
