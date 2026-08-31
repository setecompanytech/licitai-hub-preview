import { describe, it, expect } from 'vitest';
import {
  chaveValida, camposDoDocumento, conferirContraOLancamento, quantidadeDaNota,
  type NFeLida,
} from '@/lib/financeiro/nfe-para-lancamento';

const nfe = (over: Partial<NFeLida> = {}): NFeLida => ({
  chave_acesso: '15260412345678000199550010000001251000001259',
  numero_nf: 125,
  serie: 1,
  data_emissao: '2026-04-30T10:15:00-03:00',
  v_nf: 30960,
  tipo_nf: 'saida',
  nome_dest: 'POLICIA MILITAR DO ESTADO DO PARA',
  itens: [{ x_prod: 'AGUA MINERAL 200ML', q_com: 72000, v_un_com: 0.43, v_prod: 30960 }],
  ...over,
});

describe('chaveValida', () => {
  it('44 dígitos passa', () => {
    expect(chaveValida('15260412345678000199550010000001251000001259')).toHaveLength(44);
  });

  it('44 zeros é campo preenchido com nada — e vazio se vê, zerado não', () => {
    expect(chaveValida('0'.repeat(44))).toBeNull();
  });

  it('menos de 44 dígitos não é chave', () => {
    expect(chaveValida('1526041234')).toBeNull();
    expect(chaveValida(null)).toBeNull();
  });
});

describe('camposDoDocumento', () => {
  it('extrai os cinco campos que a aba pede', () => {
    expect(camposDoDocumento(nfe())).toEqual({
      numero_documento: '125',
      serie_documento: '1',
      chave_acesso_nfe: '15260412345678000199550010000001251000001259',
      data_emissao: '2026-04-30',
      valor: 30960,
    });
  });

  it('a data perde a hora e o fuso', () => {
    expect(camposDoDocumento(nfe({ data_emissao: '2026-04-30T23:59:00-03:00' })).data_emissao)
      .toBe('2026-04-30');
  });

  it('série zero é série válida, não ausência', () => {
    expect(camposDoDocumento(nfe({ serie: 0 })).serie_documento).toBe('0');
  });
});

describe('conferirContraOLancamento', () => {
  it('campo em branco: o XML manda', () => {
    const r = conferirContraOLancamento(nfe(), { numero_documento: null, serie_documento: '' });
    expect(r.preencher.numero_documento).toBe('125');
    expect(r.preencher.serie_documento).toBe('1');
    expect(r.divergencias).toHaveLength(0);
  });

  it('chave de 44 zeros conta como vazia e é substituída', () => {
    const r = conferirContraOLancamento(nfe(), { chave_acesso_nfe: '0'.repeat(44) });
    expect(r.preencher.chave_acesso_nfe).toHaveLength(44);
    expect(r.divergencias).toHaveLength(0);
  });

  it('"000125" e "125" são a mesma nota — não é divergência', () => {
    const r = conferirContraOLancamento(nfe(), { numero_documento: '000125' });
    expect(r.divergencias).toHaveLength(0);
    expect(r.preencher.numero_documento).toBeUndefined();
  });

  it('número diferente é apontado, nunca sobrescrito', () => {
    const r = conferirContraOLancamento(nfe(), { numero_documento: '999' });
    expect(r.preencher.numero_documento).toBeUndefined();
    expect(r.divergencias).toEqual([
      { campo: 'Número do documento', noSistema: '999', naNota: '125' },
    ]);
  });

  it('valor do lançamento conciliado NÃO é sobrescrito pelo total da nota', () => {
    // Retenção, desconto ou pagamento parcial fazem o extrato divergir da nota
    // legitimamente. Sobrescrever quebraria a conciliação em silêncio.
    const r = conferirContraOLancamento(nfe(), { valor: 28000 });
    expect(r.preencher.valor).toBeUndefined();
    expect(r.divergencias.find(d => d.campo === 'Valor')).toBeTruthy();
  });

  it('valor zerado é ausência: o XML preenche', () => {
    const r = conferirContraOLancamento(nfe(), { valor: 0 });
    expect(r.preencher.valor).toBe(30960);
    expect(r.divergencias).toHaveLength(0);
  });

  it('diferença de centavo por arredondamento não vira divergência', () => {
    const r = conferirContraOLancamento(nfe({ v_nf: 30960.001 }), { valor: 30960 });
    expect(r.divergencias.find(d => d.campo === 'Valor')).toBeUndefined();
  });

  it('tudo igual: nada a preencher, nada a apontar', () => {
    const r = conferirContraOLancamento(nfe(), {
      numero_documento: '125', serie_documento: '1',
      chave_acesso_nfe: '15260412345678000199550010000001251000001259',
      data_emissao: '2026-04-30', valor: 30960,
    });
    expect(Object.keys(r.preencher)).toHaveLength(0);
    expect(r.divergencias).toHaveLength(0);
  });
});

describe('quantidadeDaNota', () => {
  it('traz a quantidade que hoje se calculava à mão', () => {
    // R$ 30.960,00 a R$ 0,43 = 72.000. A conta não deveria ser de quem cadastra.
    const q = quantidadeDaNota(nfe());
    expect(q.total).toBe(72000);
    expect(q.linhas[0]).toEqual({ descricao: 'AGUA MINERAL 200ML', quantidade: 72000, unitario: 0.43 });
  });

  it('soma as linhas, e devolve a lista para quem precise separá-las', () => {
    const q = quantidadeDaNota(nfe({
      itens: [
        { x_prod: 'AGUA 200ML', q_com: 50000, v_un_com: 0.43 },
        { x_prod: 'AGUA 500ML', q_com: 22000, v_un_com: 0.80 },
      ],
    }));
    expect(q.total).toBe(72000);
    expect(q.linhas).toHaveLength(2);
  });

  it('nota sem itens não quebra', () => {
    expect(quantidadeDaNota(nfe({ itens: undefined }))).toEqual({ total: 0, linhas: [] });
  });
});
