import { describe, it, expect } from 'vitest';
import { quantidadeConfiavel } from '@/lib/financeiro/quantidade-da-nota';

describe('quantidadeConfiavel', () => {
  it('o caso real: IA devolveu 1 para uma nota de 1.300 — rejeitado', () => {
    // VU implícito seria R$ 29.315/un num contrato de R$ 22,55: 1.300× fora.
    expect(quantidadeConfiavel({ qtdLida: 1, valorTotal: 29315, vuReferencia: 22.55 })).toBeNull();
  });

  it('quantidade certa passa — VU implícito bate com a referência', () => {
    expect(quantidadeConfiavel({ qtdLida: 1300, valorTotal: 29315, vuReferencia: 22.55 })).toBe(1300);
  });

  it('desconto e reajuste cabem na folga de 5×', () => {
    // Nota a 22,50 num contrato de 22,55 — o caso das duplicatas.
    expect(quantidadeConfiavel({ qtdLida: 500, valorTotal: 11250, vuReferencia: 22.55 })).toBe(500);
    // Reajuste forte, ainda plausível.
    expect(quantidadeConfiavel({ qtdLida: 100, valorTotal: 4510, vuReferencia: 22.55 })).toBe(100);
  });

  it('sem referência de preço, a leitura vale como veio — sem motivo, não se descarta', () => {
    expect(quantidadeConfiavel({ qtdLida: 1, valorTotal: 29315, vuReferencia: null })).toBe(1);
  });

  it('quantidade ausente ou zero devolve null', () => {
    expect(quantidadeConfiavel({ qtdLida: 0, valorTotal: 100, vuReferencia: 10 })).toBeNull();
    expect(quantidadeConfiavel({ qtdLida: null, valorTotal: 100, vuReferencia: 10 })).toBeNull();
  });

  it('VU implícito minúsculo também é lixo — quantidade superlida', () => {
    // Leu 130.000 onde era 1.300: VU implícito de R$ 0,22 num contrato de 22,55.
    expect(quantidadeConfiavel({ qtdLida: 130000, valorTotal: 29315, vuReferencia: 22.55 })).toBeNull();
  });
});
