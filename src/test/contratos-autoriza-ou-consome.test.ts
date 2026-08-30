import { describe, it, expect } from 'vitest';
import {
  oQueODocumentoCria,
  especieComOrigem,
  atribuirCotas,
} from '@/lib/contratos/autoriza-ou-consome';

describe('oQueODocumentoCria', () => {
  it('nota de empenho autoriza — cria empenho, não pedido', () => {
    expect(oQueODocumentoCria('empenho_ordinario')).toBe('empenho');
    expect(oQueODocumentoCria('empenho_global')).toBe('empenho');
    expect(oQueODocumentoCria('empenho_estimativo')).toBe('empenho');
    expect(oQueODocumentoCria('nota_empenho')).toBe('empenho');
  });

  it('ordem de fornecimento consome — cria pedido', () => {
    expect(oQueODocumentoCria('ordem_fornecimento')).toBe('pedido');
    expect(oQueODocumentoCria('prd')).toBe('pedido');
    expect(oQueODocumentoCria('outro')).toBe('pedido');
  });

  it('sem tipo, o padrão é pedido — que é o que a tela sempre fez', () => {
    expect(oQueODocumentoCria(null)).toBe('pedido');
    expect(oQueODocumentoCria('')).toBe('pedido');
  });
});

describe('especieComOrigem', () => {
  it('espécie rotulada na nota é fato, e vem com o trecho', () => {
    const r = especieComOrigem({
      especieDoDocumento: 'global',
      trecho: 'ESPÉCIE DE EMPENHO: GLOBAL',
      escolhaManual: 'ordinario',
    });
    expect(r).toEqual({
      tipo: 'global',
      origem: 'documento',
      trecho: 'ESPÉCIE DE EMPENHO: GLOBAL',
    });
  });

  it('sem rótulo no documento, a escolha da tela vale — e fica marcada como manual', () => {
    const r = especieComOrigem({
      especieDoDocumento: null,
      escolhaManual: 'empenho_ordinario',
    });
    expect(r).toEqual({ tipo: 'ordinario', origem: 'manual', trecho: null });
  });

  it('sem documento e sem escolha, falta escolher — não grava', () => {
    expect(especieComOrigem({}).origem).toBe('nao_informada');
    expect(especieComOrigem({ escolhaManual: 'ordem_fornecimento' }).tipo).toBeNull();
  });
});

describe('atribuirCotas', () => {
  it('rótulo do documento manda', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', cota: 'COTA PRINCIPAL', valorTotal: 131580 },
      { descricao: 'ÁGUA MINERAL 500ML', cota: 'Cota Reservada', valorTotal: 43860 },
    ]);
    expect(r).toEqual([
      { cota: 'principal', origem: 'documento' },
      { cota: 'reservada', origem: 'documento' },
    ]);
  });

  it('"ampla concorrência" é a principal', () => {
    const r = atribuirCotas([
      { descricao: 'CARNE MOÍDA', cota: 'AMPLA CONCORRÊNCIA', valorTotal: 100 },
      { descricao: 'CARNE MOÍDA', cota: 'RESERVADA ME/EPP', valorTotal: 30 },
    ]);
    expect(r.map(c => c.cota)).toEqual(['principal', 'reservada']);
  });

  it('linha sem rótulo num documento que rotula as outras fica indefinida', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA', cota: 'COTA PRINCIPAL', valorTotal: 100 },
      { descricao: 'COPO', cota: null, valorTotal: 30 },
    ]);
    expect(r[0]).toEqual({ cota: 'principal', origem: 'documento' });
    expect(r[1]).toEqual({ cota: null, origem: 'indefinida' });
  });

  it('duas linhas do mesmo produto em 75/25 sem rótulo: a menor é a reservada', () => {
    // O 008/2026, ao centavo.
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL NATURAL 500ML', valorTotal: 131580 },
      { descricao: 'ÁGUA MINERAL NATURAL 500ML', valorTotal: 43860 },
    ]);
    expect(r).toEqual([
      { cota: 'principal', origem: 'proporcao' },
      { cota: 'reservada', origem: 'proporcao' },
    ]);
  });

  it('a ordem das linhas não decide — o valor decide', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 43860 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 131580 },
    ]);
    expect(r.map(c => c.cota)).toEqual(['reservada', 'principal']);
  });

  it('50/50 não é cota: são duas entregas', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 1000 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 1000 },
    ]);
    expect(r.every(c => c.cota === null)).toBe(true);
  });

  it('acima de 25% não é cota reservada válida — o art. 48, III não admite', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 700 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 300 },
    ]);
    expect(r.every(c => c.origem === 'indefinida')).toBe(true);
  });

  it('produtos diferentes não são cota, mesmo em 75/25', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 750 },
      { descricao: 'CAFÉ EM PÓ 250G', valorTotal: 250 },
    ]);
    expect(r.every(c => c.cota === null)).toBe(true);
  });

  it('uma linha só não tem cota a deduzir', () => {
    expect(atribuirCotas([{ descricao: 'ÁGUA', valorTotal: 1000 }]))
      .toEqual([{ cota: null, origem: 'indefinida' }]);
  });

  it('três linhas sem rótulo não se dividem em duas cotas', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 500 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 300 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 200 },
    ]);
    expect(r.every(c => c.origem === 'indefinida')).toBe(true);
  });

  it('valor zerado não deduz nada', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 0 },
      { descricao: 'ÁGUA MINERAL 500ML', valorTotal: 0 },
    ]);
    expect(r.every(c => c.cota === null)).toBe(true);
  });

  it('o mesmo produto com sufixo diferente ainda é o mesmo produto', () => {
    const r = atribuirCotas([
      { descricao: 'ÁGUA MINERAL NATURAL 500ML - COTA A', valorTotal: 131580 },
      { descricao: 'ÁGUA MINERAL NATURAL 500ML', valorTotal: 43860 },
    ]);
    expect(r.map(c => c.cota)).toEqual(['principal', 'reservada']);
  });
});
