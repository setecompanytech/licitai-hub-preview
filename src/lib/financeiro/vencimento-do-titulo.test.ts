import { describe, expect, it } from 'vitest';
import { somarDias, vencimentoDoTitulo } from './vencimento-do-titulo';

/**
 * A escada do vencimento (21/09/2026): informado > emissão + prazo da pessoa
 * > emissão > competência > hoje — e tudo que não foi informado deixa nota.
 */
describe('vencimentoDoTitulo', () => {
  it('o vencimento informado manda, sem nota', () => {
    expect(vencimentoDoTitulo({ informado: '2026-10-15', emissao: '2026-09-15', prazoDias: 30 }))
      .toEqual({ data: '2026-10-15', origem: 'informado', nota: null });
  });

  it('sem duplicata, com pessoa que tem prazo: emissão + prazo, com nota', () => {
    const v = vencimentoDoTitulo({ informado: null, emissao: '2026-09-15', prazoDias: 30 });
    expect(v.data).toBe('2026-10-15');
    expect(v.origem).toBe('emissao_mais_prazo');
    expect(v.nota).toContain('emissão + 30 dia(s)');
  });

  it('a NF 736 da ETHOS: NF-e sem duplicata e sem pessoa vence na emissão, e a nota diz isso', () => {
    const v = vencimentoDoTitulo({ informado: null, emissao: '2026-08-20', prazoDias: null });
    expect(v).toEqual({
      data: '2026-08-20',
      origem: 'emissao',
      nota: 'Vencimento assumido pela data de emissão: o documento não trouxe prazo. Confira e corrija.',
    });
  });

  it('sem emissão cai na competência; sem nada, em hoje', () => {
    expect(vencimentoDoTitulo({ competencia: '2026-09-01' })).toMatchObject({ data: '2026-09-01', origem: 'competencia' });
    expect(vencimentoDoTitulo({ hoje: '2026-09-22' })).toMatchObject({ data: '2026-09-22', origem: 'hoje' });
  });

  it('prazo inválido (negativo, fracionário) não conta: cai na emissão', () => {
    expect(vencimentoDoTitulo({ emissao: '2026-09-15', prazoDias: -5 }).origem).toBe('emissao');
    expect(vencimentoDoTitulo({ emissao: '2026-09-15', prazoDias: 2.5 }).origem).toBe('emissao');
  });

  it('data com hora ou lixo: só AAAA-MM-DD vale; o resto é tratado como ausente', () => {
    expect(vencimentoDoTitulo({ informado: '2026-10-15T00:00:00Z' }).data).toBe('2026-10-15');
    expect(vencimentoDoTitulo({ informado: '15/10/2026', emissao: '2026-09-15' })).toMatchObject({ data: '2026-09-15', origem: 'emissao' });
  });

  it('somarDias atravessa mês, ano e horário de verão em dias-calendário', () => {
    expect(somarDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(somarDias('2026-12-20', 30)).toBe('2027-01-19');
    expect(somarDias('2026-09-15', 0)).toBe('2026-09-15');
  });
});
