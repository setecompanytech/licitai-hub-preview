import { describe, it, expect } from 'vitest';
import { ehMeu, noEscopo, responsavelDe } from '../escopoProprio';

const EU = 'user-eu';
const COLEGA = 'user-colega';

describe('escopo próprio', () => {
  it('vendedor atribuído manda, mesmo em registro criado por outro', () => {
    expect(ehMeu({ vendedor_user_id: EU, user_id: COLEGA }, EU)).toBe(true);
    expect(ehMeu({ vendedor_user_id: COLEGA, user_id: EU }, EU)).toBe(false);
  });

  it('sem vendedor, o criador responde — senão o registro antigo sumiria para todos', () => {
    expect(ehMeu({ vendedor_user_id: null, user_id: EU }, EU)).toBe(true);
    expect(ehMeu({ vendedor_user_id: '  ', user_id: EU }, EU)).toBe(true);
  });

  it('sem sessão, nada é meu', () => {
    expect(ehMeu({ user_id: EU }, null)).toBe(false);
  });

  it('escopo "todos" não filtra e escopo por colaborador usa o responsável efetivo', () => {
    const lista = [
      { id: 1, vendedor_user_id: EU, user_id: COLEGA },
      { id: 2, vendedor_user_id: null, user_id: COLEGA },
    ];
    expect(noEscopo(lista, 'todos', EU)).toHaveLength(2);
    expect(noEscopo(lista, 'meus', EU).map((r) => r.id)).toEqual([1]);
    expect(noEscopo(lista, COLEGA, EU).map((r) => r.id)).toEqual([2]);
  });

  it('responsável efetivo cai no criador enquanto ninguém for atribuído', () => {
    expect(responsavelDe({ vendedor_user_id: null, user_id: COLEGA })).toBe(COLEGA);
    expect(responsavelDe({ vendedor_user_id: EU, user_id: COLEGA })).toBe(EU);
  });
});
