
import { describe, it, expect } from 'vitest';
import { calcularINSS } from '@/lib/financeiro/inss-irrf-2026';
describe('INSS 2026 — teto e faixas (M13)', () => {
  it('no teto, desconta exatamente o máximo legal (988,09)', () => {
    expect(calcularINSS(10000).total).toBe(988.09);
  });
  it('salário 3.000: soma exata das faixas, um arredondamento só (248,60)', () => {
    // 1621×7,5% + 1281,84×9% + 97,16×12% = 248,5998 → 248,60.
    // Arredondar POR faixa daria 248,61 aqui — e 988,10 no teto, acima do
    // máximo legal publicado: o método que fecha o teto é o exato.
    expect(calcularINSS(3000).total).toBe(248.6);
  });
});
