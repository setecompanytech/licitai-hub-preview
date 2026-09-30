import { describe, it, expect } from 'vitest';
import { chaveNfeDoTexto, chaveNfeValida, dadosDaChaveNfe, dvDaChaveNfe } from '../chave-nfe';
import { danfeDaChave, dataDeEmissaoDoDanfe, lerDanfe, pastaDaDirecao, valorTotalDoDanfe } from '../danfe-texto';

// PA, 06/2024, CNPJ 04.585.011/0001-38 (fictício), modelo 55, série 1, nº 595.
const CHAVE = '15240604585011000138550010000005951123456780';

describe('chave da NF-e por dentro', () => {
  it('dígito verificador módulo 11 e validação', () => {
    expect(dvDaChaveNfe(CHAVE.slice(0, 43))).toBe(0);
    expect(chaveNfeValida(CHAVE)).toBe(true);
    expect(chaveNfeValida(CHAVE.slice(0, 43) + '1')).toBe(false);
    expect(chaveNfeValida('35200114200166000187550010000000561000000568')).toBe(true);
    expect(chaveNfeValida('12345678901234567890123456789012345678901234')).toBe(false);
  });
  it('acha a chave no texto do DANFE, em grupos de quatro ou emendada; ignora sequência com DV errado', () => {
    const texto = `DANFE ... CHAVE DE ACESSO 1524 0604 5850 1100 0138 5500 1000 0005 9511 2345 6780 Consulta de autenticidade`;
    expect(chaveNfeDoTexto(texto)).toBe(CHAVE);
    expect(chaveNfeDoTexto(`x ${CHAVE} y`)).toBe(CHAVE);
    expect(chaveNfeDoTexto(`Nº 000.000.595 SÉRIE 1 protocolo 315240012345678 ${CHAVE.slice(0, 43)}1`)).toBeNull();
  });
  it('grupos de quatro intercalados com rótulos de caixas vizinhas ainda são a chave', () => {
    const texto = 'CHAVE DE ACESSO 1524 0633 7343 NATUREZA DA OPERAÇÃO 4600 0172 5500 VENDA 1000 0005 9514 PROTOCOLO 0575 8929 315240012';
    expect(chaveNfeDoTexto(texto)).toBe('15240633734346000172550010000005951405758929');
  });
  it('a chave diz emitente, modelo, série, número e competência', () => {
    expect(dadosDaChaveNfe(CHAVE)).toMatchObject({ uf: '15', competencia: '2024-06', cnpj_emitente: '04585011000138', modelo: '55', serie: 1, numero: 595, tp_emis: '1', dv: '0' });
    expect(dadosDaChaveNfe('abc')).toBeNull();
  });
});

describe('DANFE lido pelo texto', () => {
  const texto = `DANFE Documento Auxiliar da Nota Fiscal Eletrônica 0 - ENTRADA 1 - SAÍDA Nº 000.000.595 SÉRIE 001
CHAVE DE ACESSO 1524 0604 5850 1100 0138 5500 1000 0005 9511 2345 6780
NATUREZA DA OPERAÇÃO VENDA DE MERCADORIA DATA DA EMISSÃO 28/06/2024 DATA DE SAÍDA 28/06/2024
CÁLCULO DO IMPOSTO BASE DE CÁLCULO DO ICMS 0,00 VALOR DO ICMS 0,00 VALOR TOTAL DOS PRODUTOS 17.283,00
VALOR DO FRETE 0,00 VALOR DO SEGURO 0,00 DESCONTO 0,00 OUTRAS DESPESAS 0,00 VALOR TOTAL DO IPI 0,00 VALOR TOTAL DA NOTA 17.283,00`;
  it('chave, número, série, valor total, data e direção pelo CNPJ da empresa', () => {
    expect(valorTotalDoDanfe(texto)).toBe(17283);
    expect(dataDeEmissaoDoDanfe(texto)).toBe('2024-06-28');
    expect(lerDanfe(texto, '04.585.011/0001-38')).toEqual({
      chave: CHAVE, numero: 595, serie: 1, modelo: '55', cnpj_emitente: '04585011000138', competencia: '2024-06',
      direcao: 'saida', valor_total: 17283, data_emissao: '2024-06-28',
    });
    expect(lerDanfe(texto, '11.111.111/0001-11')?.direcao).toBe('entrada');
    expect(lerDanfe(texto)?.direcao).toBeNull();
  });
  it('sem chave válida não é DANFE; data de outro mês que a chave é descartada', () => {
    expect(lerDanfe('Recibo nº 12 valor R$ 100,00')).toBeNull();
    expect(lerDanfe(`${CHAVE} DATA DA EMISSÃO 02/07/2024`)?.data_emissao).toBeNull();
  });
  it('DANFE a partir da chave lida por OCR: número, série e emitente da chave; valor e data do que foi lido', () => {
    expect(danfeDaChave(CHAVE, '04.585.011/0001-38', { valor_total: 17283, data_emissao: '2024-06-28' })).toEqual({
      chave: CHAVE, numero: 595, serie: 1, modelo: '55', cnpj_emitente: '04585011000138', competencia: '2024-06',
      direcao: 'saida', valor_total: 17283, data_emissao: '2024-06-28',
    });
    expect(danfeDaChave('000.000.595', null)).toBeNull();
    expect(danfeDaChave(CHAVE.slice(0, 43) + '1', null)).toBeNull();
  });
  it('a pasta segue a direção', () => {
    expect(pastaDaDirecao('saida')).toBe('a_receber');
    expect(pastaDaDirecao('entrada')).toBe('a_pagar');
    expect(pastaDaDirecao(null)).toBeNull();
  });
});
