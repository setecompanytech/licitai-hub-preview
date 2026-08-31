import { describe, it, expect } from 'vitest';
import { excessoDeExecucao } from '@/lib/contratos/excesso-de-execucao';

describe('excessoDeExecucao', () => {
  it('dentro do contratado não excede', () => {
    const r = excessoDeExecucao({ inicial: 3600, executado: 3000 });
    expect(r.excede).toBe(false);
    expect(r.providencia).toBe('');
  });

  it('no limite exato não excede', () => {
    expect(excessoDeExecucao({ inicial: 3600, executado: 3600 }).excede).toBe(false);
  });

  it('excesso dentro dos 25% aponta o aditivo como solução', () => {
    // 3.600 → 4.200 é +16,7%, e o art. 125 admite até 25%.
    const r = excessoDeExecucao({ inicial: 3600, executado: 4200 });
    expect(r.excede).toBe(true);
    expect(r.cabeNoArt125).toBe(true);
    expect(r.quanto).toBe(600);
    expect(r.providencia).toContain('Termo Aditivo de Quantidade');
  });

  it('o caso do 149/2024: 66% acima NÃO se resolve com aditivo', () => {
    // 3.600 contratados, 5.997 executados. Mandar pedir aditivo aqui manda a
    // pessoa buscar uma solução que não existe.
    const r = excessoDeExecucao({ inicial: 3600, executado: 5997 });
    expect(r.excede).toBe(true);
    expect(r.cabeNoArt125).toBe(false);
    expect(r.providencia).toContain('NÃO regulariza');
    expect(r.providencia).toContain('unidade');
  });

  it('aditivo anterior consome o teto', () => {
    // Já acresceu 20%; sobram 5%. Um excesso de 10% já não cabe.
    const r = excessoDeExecucao({ inicial: 1000, jaAcrescido: 200, executado: 1300 });
    expect(r.cabeNoArt125).toBe(false);
    expect(r.margemLivre).toBeCloseTo(0.05, 4);
  });

  it('a base é o valor INICIAL, não o já aditivado', () => {
    // Medir sobre o aditivado permitiria acrescer 25% sobre 25%
    // indefinidamente.
    const r = excessoDeExecucao({ inicial: 1000, jaAcrescido: 200, executado: 1250 });
    expect(r.fracao).toBeCloseTo(0.05, 4);   // 50 sobre 1000, não sobre 1200
  });

  it('reforma tem teto de 50%', () => {
    const r = excessoDeExecucao({ inicial: 1000, executado: 1400, limite: 'reforma' });
    expect(r.cabeNoArt125).toBe(true);
    expect(r.margemLivre).toBeCloseTo(0.5, 4);
  });

  it('sem valor inicial não afirma que está dentro', () => {
    // Sem base não há contra o que medir; dizer "não excede" seria afirmar o
    // que não se sabe.
    const r = excessoDeExecucao({ inicial: 0, executado: 5000 });
    expect(r.excede).toBe(false);
    expect(r.frase).toContain('não tem valor inicial');
    expect(r.providencia).toContain('Preencha');
  });

  it('centavo de arredondamento não vira excesso', () => {
    expect(excessoDeExecucao({ inicial: 81180, executado: 81180.00005 }).excede).toBe(false);
  });
});
