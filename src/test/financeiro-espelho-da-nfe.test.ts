import { describe, it, expect } from 'vitest';
import { espelhoDaNfe } from '@/lib/financeiro/espelho-da-nfe';
import type { NFeData } from '@/lib/parseNFe';

const nfe = (over: Partial<NFeData> = {}) => ({
  chave_acesso: '15260412345678000199550010000001251000001259',
  numero_nf: 125, serie: 1, nat_op: 'VENDA DE MERCADORIA',
  data_emissao: '2026-04-30T10:00:00-03:00',
  cnpj_emitente: '12345678000199', nome_emitente: 'SANTA ROSA COMERCIO LTDA',
  ie_emitente: '123456789', municipio_emitente: 'BELEM', uf_emitente: 'PA',
  cnpj_dest: '05054865000180', nome_dest: 'POLICIA MILITAR DO ESTADO DO PARA',
  uf_dest: 'PA', v_prod: 30960, v_nf: 30960,
  itens: [{ n_item: 1, x_prod: 'AGUA MINERAL 200ML', ncm: '22011000', cfop: '5102',
            u_com: 'UN', q_com: 72000, v_un_com: 0.43, v_prod: 30960 }],
  ...over,
}) as unknown as NFeData;

describe('espelhoDaNfe', () => {
  it('diz na folha que NÃO é o DANFE', () => {
    // O DANFE é o documento auxiliar oficial. Chamar uma aproximação de DANFE
    // convidaria alguém a apresentá-la como se fosse.
    const h = espelhoDaNfe(nfe());
    expect(h).toContain('Não é o DANFE');
    expect(h).toContain('SEFAZ');
  });

  it('traz emitente, destinatário e o total', () => {
    const h = espelhoDaNfe(nfe());
    expect(h).toContain('SANTA ROSA COMERCIO LTDA');
    expect(h).toContain('POLICIA MILITAR DO ESTADO DO PARA');
    expect(h).toContain('12.345.678/0001-99');
    expect(h).toContain('30.960,00');
  });

  it('a chave sai em grupos de quatro, como o papel imprime', () => {
    expect(espelhoDaNfe(nfe())).toContain('1526 0412 3456');
  });

  it('lista os itens com quantidade e unitário', () => {
    const h = espelhoDaNfe(nfe());
    expect(h).toContain('AGUA MINERAL 200ML');
    expect(h).toContain('72.000');
    expect(h).toContain('22011000');
  });

  it('nota sem itens não quebra a folha', () => {
    const h = espelhoDaNfe(nfe({ itens: [] }));
    expect(h).toContain('não trouxe itens');
  });

  it('escapa marcação vinda do XML — o nome é texto de terceiro', () => {
    const h = espelhoDaNfe(nfe({ nome_emitente: '<script>alert(1)</script>' }));
    expect(h).not.toContain('<script>alert');
    expect(h).toContain('&lt;script&gt;');
  });

  it('CPF de destinatário pessoa física é formatado como CPF', () => {
    const h = espelhoDaNfe(nfe({ cnpj_dest: '', cpf_dest: '12345678901' }));
    expect(h).toContain('123.456.789-01');
  });
});
