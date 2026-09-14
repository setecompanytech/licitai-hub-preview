import { describe, expect, it } from 'vitest';
import {
  calcularVersao,
  chaveDoItem,
  diferencasEntreVersoes,
  multiplicarCentavos,
  paraCentavos,
  type ItemDePrecificacao,
  type PremissasDaVersao,
} from './versao';

/**
 * A versão da precificação é o que vira limite do robô. O que estes casos
 * prendem é o que um erro custaria em dinheiro, não em aparência:
 * centavo que muda entre telas, frete pago duas vezes, percentual inventado
 * onde a política não existe, piso unitário aplicado a disputa por lote.
 *
 * Nenhum número aqui é padrão do produto — são valores de teste.
 */

const informado = { fonte: 'informado_pelo_usuario' as const };

const premissas = (over: Partial<PremissasDaVersao> = {}): PremissasDaVersao => ({
  camadas: { pctImpostos: 19, pctDespesasAdmin: 7, pctDespesasOperacionais: 3, pctMargem: 15 },
  origem: {
    pctImpostos: informado,
    pctDespesasAdmin: informado,
    pctDespesasOperacionais: informado,
    pctMargem: informado,
  },
  criterio: 'menor_preco_item',
  ...over,
});

const item = (over: Partial<ItemDePrecificacao> = {}): ItemDePrecificacao => ({
  licitacaoItemId: 'it-1',
  numero: 1,
  lote: null,
  descricao: 'Item de teste',
  quantidade: 10,
  unidade: 'UN',
  custoUnitario: 100,
  limite: 150,
  ...over,
});

describe('centavos — arredondamento único e explícito', () => {
  it('meio para cima, sem o ruído do ponto flutuante decidir', () => {
    // 1.005 * 100 === 100.49999999999999 em JS; Math.round dá 100.
    expect(paraCentavos(1.005)).toBe(101);
    expect(paraCentavos(2.675)).toBe(268);
    expect(paraCentavos(178.571428)).toBe(17857);
    expect(paraCentavos(-0)).toBe(0);
  });

  it('recusa valor que não é número em vez de gravar NaN', () => {
    expect(() => paraCentavos(Number.NaN)).toThrow(RangeError);
  });

  it('quantidade fracionária multiplica com o mesmo arredondamento', () => {
    expect(multiplicarCentavos(333, 1.5)).toBe(500); // 499,5 → 500
  });
});

describe('preço sugerido e memória de cálculo', () => {
  it('margem sobre a VENDA, pelo divisor — e o acréscimo sobre custo aparece com outro nome', () => {
    const v = calcularVersao([item({ limite: null, autorizado: false })], premissas());
    const c = v.itens[0];
    // 100 ÷ (1 − 0,44) = 178,5714… → R$ 178,57
    expect(c.precoSugeridoCentavos).toBe(17857);
    expect(c.acrescimoSobreCustoPct).toBe(78.57);
    const rotulos = c.memoria.map((l) => l.rotulo);
    expect(rotulos).toContain('Margem sobre a venda');
    expect(rotulos).toContain('Divisor');
    expect(rotulos).toContain('Acréscimo sobre o custo (conferência)');
  });

  it('é determinístico: a mesma entrada dá exatamente a mesma saída', () => {
    const a = calcularVersao([item(), item({ licitacaoItemId: 'it-2', numero: 2, custoUnitario: 3.333 })], premissas());
    const b = calcularVersao([item(), item({ licitacaoItemId: 'it-2', numero: 2, custoUnitario: 3.333 })], premissas());
    expect(b).toEqual(a);
  });

  it('despesas do item entram ANTES do divisor', () => {
    const v = calcularVersao(
      [item({ freteUnitario: 0, seguroUnitario: 2, outrasDespesasUnitario: 3, autorizado: false })],
      premissas(),
    );
    expect(v.itens[0].custoBase).toBe(105);
    expect(v.itens[0].precoSugeridoCentavos).toBe(paraCentavos(105 / 0.56));
  });
});

describe('o que bloqueia a aprovação', () => {
  it('frete no item E despesa operacional percentual é contado duas vezes', () => {
    const v = calcularVersao([item({ freteUnitario: 4 })], premissas());
    expect(v.pendencias.map((p) => p.codigo)).toContain('frete_em_duplicidade');
    expect(v.podeAprovar).toBe(false);
  });

  it('política não configurada bloqueia — sem percentual inventado', () => {
    const p = premissas();
    p.origem.pctDespesasAdmin = { fonte: 'nao_configurado' };
    const v = calcularVersao([item()], p);
    const pendencia = v.pendencias.find((x) => x.codigo === 'politica_pendente');
    expect(pendencia?.mensagem).toMatch(/Despesas administrativas/);
    expect(v.podeAprovar).toBe(false);
  });

  it('custo ausente não vira preço zero', () => {
    const v = calcularVersao([item({ custoUnitario: null })], premissas());
    expect(v.itens[0].precoSugeridoCentavos).toBeNull();
    expect(v.pendencias.map((p) => p.codigo)).toEqual(expect.arrayContaining(['custo_ausente', 'preco_inicial_ausente']));
  });

  it('limite acima do preço inicial é incoerente', () => {
    const v = calcularVersao([item({ precoInicial: 120, limite: 130 })], premissas());
    expect(v.pendencias.map((p) => p.codigo)).toContain('limite_acima_do_inicial');
  });

  it('limite abaixo do ponto de equilíbrio AVISA, em reais, sem bloquear', () => {
    // No limite de R$ 110: saídas 29% = 31,90; 110 − 100 − 31,90 = −21,90
    const v = calcularVersao([item({ precoInicial: 178.57, limite: 110 })], premissas());
    const aviso = v.pendencias.find((p) => p.codigo === 'limite_abaixo_do_equilibrio');
    expect(aviso?.gravidade).toBe('aviso');
    expect(aviso?.mensagem).toMatch(/21,90/);
    expect(v.podeAprovar).toBe(true);
  });

  it('critério não informado ou maior desconto não tem limite em reais aprovável', () => {
    expect(calcularVersao([item()], premissas({ criterio: 'nao_informado' })).podeAprovar).toBe(false);
    const desconto = calcularVersao([item()], premissas({ criterio: 'maior_desconto' }));
    expect(desconto.pendencias.map((p) => p.codigo)).toContain('criterio_nao_suportado');
  });

  it('versão sem nenhum item autorizado não se aprova', () => {
    const v = calcularVersao([item({ autorizado: false })], premissas());
    expect(v.pendencias.map((p) => p.codigo)).toContain('nenhum_item_autorizado');
  });
});

describe('disputa por lote', () => {
  it('o limite do lote é a soma dos limites × quantidades', () => {
    const v = calcularVersao(
      [
        item({ licitacaoItemId: 'a', numero: 1, lote: 'L1', quantidade: 10, precoInicial: 160, limite: 150 }),
        item({ licitacaoItemId: 'b', numero: 2, lote: 'L1', quantidade: 4, precoInicial: 60, limite: 50 }),
      ],
      premissas({ criterio: 'menor_preco_lote' }),
    );
    const l1 = v.lotes.find((l) => l.lote === 'L1');
    expect(l1?.limiteTotalCentavos).toBe(150_000 + 20_000);
    expect(l1?.totalInicialCentavos).toBe(160_000 + 24_000);
  });

  it('lote com item sem limite não tem limite — tem pendência', () => {
    const v = calcularVersao(
      [
        item({ licitacaoItemId: 'a', numero: 1, lote: 'L1', limite: 150 }),
        item({ licitacaoItemId: 'b', numero: 2, lote: 'L1', limite: null }),
      ],
      premissas({ criterio: 'menor_preco_lote' }),
    );
    expect(v.lotes[0].limiteTotalCentavos).toBeNull();
    expect(v.podeAprovar).toBe(false);
  });
});

describe('diferenças entre versões', () => {
  it('compara pelo id estável — reordenar e reescrever descrição não é mudança', () => {
    const a = calcularVersao(
      [item({ licitacaoItemId: 'x', numero: 1 }), item({ licitacaoItemId: 'y', numero: 2 })],
      premissas(),
    ).itens;
    const b = calcularVersao(
      [item({ licitacaoItemId: 'y', numero: 2, descricao: 'Outra redação' }), item({ licitacaoItemId: 'x', numero: 1 })],
      premissas(),
    ).itens;
    expect(diferencasEntreVersoes(a, b)).toEqual([]);
  });

  it('mostra o limite que muda, de onde para onde', () => {
    const a = calcularVersao([item({ limite: 150 })], premissas()).itens;
    const b = calcularVersao([item({ limite: 140 })], premissas()).itens;
    expect(diferencasEntreVersoes(a, b)).toEqual([
      { chave: 'it-1', numero: 1, lote: null, campo: 'limite', de: 15_000, para: 14_000 },
    ]);
  });

  it('sem id, a chave é lote + número — nunca a descrição', () => {
    expect(chaveDoItem({ licitacaoItemId: null, numero: 3, lote: 'L2' })).toBe('lote:L2#item:3');
  });
});
