import { describe, it, expect } from 'vitest';
import { consolidar, type LeituraDoDanfe } from '@/lib/financeiro/ler-danfe';
import { digitoVerificadorDaChave } from '@/lib/financeiro/danfe';

const PREFIXO = '15' + '2604' + '12345678000199' + '55' + '001' + '000000125' + '1' + '12345678';
const CHAVE = PREFIXO + String(digitoVerificadorDaChave(PREFIXO));
const DA_CHAVE = {
  uf: '15', competencia: '2026-04', cnpj_emitente: '12345678000199',
  modelo: '55', serie: '1', numero: '125',
};

const leitura = (over: Partial<LeituraDoDanfe> = {}): LeituraDoDanfe => ({
  daChave: DA_CHAVE, chave: CHAVE, daIa: null, contradicoes: [], ...over,
});

describe('consolidar', () => {
  it('sem leitura nenhuma, nada a consolidar', () => {
    expect(consolidar({ daChave: null, chave: null, daIa: null, contradicoes: [] })).toBeNull();
  });

  it('só a chave: número, série e competência, sem dia inventado', () => {
    const r = consolidar(leitura())!;
    expect(r.numero_nf).toBe(125);
    expect(r.serie).toBe(1);
    // O dia 1 é a competência, não um palpite sobre o dia real.
    expect(r.data_emissao).toBe('2026-04-01');
    expect(r.v_nf).toBeNull();
    expect(r.itens).toEqual([]);
  });

  it('a IA acrescenta o que a chave não codifica', () => {
    const r = consolidar(leitura({
      daIa: {
        numero_nf: 125, serie: 1, data_emissao: '2026-04-30', v_nf: 30960,
        itens: [{ x_prod: 'AGUA MINERAL 200ML', q_com: 72000, v_un_com: 0.43 }],
      },
    }))!;
    expect(r.data_emissao).toBe('2026-04-30');
    expect(r.v_nf).toBe(30960);
    expect(r.itens).toHaveLength(1);
    expect(r.itens![0].q_com).toBe(72000);
  });

  it('a chave vence o número quando a IA discorda', () => {
    // 44 dígitos que fecham o DV são o número da nota, ponto. Leitura de papel
    // erra; aritmética não.
    const r = consolidar(leitura({ daIa: { numero_nf: 999, serie: 7, v_nf: 30960 } }))!;
    expect(r.numero_nf).toBe(125);
    expect(r.serie).toBe(1);
    // Mas o valor, que a chave não tem, vem da IA.
    expect(r.v_nf).toBe(30960);
  });

  it('dia da IA em mês que a chave contradiz não é aceito', () => {
    const r = consolidar(leitura({ daIa: { data_emissao: '2026-07-15', v_nf: 100 } }))!;
    expect(r.data_emissao).toBe('2026-04-01');
  });

  it('sem a chave, a IA vale sozinha', () => {
    const r = consolidar({
      daChave: null, chave: null, contradicoes: [],
      daIa: { numero_nf: 300, serie: 2, data_emissao: '2026-05-10', v_nf: 500, chave_acesso: null },
    })!;
    expect(r.numero_nf).toBe(300);
    expect(r.serie).toBe(2);
    expect(r.data_emissao).toBe('2026-05-10');
  });

  it('a chave achada no papel é a que fica, não a que a IA transcreveu', () => {
    const r = consolidar(leitura({ daIa: { chave_acesso: '0'.repeat(44), v_nf: 1 } }))!;
    expect(r.chave_acesso).toBe(CHAVE);
  });
});
