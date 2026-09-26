import { describe, it, expect } from 'vitest';
import {
  avisosJuridicos, casarLinhasLidas, errosDasLinhas, fundamentoDoTipo, impactoDaLinha, linhaDaLeitura,
  linhaFoiEditada, linhaSemMudanca, linhasParaGravar, modoDoTipo, numeroDoItem, resumoDoTermo, semelhanca,
  trajetoriaDoPreco, type ItemDoContrato, type LinhaDoTermo, type LinhaLida,
} from '../itens-do-termo';

/**
 * O contrato 772/2024 (Barcarena, cesta básica): 18 itens, 1º TA reequilibra
 * 12 deles. Os dois primeiros itens vieram com o elemento de despesa no
 * código ("3.3.90.32.03"), como a importação os gravou; os demais têm o
 * número do item. As quantidades são as do contrato.
 */
const item = (id: string, codigo: string | null, descricao: string, qtd: number, preco: number): ItemDoContrato =>
  ({ id, codigo_item: codigo, descricao, unidade: 'UNIDADE', valor_unitario: preco, quantidade_contratada: qtd, saldo_quantitativo: qtd, numero_lote: '1' });

const ITENS: ItemDoContrato[] = [
  item('i1', '3.3.90.32.03', 'AÇÚCAR TIPO REFINADO - AÇÚCAR TIPO REFINADO, BRANCO, DE PRIMEIRA QUALIDADE, ORIGEM VEGETAL', 4822, 5.04),
  item('i2', '3.3.90.32.00', 'ARROZ TIPO 01 POLIDO - NÃO PARBOLIZADO, POLIDO, CLASSE LONGO FINO', 4822, 6.50),
  item('i3', '3', 'AVEIA EM FLOCOS GROSSOS 200G – AVEIA BENEFICIADA, CLASSE BRANCA', 2411, 5.20),
  item('i4', '4', 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G - BISCOITO CLASSIFICAÇÃO SALGADA', 2411, 5.25),
  item('i5', '5', 'CAFÉ EM PÓ 250G - CAFÉ EM PÓ, TORRADO E MOÍDO, TIPO TRADICIONAL', 4822, 8.10),
  item('i6', '6', 'COLORÍFICO 100G – CONDIMENTO EM PÓ, CONSTITUÍDO DE MATÉRIA PRIMA DE BOA QUALIDADE', 2411, 1.50),
  item('i7', '7', 'CARNE BOVINA TIPO EM CONSERVA - PESO LÍQUIDO DE 320G. EMBALAGEM: LATA', 4822, 10.80),
  item('i8', '8', 'FARINHA DE MANDIOCA GROSSA - GRUPO: D´ÁGUA, SUBGRUPO: BRANCA, CLASSE: GROSSA', 4822, 8.35),
  item('i9', '9', 'FEIJÃO CARIOCA TIPO 01 - DE PRIMEIRA QUALIDADE, CONSTITUÍDO DE 95% DE GRÃOS INTEIROS', 4822, 9.00),
  item('i10', '10', 'LEITE EM PÓ INTEGRAL 200G - LEITE EM PÓ, ORIGEM: DE VACA, TEOR GORDURA: INTEGRAL', 4822, 7.80),
  item('i11', '11', 'MACARRÃO ESPAGUETE 500G - MACARRÃO COMPRIDO TIPO ESPAGUETE', 4822, 4.00),
  item('i12', '12', 'MARGARINA 250G - MARGARINA A BASE DE ÓLEO VEGETAL COMESTÍVEL', 2411, 3.80),
  item('i13', '13', 'ÓLEO DE SOJA 900ML - PREPARADO A PARTIR DE GRÃOS DE SOJA SÃOS E LIMPOS', 2411, 8.00),
  item('i14', '14', 'PIMENTA E COMINHO 100G – CONDIMENTO TEMPERO MISTO', 2411, 2.25),
  item('i15', '15', 'SAL REFINADO - SAL IODADO REFINADO, EM EMBALAGENS PLÁSTICAS DE 1KG', 2411, 2.15),
  item('i16', '16', 'SALSICHA EM CONSERVA TIPO VIENA 180G – SALSICHA EM CONSERVA, SEM TEMPEROS', 4822, 5.60),
  item('i17', '17', 'SARDINHA ÓLEO LATA 125G - SARDINHA EM CONSERVA, PEIXE EM CONSERVA', 4822, 6.05),
  item('i18', '18', 'SACO TRANSPARENTE - EMBALAGEM PLÁSTICA, FORMA: SACO, LARGURA: 50 CM', 2411, 2.20),
];

const lida = (numero: string, descricao: string, atual: number, novo: number, extra: Partial<LinhaLida> = {}): LinhaLida =>
  ({ numero_item: numero, numero_lote: null, descricao, unidade: 'UNIDADE', quantidade: null, valor_atual: atual, valor_novo: novo, ...extra });

/** O 1º TA, como o documento escreve. */
const PRIMEIRO_TA: LinhaLida[] = [
  lida('1', 'AÇÚCAR TIPO REFINADO - AÇÚCAR TIPO REFINADO, BRANCO, DE PRIMEIRA QUALIDADE', 5.04, 6.81),
  lida('2', 'ARROZ TIPO 01 POLIDO - NÃO PARBOLIZADO, POLIDO, CLASSE LONGO FINO', 6.50, 8.56),
  lida('4', 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G - BISCOITO CLASSIFICAÇÃO SALGADA', 5.25, 7.15),
  lida('5', 'CAFÉ EM PÓ 250G - CAFÉ EM PÓ, TORRADO E MOÍDO, TIPO TRADICIONAL', 8.10, 22.05),
  lida('7', 'CARNE BOVINA TIPO EM CONSERVA - PESO LÍQUIDO DE 320G. EMBALAGEM: LATA', 10.80, 14.91),
  lida('8', 'FARINHA DE MANDIOCA GROSSA - GRUPO: D´ÁGUA, SUBGRUPO: BRANCA', 8.35, 10.82),
  lida('10', 'LEITE EM PÓ INTEGRAL 200G - LEITE EM PÓ, ORIGEM: DE VACA', 7.80, 9.93),
  lida('11', 'MACARRÃO ESPAGUETE 500G - MACARRÃO COMPRIDO TIPO ESPAGUETE', 4.00, 5.84),
  lida('12', 'MARGARINA 250G - MARGARINA A BASE DE ÓLEO VEGETAL COMESTÍVEL', 3.80, 5.26),
  lida('13', 'ÓLEO DE SOJA 900ML - PREPARADO A PARTIR DE GRÃOS DE SOJA SÃOS E LIMPOS', 8.00, 10.57),
  lida('15', 'SAL REFINADO - SAL IODADO REFINADO, EM EMBALAGENS PLÁSTICAS DE 1KG', 2.15, 2.97),
  lida('17', 'SARDINHA ÓLEO LATA 125G - SARDINHA EM CONSERVA, PEIXE EM CONSERVA', 6.05, 7.99),
];

const somaDosImpactos = (linhas: Record<string, LinhaDoTermo>) =>
  ITENS.reduce((s, it) => s + (linhas[it.id] ? impactoDaLinha(linhas[it.id], it).total : 0), 0);

describe('tipo, modo e fundamento', () => {
  it('cada tipo abre a tabela certa, com o artigo certo', () => {
    expect(modoDoTipo('aditivo_reequilibrio')).toBe('preco');
    expect(modoDoTipo('aditivo_quantidade')).toBe('quantidade');
    expect(modoDoTipo('prorrogacao_continuo')).toBe('ambos');
    expect(modoDoTipo('aditivo_prazo')).toBeNull();
    expect(modoDoTipo(null)).toBeNull();
    expect(fundamentoDoTipo('aditivo_reequilibrio')).toMatch(/art\. 124, II, "d"/);
    expect(fundamentoDoTipo('aditivo_prazo')).toMatch(/art\. 111/);
    expect(fundamentoDoTipo('prorrogacao_continuo')).toMatch(/art\. 107/);
    expect(fundamentoDoTipo('aditivo_reajuste')).toMatch(/art\. 136, I/);
    expect(fundamentoDoTipo('desconhecido')).toBeNull();
  });
});

describe('número e semelhança', () => {
  it('só o código numérico curto é número de item', () => {
    expect(numeroDoItem({ codigo_item: '18' })).toBe(18);
    expect(numeroDoItem({ codigo_item: '3.3.90.32.03' })).toBeNull();
    expect(numeroDoItem({ codigo_item: null })).toBeNull();
    expect(numeroDoItem({ codigo_item: '0' })).toBeNull();
  });
  it('semelhança por palavras, sem acento e sem caixa', () => {
    expect(semelhanca('AÇÚCAR TIPO REFINADO', 'acucar tipo refinado')).toBe(1);
    expect(semelhanca('FEIJÃO CARIOCA TIPO 01', 'FARINHA DE MANDIOCA GROSSA')).toBeLessThan(0.35);
    expect(semelhanca('', 'x')).toBe(0);
  });
});

describe('casar as linhas lidas com os itens', () => {
  it('o 1º TA casa os 12 itens: pelo número quando o código é número, pela descrição quando é elemento de despesa', () => {
    const r = casarLinhasLidas(PRIMEIRO_TA, ITENS);
    expect(r.semItem).toHaveLength(0);
    expect(r.casadas).toHaveLength(12);
    const porItem = Object.fromEntries(r.casadas.map((c) => [c.itemId, c]));
    expect(porItem.i1.criterio).toBe('descricao');
    expect(porItem.i2.criterio).toBe('descricao');
    expect(porItem.i4.criterio).toBe('numero');
    expect(porItem.i17.criterio).toBe('numero');
  });
  it('número que a descrição desmente vai para a pessoa decidir, e item disputado fica com a linha mais parecida', () => {
    // O 3º TA repete "FARINHA DE MANDIOCA" no item 9 (erro do documento).
    const linhas = [
      lida('8', 'FARINHA DE MANDIOCA GROSSA - GRUPO: D´ÁGUA, SUBGRUPO: BRANCA, CLASSE: GROSSA', 8.35, 10.82),
      lida('9', 'FARINHA DE MANDIOCA GROSSA - GRUPO: D´ÁGUA, SUBGRUPO: BRANCA', 9.00, 9.00),
    ];
    const r = casarLinhasLidas(linhas, ITENS);
    expect(r.casadas.map((c) => c.itemId)).toEqual(['i8']);
    expect(r.semItem).toHaveLength(1);
    expect(r.semItem[0].numero_item).toBe('9');
  });
  it('lote diferente não casa', () => {
    const r = casarLinhasLidas([lida('4', 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G', 5.25, 7.15, { numero_lote: '2' })], ITENS);
    expect(r.casadas).toHaveLength(0);
    expect(r.semItem).toHaveLength(1);
  });
});

describe('impacto, totais e o que se grava', () => {
  const linhasDo1TA = (): Record<string, LinhaDoTermo> => {
    const r = casarLinhasLidas(PRIMEIRO_TA, ITENS);
    const linhas: Record<string, LinhaDoTermo> = Object.fromEntries(ITENS.map((it) => [it.id, linhaSemMudanca(it)]));
    for (const c of r.casadas) {
      const it = ITENS.find((i) => i.id === c.itemId)!;
      linhas[c.itemId] = linhaDaLeitura(it, c.linha, 'preco');
    }
    return linhas;
  };

  it('o 1º TA sobre as quantidades cheias soma R$ 162.236,19 — e 416.693,13 + 162.236,19 é o valor do 2º TA', () => {
    const linhas = linhasDo1TA();
    expect(Math.round(somaDosImpactos(linhas) * 100) / 100).toBe(162236.19);
    const resumo = resumoDoTermo(linhas, ITENS);
    expect(resumo.itensAlterados).toBe(12);
    expect(resumo.valorAcrescimo).toBe(162236.19);
    expect(resumo.valorSupressao).toBe(0);
    expect(Math.round((416693.13 + resumo.valorAcrescimo) * 100) / 100).toBe(578929.32);
  });

  it('o reequilíbrio vale sobre o SALDO: o café já entregue pela metade impacta a metade', () => {
    const cafe = { ...ITENS[4], saldo_quantitativo: 2411 };
    const linha = { ...linhaSemMudanca(cafe), valor_novo: 22.05 };
    const imp = impactoDaLinha(linha, cafe);
    expect(imp.deltaPreco).toBeCloseTo(13.95, 2);
    expect(imp.variacaoPct).toBeCloseTo(172.22, 1);
    expect(imp.impactoPreco).toBe(33633.45);
  });

  it('o 4º TA reequilibra 4 itens: R$ 39.516,29 sobre as quantidades cheias', () => {
    const quarto = [
      lida('4', 'BISCOITO SALGADO TIPO ÁGUA E SAL 400G', 7.15, 8.95),
      lida('6', 'COLORÍFICO 100G – CONDIMENTO EM PÓ', 1.50, 3.21),
      lida('9', 'FEIJÃO CARIOCA TIPO 01 – DE PRIMEIRA QUALIDADE', 9.00, 13.68),
      lida('11', 'MACARRÃO ESPAGUETE 500G – MACARRÃO COMPRIDO TIPO ESPAGUETE', 5.84, 7.60),
    ];
    // Depois do 1º TA, o biscoito vale 7,15 e o macarrão 5,84.
    const itens = ITENS.map((it) => it.id === 'i4' ? { ...it, valor_unitario: 7.15 } : it.id === 'i11' ? { ...it, valor_unitario: 5.84 } : it);
    const r = casarLinhasLidas(quarto, itens);
    expect(r.semItem).toHaveLength(0);
    const linhas: Record<string, LinhaDoTermo> = Object.fromEntries(itens.map((it) => [it.id, linhaSemMudanca(it)]));
    for (const c of r.casadas) linhas[c.itemId] = linhaDaLeitura(itens.find((i) => i.id === c.itemId)!, c.linha, 'preco');
    expect(resumoDoTermo(linhas, itens).valorAcrescimo).toBe(39516.29);
  });

  it('a renovação repõe as quantidades: 18 itens × quantidade × preço vigente = R$ 578.929,32', () => {
    const precosDo1TA: Record<string, number> = { i1: 6.81, i2: 8.56, i4: 7.15, i5: 22.05, i7: 14.91, i8: 10.82, i10: 9.93, i11: 5.84, i12: 5.26, i13: 10.57, i15: 2.97, i17: 7.99 };
    const itens = ITENS.map((it) => ({ ...it, valor_unitario: precosDo1TA[it.id] ?? it.valor_unitario, saldo_quantitativo: 0 }));
    const linhas: Record<string, LinhaDoTermo> = Object.fromEntries(itens.map((it) => [it.id, {
      ...linhaSemMudanca(it), quantidade_acrescimo: it.quantidade_contratada,
    }]));
    const resumo = resumoDoTermo(linhas, itens);
    expect(resumo.itensAlterados).toBe(18);
    // Dez itens de 4.822 unidades e oito de 2.411, como no contrato.
    expect(resumo.quantidadeAcrescimo).toBe(4822 * 10 + 2411 * 8);
    expect(resumo.valorAcrescimo).toBe(578929.32);
  });

  it('só o que muda vai para o banco, com o lido preservado e "editado" quando a pessoa corrigiu', () => {
    const linhas = linhasDo1TA();
    linhas.i5 = { ...linhas.i5, valor_novo: 22.5 }; // corrigido à mão
    const gravar = linhasParaGravar(linhas, ITENS);
    expect(gravar).toHaveLength(12);
    const cafe = gravar.find((g) => g.contrato_item_id === 'i5')!;
    expect(cafe.valor_unitario_anterior).toBe(8.10);
    expect(cafe.valor_unitario_novo).toBe(22.5);
    expect(cafe.valor_lido).toBe(22.05);
    expect(cafe.editado).toBe(true);
    expect(cafe.origem).toBe('leitura');
    expect(linhaFoiEditada(linhas.i1)).toBe(false);
    expect(gravar.find((g) => g.contrato_item_id === 'i3')).toBeUndefined();
  });

  it('valida: preço zero, supressão além do saldo e quantidade em termo de preço', () => {
    const linhas: Record<string, LinhaDoTermo> = Object.fromEntries(ITENS.map((it) => [it.id, linhaSemMudanca(it)]));
    linhas.i1 = { ...linhas.i1, valor_novo: 0 };
    linhas.i2 = { ...linhas.i2, quantidade_supressao: 5000 };
    linhas.i3 = { ...linhas.i3, quantidade_acrescimo: 10 };
    const erros = errosDasLinhas(linhas, ITENS, 'preco');
    expect(erros.some((e) => /maior que zero/.test(e))).toBe(true);
    expect(erros.some((e) => /supressão maior que o saldo/.test(e))).toBe(true);
    expect(erros.some((e) => /muda preço, não quantidade/.test(e))).toBe(true);
    expect(errosDasLinhas(Object.fromEntries(ITENS.map((it) => [it.id, linhaSemMudanca(it)])), ITENS, 'preco')).toHaveLength(0);
  });
});

describe('avisos jurídicos', () => {
  const resumoVazio = { itensAlterados: 0, valorAcrescimo: 0, valorSupressao: 0, quantidadeAcrescimo: 0, quantidadeSupressao: 0 };
  const base = {
    tipoArquivo: 'aditivo_reequilibrio', dataAssinatura: '2025-05-06', dataEfeitos: '2025-05-06', dataBaseReajuste: null,
    dataInicioContrato: '2024-06-12', dataFimAtual: '2025-06-11', periodoInicio: null, periodoFim: null,
    valorGlobalOriginal: 416693.13, resumo: resumoVazio,
  };

  it('reequilíbrio com quantidade bloqueia; efeitos muito antes da assinatura pedem ressalva (art. 132)', () => {
    const bloqueia = avisosJuridicos({ ...base, resumo: { ...resumoVazio, quantidadeAcrescimo: 10 } });
    expect(bloqueia.some((a) => a.nivel === 'bloqueia' && /art\. 124, I, "b"/.test(a.texto))).toBe(true);
    const ressalva = avisosJuridicos({ ...base, dataEfeitos: '2025-03-01' });
    expect(ressalva.some((a) => a.nivel === 'ressalva' && /art\. 132/.test(a.texto))).toBe(true);
    expect(avisosJuridicos(base)).toHaveLength(0);
  });

  it('reajuste antes de 12 meses da data-base pede ressalva com a lei da periodicidade', () => {
    const avisos = avisosJuridicos({ ...base, tipoArquivo: 'aditivo_reajuste', dataBaseReajuste: '2024-06-12', dataEfeitos: '2025-05-06' });
    expect(avisos.some((a) => a.nivel === 'ressalva' && /10\.192\/2001/.test(a.texto))).toBe(true);
    expect(avisosJuridicos({ ...base, tipoArquivo: 'aditivo_reajuste', dataBaseReajuste: '2024-06-12', dataEfeitos: '2025-06-12' })).toHaveLength(0);
  });

  it('renovação: período descolado informa; além do teto decenal bloqueia (art. 107)', () => {
    const ok = avisosJuridicos({ ...base, tipoArquivo: 'prorrogacao_continuo', periodoInicio: '2025-06-12', periodoFim: '2026-06-11' });
    expect(ok).toHaveLength(0);
    const descolado = avisosJuridicos({ ...base, tipoArquivo: 'prorrogacao_continuo', periodoInicio: '2025-07-01', periodoFim: '2026-06-11' });
    expect(descolado.some((a) => a.nivel === 'info' && /contínua/.test(a.texto))).toBe(true);
    const decenal = avisosJuridicos({ ...base, tipoArquivo: 'prorrogacao_continuo', periodoInicio: '2025-06-12', periodoFim: '2034-07-01' });
    expect(decenal.some((a) => a.nivel === 'bloqueia' && /decenal/.test(a.texto))).toBe(true);
  });

  it('alteração quantitativa acima de 25% pede ressalva (art. 125)', () => {
    const avisos = avisosJuridicos({ ...base, tipoArquivo: 'aditivo_valor_quantidade', resumo: { ...resumoVazio, valorAcrescimo: 120000 } });
    expect(avisos.some((a) => a.nivel === 'ressalva' && /art\. 125/.test(a.texto))).toBe(true);
    expect(avisosJuridicos({ ...base, tipoArquivo: 'aditivo_valor_quantidade', resumo: { ...resumoVazio, valorAcrescimo: 100000 } })).toHaveLength(0);
  });
});

describe('a trajetória do preço', () => {
  it('original → cada termo, com a variação sobre o passo anterior', () => {
    const t = trajetoriaDoPreco(5.25, [
      { rotulo: '1º TA', data: '2025-05-06', valor: 7.15 },
      { rotulo: '4º TA', data: '2026-08-20', valor: 8.95 },
    ]);
    expect(t).toHaveLength(3);
    expect(t[1].variacaoPct).toBeCloseTo(36.19, 1);
    expect(t[2].variacaoPct).toBeCloseTo(25.17, 1);
  });
});
