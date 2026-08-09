import { describe, it, expect } from 'vitest';
import {
  derivarAbrangencia, normalizarFeriado, atingeAlgumaPraca,
} from '@/lib/metas/feriados';

describe('derivarAbrangencia', () => {
  it('sem UF é nacional', () => {
    expect(derivarAbrangencia(null, null)).toBe('nacional');
    expect(derivarAbrangencia('', '')).toBe('nacional');
  });

  it('com UF e sem município é estadual', () => {
    expect(derivarAbrangencia('RS', null)).toBe('estadual');
  });

  it('com UF e município é municipal', () => {
    expect(derivarAbrangencia('RS', 'Santa Rosa')).toBe('municipal');
  });

  it('município sem UF não vira municipal — nacional não tem praça', () => {
    expect(derivarAbrangencia(null, 'Santa Rosa')).toBe('nacional');
  });
});

describe('normalizarFeriado', () => {
  it('põe a UF em maiúsculas e apara a descrição', () => {
    const f = normalizarFeriado({ data: '2026-09-07', descricao: '  Independência  ', uf: 'rs' });
    expect(f.uf).toBe('RS');
    expect(f.descricao).toBe('Independência');
    expect(f.abrangencia).toBe('estadual');
  });

  it('descarta município quando não há UF', () => {
    const f = normalizarFeriado({ data: '2026-09-07', descricao: 'X', uf: null, municipio: 'Santa Rosa' });
    expect(f.municipio).toBeNull();
    expect(f.abrangencia).toBe('nacional');
  });

  it('descarta UF malformada e o município que dependia dela', () => {
    const f = normalizarFeriado({ data: '2026-09-07', descricao: 'X', uf: 'R1', municipio: 'Santa Rosa' });
    expect(f.uf).toBeNull();
    expect(f.municipio).toBeNull();
    expect(f.abrangencia).toBe('nacional');
  });

  it('município só de espaços vira nulo, e a abrangência cai para estadual', () => {
    const f = normalizarFeriado({ data: '2026-09-07', descricao: 'X', uf: 'RS', municipio: '   ' });
    expect(f.municipio).toBeNull();
    expect(f.abrangencia).toBe('estadual');
  });

  it('preserva o município digitado, sem achatar a grafia do usuário', () => {
    const f = normalizarFeriado({ data: '2026-09-07', descricao: 'X', uf: 'RS', municipio: 'Santa Rosa' });
    expect(f.municipio).toBe('Santa Rosa');
  });
});

describe('atingeAlgumaPraca', () => {
  const pracas = [
    { praca_uf: 'RS', praca_municipio: 'Santa Rosa' },
    { praca_uf: 'SP', praca_municipio: null },
  ];

  it('nacional atinge todo mundo, inclusive sem praça alguma', () => {
    expect(atingeAlgumaPraca({ uf: null, municipio: null }, [])).toBe(true);
  });

  it('estadual atinge quem tem praça na UF', () => {
    expect(atingeAlgumaPraca({ uf: 'SP', municipio: null }, pracas)).toBe(true);
    expect(atingeAlgumaPraca({ uf: 'RS', municipio: null }, pracas)).toBe(true);
  });

  it('estadual de UF sem colaborador não atinge ninguém', () => {
    expect(atingeAlgumaPraca({ uf: 'AC', municipio: null }, pracas)).toBe(false);
  });

  it('municipal compara pela forma normalizada — grafia não pode fazer falhar', () => {
    expect(atingeAlgumaPraca({ uf: 'RS', municipio: 'SANTA ROSA ' }, pracas)).toBe(true);
    expect(atingeAlgumaPraca({ uf: 'RS', municipio: 'santa  rosa' }, pracas)).toBe(true);
  });

  it('municipal não atinge colaborador que só tem UF', () => {
    expect(atingeAlgumaPraca({ uf: 'SP', municipio: 'Campinas' }, pracas)).toBe(false);
  });

  it('municipal de cidade sem colaborador não atinge ninguém', () => {
    expect(atingeAlgumaPraca({ uf: 'RS', municipio: 'Ijuí' }, pracas)).toBe(false);
  });
});
