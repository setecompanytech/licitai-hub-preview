import { describe, it, expect } from 'vitest';
import { CFOPS, buscarCfop, formatarCfop } from '@/data/cfop';

describe('tabela CFOP', () => {
  it('carrega a tabela inteira, sem código malformado nem duplicado', () => {
    expect(CFOPS.length).toBeGreaterThan(480);
    const codigos = new Set<string>();
    for (const c of CFOPS) {
      expect(c.codigo).toMatch(/^\d{4}$/);
      expect(c.descricao.length).toBeGreaterThan(5);
      expect(codigos.has(c.codigo)).toBe(false);
      codigos.add(c.codigo);
    }
  });

  it('formata na grafia oficial', () => {
    expect(formatarCfop('5102')).toBe('5.102');
    expect(formatarCfop('1101')).toBe('1.101');
  });
});

describe('buscarCfop — o afunilamento progressivo do pedido do dono', () => {
  it('"5.1" lista os prováveis 5.1xx', () => {
    const r = buscarCfop('5.1');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every(c => c.codigo.startsWith('51'))).toBe(true);
    expect(r.some(c => c.codigo === '5102')).toBe(true);
  });

  it('cada dígito a mais encurta a lista', () => {
    const larga = buscarCfop('5.1', 100);
    const media = buscarCfop('5.10', 100);
    const exata = buscarCfop('5.102', 100);
    expect(media.length).toBeLessThan(larga.length);
    expect(exata.length).toBe(1);
    expect(exata[0].descricao).toBe('Venda de mercadoria adquirida ou recebida de terceiros');
  });

  it('pontuação e espaço não atrapalham: "5 1", "5.1" e "51" são o mesmo prefixo', () => {
    expect(buscarCfop('5 1', 100)).toEqual(buscarCfop('5.1', 100));
    expect(buscarCfop('51', 100)).toEqual(buscarCfop('5.1', 100));
  });

  it('sem dígito, busca na descrição ignorando acento', () => {
    const r = buscarCfop('bonificacao', 100);
    expect(r.map(c => c.codigo)).toEqual(expect.arrayContaining(['1910', '2910', '5910', '6910']));
  });

  it('vazio não sugere nada — lista inteira sem filtro é ruído', () => {
    expect(buscarCfop('')).toEqual([]);
  });
});
