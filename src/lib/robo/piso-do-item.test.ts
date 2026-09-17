import { describe, expect, it } from 'vitest';
import { pisoUnitarioDoItemUnico } from './piso-do-item';

describe('pisoUnitarioDoItemUnico', () => {
  it('com quantidade 1, o piso do item é o próprio total do cartão', () => {
    expect(pisoUnitarioDoItemUnico(5349106.85, 1)).toBe(5349106.85);
  });

  it('divide o total pela quantidade, em centavos', () => {
    expect(pisoUnitarioDoItemUnico(1100, 100)).toBe(11);
    expect(pisoUnitarioDoItemUnico(1000, 3)).toBe(333.33);
  });

  it('sem total positivo ou sem quantidade, o piso é ausente — nunca zero', () => {
    expect(pisoUnitarioDoItemUnico(0, 1)).toBeNull();
    expect(pisoUnitarioDoItemUnico(null, 1)).toBeNull();
    expect(pisoUnitarioDoItemUnico(1100, 0)).toBeNull();
    expect(pisoUnitarioDoItemUnico('abc', 1)).toBeNull();
  });

  it('aceita o texto do campo, como o diálogo guarda', () => {
    expect(pisoUnitarioDoItemUnico('1176701.6', '1')).toBe(1176701.6);
  });
});
