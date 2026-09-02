import { describe, it, expect } from 'vitest';
import { parseOFX } from '@/lib/financeiro/ofx-parser';
import { interpretarValorColado } from '@/lib/financeiro/valor-colado';

/**
 * A gramática brasileira de dinheiro nos pontos de ENTRADA.
 *
 * Auditoria de 02/09: os importadores de planilha/OMIE removiam todo ponto
 * antes de parsear — "3500.00" (Excel en-US) virava 350000, cem vezes maior,
 * sem aviso. E o parser OFX usava parseFloat cru: banco que emite TRNAMT
 * "1234,56" perdia os centavos na vírgula. Os dois agora passam pela mesma
 * regra do valor-colado: o separador que aparece por ÚLTIMO é o decimal.
 */
const ofxCom = (trnamt: string) => `
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260801<DTEND>20260831
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260810<TRNAMT>${trnamt}<FITID>abc1<MEMO>PIX TESTE</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>0.00<DTASOF>20260831</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('parseOFX — valores em formato brasileiro', () => {
  it('vírgula decimal não perde os centavos', () => {
    expect(parseOFX(ofxCom('-1234,56')).transactions[0].amount).toBe(-1234.56);
  });
  it('milhar com ponto e decimal com vírgula', () => {
    expect(parseOFX(ofxCom('-1.234,56')).transactions[0].amount).toBe(-1234.56);
  });
  it('ponto decimal (spec OFX) continua exato', () => {
    expect(parseOFX(ofxCom('-1234.56')).transactions[0].amount).toBe(-1234.56);
  });
});

describe('interpretarValorColado — o caso dos importadores', () => {
  it('"3500.00" é três mil e quinhentos, não trezentos e cinquenta mil', () => {
    expect(interpretarValorColado('3500.00')).toBe(3500);
  });
  it('"R$ 1.234,56" com símbolo e milhar', () => {
    expect(interpretarValorColado('R$ 1.234,56')).toBe(1234.56);
  });
  it('lixo vira null, nunca NaN silencioso', () => {
    expect(interpretarValorColado('abc')).toBeNull();
  });
});
