import { describe, it, expect } from 'vitest';
import { normalizarMunicipio, filtrarFeriadosPorPraca, type FeriadoComPraca } from '@/lib/metas/praca';

const NACIONAL: FeriadoComPraca = { data: '2026-09-07' };
const ESTADUAL_RS: FeriadoComPraca = { data: '2026-09-20', uf: 'RS' };
const MUNICIPAL_SR_RS: FeriadoComPraca = { data: '2026-08-15', uf: 'RS', municipio: 'Santa Rosa' };
const MUNICIPAL_POA: FeriadoComPraca = { data: '2026-02-02', uf: 'RS', municipio: 'Porto Alegre' };
const ESTADUAL_SP: FeriadoComPraca = { data: '2026-07-09', uf: 'SP' };
const TODOS = [NACIONAL, ESTADUAL_RS, MUNICIPAL_SR_RS, MUNICIPAL_POA, ESTADUAL_SP];

describe('normalizarMunicipio', () => {
  it('colapsa grafia, acento, caixa e pontuação na mesma forma', () => {
    // O caso literal da ressalva 2 da auditoria
    expect(normalizarMunicipio('Santa Rosa')).toBe('santa rosa');
    expect(normalizarMunicipio('SANTA ROSA ')).toBe('santa rosa');
    expect(normalizarMunicipio('Santa  Rosa')).toBe('santa rosa');
    expect(normalizarMunicipio("Sant'Ana do Livramento")).toBe('sant ana do livramento');
    expect(normalizarMunicipio('São Paulo')).toBe('sao paulo');
  });

  it('vazio e nulo viram string vazia', () => {
    expect(normalizarMunicipio(null)).toBe('');
    expect(normalizarMunicipio(undefined)).toBe('');
    expect(normalizarMunicipio('  ')).toBe('');
  });

  /**
   * Paridade com public.comercial_normalizar_municipio (migration
   * 20260804000001) — mesmos pares entrada/saída do lado SQL. Se este teste
   * mudar, a função SQL precisa mudar junto.
   */
  it('paridade com a normalização em SQL', () => {
    const casos: [string, string][] = [
      ['Santa Rosa/RS', 'santa rosa rs'],
      ['MOGI-MIRIM', 'mogi mirim'],
      ['Herval d’Oeste', 'herval d oeste'],
      ['Água Boa', 'agua boa'],
      // ñ entrou no translate do comercial_sem_acento nesta migration
      ['Muñoz', 'munoz'],
      // Entrada DECOMPOSTA (NFD, como texto colado do macOS) — o SQL recompõe
      // com normalize(..., NFC) antes de tirar acento
      ['Sa\u0303o Paulo', 'sao paulo'], // 'a'+combinante U+0303 (NFD), montado de propósito
    ];
    for (const [entrada, esperado] of casos) {
      expect(normalizarMunicipio(entrada)).toBe(esperado);
    }
  });
});

describe('filtrarFeriadosPorPraca', () => {
  it('sem praça, só os nacionais — o fallback que preserva o comportamento atual', () => {
    expect(filtrarFeriadosPorPraca(TODOS, null)).toEqual(['2026-09-07']);
    expect(filtrarFeriadosPorPraca(TODOS, undefined)).toEqual(['2026-09-07']);
    expect(filtrarFeriadosPorPraca(TODOS, {})).toEqual(['2026-09-07']);
    expect(filtrarFeriadosPorPraca(TODOS, { uf: null, municipio: null })).toEqual(['2026-09-07']);
    expect(filtrarFeriadosPorPraca(TODOS, { uf: '' })).toEqual(['2026-09-07']);
    // Município sem UF não habilita nada além dos nacionais
    expect(filtrarFeriadosPorPraca(TODOS, { uf: '', municipio: 'Santa Rosa' })).toEqual(['2026-09-07']);
  });

  it('feriado com uf malformada é barrado, nunca promovido a nacional (fail-closed)', () => {
    const malformado: FeriadoComPraca = { data: '2026-05-05', uf: 'Rio Grande do Sul' };
    expect(filtrarFeriadosPorPraca([malformado], null)).toEqual([]);
    expect(filtrarFeriadosPorPraca([malformado], { uf: 'RS' })).toEqual([]);
  });

  it('praça só com UF: nacionais + estaduais da UF, sem municipais', () => {
    expect(filtrarFeriadosPorPraca(TODOS, { uf: 'RS' })).toEqual(['2026-09-07', '2026-09-20']);
  });

  it('praça completa: nacionais + estaduais da UF + municipais do município', () => {
    expect(filtrarFeriadosPorPraca(TODOS, { uf: 'RS', municipio: 'Santa Rosa' }))
      .toEqual(['2026-09-07', '2026-09-20', '2026-08-15']);
  });

  it('feriado estadual de outra UF não vaza', () => {
    const doRS = filtrarFeriadosPorPraca(TODOS, { uf: 'RS', municipio: 'Santa Rosa' });
    expect(doRS).not.toContain('2026-07-09'); // estadual de SP
  });

  it('município homônimo em outra UF não vaza', () => {
    const santaRosaSP: FeriadoComPraca = { data: '2026-03-03', uf: 'SP', municipio: 'Santa Rosa' };
    const resultado = filtrarFeriadosPorPraca([...TODOS, santaRosaSP], { uf: 'RS', municipio: 'Santa Rosa' });
    expect(resultado).not.toContain('2026-03-03');
  });

  it('grafia divergente do município ainda casa (ressalva 2)', () => {
    expect(filtrarFeriadosPorPraca(TODOS, { uf: 'RS', municipio: 'SANTA ROSA ' }))
      .toContain('2026-08-15');
    expect(filtrarFeriadosPorPraca([{ data: '2026-08-15', uf: 'RS', municipio: 'SANTA  ROSA' }], { uf: 'RS', municipio: 'santa rosa' }))
      .toContain('2026-08-15');
  });

  it('municipal de outro município da mesma UF não entra', () => {
    const resultado = filtrarFeriadosPorPraca(TODOS, { uf: 'RS', municipio: 'Santa Rosa' });
    expect(resultado).not.toContain('2026-02-02'); // Porto Alegre
  });

  it('uf da praça é comparada sem caixa', () => {
    expect(filtrarFeriadosPorPraca(TODOS, { uf: 'rs' })).toContain('2026-09-20');
  });

  it('uf inválida na praça equivale a sem praça', () => {
    expect(filtrarFeriadosPorPraca(TODOS, { uf: 'Rio Grande do Sul' })).toEqual(['2026-09-07']);
  });

  it('lista vazia devolve vazio', () => {
    expect(filtrarFeriadosPorPraca([], { uf: 'RS', municipio: 'Santa Rosa' })).toEqual([]);
  });
});
