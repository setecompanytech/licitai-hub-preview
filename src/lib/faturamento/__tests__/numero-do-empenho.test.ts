import { describe, it, expect } from 'vitest';
import { numeroDoEmpenho } from '@/lib/faturamento/numero-do-empenho';

describe('numeroDoEmpenho', () => {
  it('o vínculo vence qualquer texto — é fato estrutural', () => {
    const r = numeroDoEmpenho({
      doVinculo: '2025NE000064',
      textoDaNota: 'NOTA DE EMPENHO: 2024NE001805',
    })!;
    expect(r).toEqual({ numero: '2025NE000064', origem: 'vinculo' });
  });

  it('acha o formato forte nas informações complementares', () => {
    const r = numeroDoEmpenho({
      textoDaNota: 'REF. AO CONTRATO 149/2024. NOTA DE EMPENHO: 2025NE000064. 1a REMESSA.',
    })!;
    expect(r).toEqual({ numero: '2025NE000064', origem: 'nota' });
  });

  it('normaliza a grafia com espaços — "2025 NE 000064" é o mesmo empenho', () => {
    expect(numeroDoEmpenho({ textoDaNota: 'EMPENHO 2025 NE 000064' })?.numero)
      .toBe('2025NE000064');
  });

  it('aceita número rotulado mesmo fora do padrão estadual', () => {
    expect(numeroDoEmpenho({ textoDaNota: 'NOTA DE EMPENHO Nº 4402/2025' })?.numero)
      .toBe('4402/2025');
  });

  it('dígitos soltos SEM o rótulo não são empenho', () => {
    // "001" era exatamente o que o kit imprimia — número de pedido vestido de
    // empenho. Texto com números avulsos não pode reproduzir o erro.
    expect(numeroDoEmpenho({ textoDaNota: 'PEDIDO 001 - AGUA MINERAL CX 48' })).toBeNull();
  });

  it('sem fonte nenhuma, null — o recibo omite em vez de inventar', () => {
    expect(numeroDoEmpenho({})).toBeNull();
    expect(numeroDoEmpenho({ doVinculo: '', textoDaNota: '  ' })).toBeNull();
  });

  it('o formato forte vence o rotulado quando os dois aparecem', () => {
    const r = numeroDoEmpenho({
      textoDaNota: 'EMPENHO Nº 001 REF 2025NE000064',
    })!;
    expect(r.numero).toBe('2025NE000064');
  });
});
