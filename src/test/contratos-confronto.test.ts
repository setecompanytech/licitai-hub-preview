import { describe, it, expect } from 'vitest';
import { casarItemComAta, confrontarContratoComAta, type ItemDaAta } from '@/lib/contratos/confronto';

// O item real da ATA 022/2024, que originou toda a investigação.
const ATA_ITENS: ItemDaAta[] = [
  {
    id: 'a1',
    codigo_item: '173474-1',
    descricao: 'CARNE MOÍDA DE BOVINO CONGELADA, CORTE PATINHO',
    unidade: 'KG',
    quantidade_contratada: 537600,
    quantidade_ata_consumida: 0,
    valor_unitario: 15.8,
  },
];

const ATA = { valorGlobal: 8494080, valorConsumido: 0, dataFim: '2025-08-13', itens: ATA_ITENS };

describe('casarItemComAta', () => {
  it('código idêntico decide sozinho', () => {
    expect(casarItemComAta({ codigo_item: '173474-1', descricao: 'outra coisa' }, ATA_ITENS)?.id).toBe('a1');
  });

  // O contrato transcreve a ata com abreviações; exigir igualdade desfaria
  // todo par real.
  it('descrição abreviada casa por sobreposição de palavras', () => {
    expect(casarItemComAta({ descricao: 'CARNE MOIDA BOVINA CONGELADA CORTE PATINHO' }, ATA_ITENS)?.id).toBe('a1');
  });

  it('item alheio não casa', () => {
    expect(casarItemComAta({ descricao: 'ARROZ TIPO 1 PACOTE 5KG' }, ATA_ITENS)).toBeNull();
  });
});

describe('confrontarContratoComAta', () => {
  it('fração legítima passa limpa', () => {
    const r = confrontarContratoComAta(
      {
        valorGlobal: 2054000,
        dataAssinatura: '2024-09-01',
        itens: [{ descricao: 'CARNE MOÍDA DE BOVINO CONGELADA', quantidade: 130000, valor_unitario: 15.8 }],
      },
      ATA,
    );
    expect(r.valorExcede).toBe(false);
    expect(r.dentroDaVigencia).toBe(true);
    expect(r.casados).toBe(1);
    expect(r.comProblema).toBe(0);
  });

  it('quantidade acima do saldo do item é acusada', () => {
    const r = confrontarContratoComAta(
      { valorGlobal: 1000, itens: [{ descricao: 'CARNE MOÍDA BOVINA', quantidade: 600000, valor_unitario: 15.8 }] },
      ATA,
    );
    expect(r.itens[0].quantidadeExcede).toBe(true);
    expect(r.comProblema).toBe(1);
  });

  // "Mesmo preço e condições": divergir do registrado é o que o confronto
  // existe para pegar.
  it('preço diferente do registrado diverge; arredondamento de centavo não', () => {
    const caro = confrontarContratoComAta(
      { valorGlobal: 1000, itens: [{ descricao: 'CARNE MOÍDA BOVINA', quantidade: 100, valor_unitario: 16.5 }] },
      ATA,
    );
    expect(caro.itens[0].precoDiverge).toBe(true);

    const arredondado = confrontarContratoComAta(
      { valorGlobal: 1000, itens: [{ descricao: 'CARNE MOÍDA BOVINA', quantidade: 100, valor_unitario: 15.804 }] },
      ATA,
    );
    expect(arredondado.itens[0].precoDiverge).toBe(false);
  });

  it('valor global acima do saldo da ata excede — a rede contra OCR ruim', () => {
    const r = confrontarContratoComAta({ valorGlobal: 180624304, itens: [] }, ATA);
    expect(r.valorExcede).toBe(true);
  });

  it('assinatura depois do fim da ata fica fora da vigência', () => {
    const r = confrontarContratoComAta(
      { valorGlobal: 1000, dataAssinatura: '2025-09-01', itens: [] },
      ATA,
    );
    expect(r.dentroDaVigencia).toBe(false);
  });

  it('sem data de um dos lados, a vigência não é afirmada', () => {
    expect(confrontarContratoComAta({ valorGlobal: 1, itens: [] }, { ...ATA, dataFim: null }).dentroDaVigencia).toBeNull();
  });

  it('item sem par na ata é contado, não inventado', () => {
    const r = confrontarContratoComAta(
      { valorGlobal: 1000, itens: [{ descricao: 'ARROZ TIPO 1', quantidade: 10, valor_unitario: 5 }] },
      ATA,
    );
    expect(r.semPar).toBe(1);
    expect(r.casados).toBe(0);
  });
});
