import { describe, it, expect } from 'vitest';
import { filtrarColaboradoresDoPainel, nomeDoColaborador } from '@/lib/metas/colaboradores';

/** Espelha o que veio do banco em 09/08/2026: 2 do comercial e 7 admins. */
const MEMBROS = [
  { user_id: 'giovanny', equipe: 'comercial', nome: 'Giovanny Valente' },
  { user_id: 'setor',    equipe: 'comercial', nome: 'Setor Comercial' },
  { user_id: 'rubens',   equipe: 'financeiro', nome: 'Rubens Teste' },
  { user_id: 'admin-1',  equipe: 'geral', nome: null },
  { user_id: 'admin-2',  equipe: 'geral', nome: null },
  { user_id: 'admin-3',  equipe: 'geral', nome: null },
];

describe('filtrarColaboradoresDoPainel', () => {
  it('mantém apenas quem é do comercial quando ninguém tem meta', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS);
    expect(r.map((m) => m.user_id)).toEqual(['giovanny', 'setor']);
  });

  it('elimina os admins sem nome, que viravam cards vazios', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS);
    expect(r.some((m) => m.nome === null)).toBe(false);
  });

  it('inclui quem tem meta mesmo fora do comercial', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS, ['rubens']);
    expect(r.map((m) => m.user_id)).toEqual(['giovanny', 'setor', 'rubens']);
  });

  it('não duplica quem é do comercial e também tem meta', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS, ['giovanny']);
    expect(r.filter((m) => m.user_id === 'giovanny')).toHaveLength(1);
  });

  it('aceita Set além de array, sem reconstruir', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS, new Set(['admin-2']));
    expect(r.map((m) => m.user_id)).toContain('admin-2');
  });

  it('equipe nula não entra por acidente', () => {
    const r = filtrarColaboradoresDoPainel([{ user_id: 'x', equipe: null }]);
    expect(r).toEqual([]);
  });

  it('lista vazia devolve lista vazia', () => {
    expect(filtrarColaboradoresDoPainel([])).toEqual([]);
  });

  it('preserva a ordem recebida', () => {
    const r = filtrarColaboradoresDoPainel(MEMBROS, ['rubens', 'admin-3']);
    expect(r.map((m) => m.user_id)).toEqual(['giovanny', 'setor', 'rubens', 'admin-3']);
  });
});

describe('nomeDoColaborador', () => {
  it('usa o nome quando existe', () => {
    expect(nomeDoColaborador({ nome: 'Giovanny', email: 'g@x.com' })).toBe('Giovanny');
  });

  it('cai no e-mail quando o nome falta', () => {
    expect(nomeDoColaborador({ nome: null, email: 'g@x.com' })).toBe('g@x.com');
  });

  it('nome só de espaços não conta como nome', () => {
    expect(nomeDoColaborador({ nome: '   ', email: 'g@x.com' })).toBe('g@x.com');
  });

  it('sem nome e sem e-mail, rotula explicitamente', () => {
    expect(nomeDoColaborador({ nome: null, email: null })).toBe('Sem nome');
  });
});
