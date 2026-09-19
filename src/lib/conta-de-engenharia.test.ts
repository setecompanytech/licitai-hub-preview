import { describe, it, expect } from 'vitest';
import { ehContaDeEngenharia } from './conta-de-engenharia';

/** A conta de engenharia (Rafael, 14/09; 19/09/2026): admin da plataforma sem empresa. */
describe('conta-de-engenharia', () => {
  it('admin da plataforma sem empresa é a conta de engenharia', () => {
    expect(ehContaDeEngenharia({ isSystemAdmin: true, totalDeEmpresas: 0 })).toBe(true);
  });

  it('admin da plataforma que está numa empresa não é — a da Santa Rosa na transição', () => {
    expect(ehContaDeEngenharia({ isSystemAdmin: true, totalDeEmpresas: 1 })).toBe(false);
  });

  it('conta comum sem empresa não é: ela ainda pode cadastrar a primeira', () => {
    expect(ehContaDeEngenharia({ isSystemAdmin: false, totalDeEmpresas: 0 })).toBe(false);
  });
});
