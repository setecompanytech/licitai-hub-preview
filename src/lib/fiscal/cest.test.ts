import { describe, it, expect } from 'vitest';
import { CEST_CODES, SEGMENTOS_CEST } from '@/data/cest-codes';
import { avaliarCest, buscarCest, cestCombinaComNcm, cestsParaNcm, formatarCest } from './cest';

describe('tabela CEST do Convênio ICMS 142/18', () => {
  it('tem os segmentos do convênio, sem os que o 142/18 fundiu (15, 18, 27) e sem numeração inventada', () => {
    const segmentos = new Set(CEST_CODES.map((c) => c.segmento));
    expect([...segmentos].sort()).toEqual(Object.keys(SEGMENTOS_CEST).sort());
    expect(segmentos.has('15')).toBe(false);
    expect(CEST_CODES.length).toBeGreaterThan(1000);
    expect(CEST_CODES.every((c) => /^\d{2}\.\d{3}\.\d{2}$/.test(c.codigo))).toBe(true);
  });
  it('conferências pontuais contra o texto oficial', () => {
    expect(buscarCest('01.001.00')!.descricao).toMatch(/^Catalisadores em colmeia/);
    expect(buscarCest('14.001.00')!.descricao).toMatch(/^Objetos de vidro para serviço de mesa/);
    expect(buscarCest('17.084.00')!.ncmPrefixos).toEqual(['0201', '0202', '0204', '0206']);
    expect(buscarCest('13.001.00')!.segmento).toBe('13');
    expect(SEGMENTOS_CEST['13']).toMatch(/^Medicamentos/);
    expect(buscarCest('14.032.00')).toBeNull();
    expect(buscarCest('18.001.00')).toBeNull();
  });
});

describe('CEST × NCM', () => {
  it('formata e acha com ou sem pontos', () => {
    expect(formatarCest('1708400')).toBe('17.084.00');
    expect(formatarCest(' 17.084.00 ')).toBe('17.084.00');
    expect(buscarCest('1708400')!.codigo).toBe('17.084.00');
  });
  it('combina por prefixo: posição, subposição, item e capítulo', () => {
    const carne = buscarCest('17.084.00')!;
    expect(cestCombinaComNcm(carne, '0202.30.00')).toBe(true);
    expect(cestCombinaComNcm(carne, '2201.10.00')).toBe(false);
    const perfume = buscarCest('28.056.00')!;
    expect(perfume.ncmPrefixos).toEqual(['33', '34']);
    expect(cestCombinaComNcm(perfume, '3304.99.10')).toBe(true);
  });
  it('sugestões para o NCM: só vigentes, o mais específico primeiro', () => {
    const agua = cestsParaNcm('2201.10.00');
    expect(agua.length).toBeGreaterThan(3);
    expect(agua.every((c) => !c.revogado)).toBe(true);
    // Os de NCM completo (segmento 03) vêm antes do que casa só por capítulo (28.063.00, porta a porta, capítulo 22).
    expect(agua[0].segmento).toBe('03');
    expect(agua[agua.length - 1].codigo).toBe('28.063.00');
    expect(agua.some((c) => c.codigo === '03.005.00')).toBe(true);
    expect(agua.some((c) => c.codigo === '03.001.00')).toBe(false); // revogado pelo Conv. ICMS 150/20
    expect(cestsParaNcm('')).toEqual([]);
  });
  it('avaliação: inexistente, incompatível, sem CEST com sugestão, ok', () => {
    expect(avaliarCest('14.032.00', '0202.30.00')).toMatchObject({ situacao: 'inexistente' });
    expect(avaliarCest('14.032.00', '0202.30.00').sugestoes.map((c) => c.codigo)).toContain('17.084.00');
    expect(avaliarCest('01.001.00', '2201.10.00')).toMatchObject({ situacao: 'incompativel' });
    expect(avaliarCest('', '2201.10.00')).toMatchObject({ situacao: 'sem_cest' });
    expect(avaliarCest('', '9999.99.99')).toMatchObject({ situacao: 'ok', sugestoes: [] });
    expect(avaliarCest('17.084.00', '0202.30.00')).toMatchObject({ situacao: 'ok' });
    expect(avaliarCest('17.084.00', '')).toMatchObject({ situacao: 'ok' });
  });
});
