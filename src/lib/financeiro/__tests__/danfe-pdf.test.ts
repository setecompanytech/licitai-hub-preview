import { describe, it, expect } from 'vitest';
import { PADROES_CODE128, larguras128C, modulos128C, simbolos128C } from '../code128';
import { gerarDanfePdf } from '../danfe-pdf';
import { parseNFeXML } from '@/lib/parseNFe';

const CHAVE = '15240633734346000172550010000005951405758929';

describe('Code 128 C', () => {
  it('a tabela é a da norma: 107 símbolos, 11 módulos cada (STOP com 13)', () => {
    expect(PADROES_CODE128).toHaveLength(107);
    PADROES_CODE128.forEach((p, i) => {
      const soma = p.split('').reduce((a, b) => a + Number(b), 0);
      expect(soma).toBe(i === 106 ? 13 : 11);
      expect(p).toHaveLength(i === 106 ? 7 : 6);
    });
  });
  it('símbolos com dígito verificador', () => {
    expect(simbolos128C('12')).toEqual([105, 12, (105 + 12) % 103, 106]);
    const s = simbolos128C(CHAVE);
    expect(s).toHaveLength(1 + 22 + 1 + 1);
    expect(s[0]).toBe(105); expect(s[s.length - 1]).toBe(106);
    expect(() => simbolos128C('123')).toThrow();
    expect(larguras128C('12')).toHaveLength(6 * 3 + 7);
    expect(modulos128C(CHAVE)).toBe(24 * 11 + 13);
  });
});

describe('DANFE em PDF a partir do XML', () => {
  it('gera uma folha A4 com a chave, o emitente e os itens', () => {
    const xml = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"><ide><cUF>15</cUF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>595</nNF><dhEmi>2024-06-28T10:00:00-03:00</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>33734346000172</CNPJ><xNome>ETHOS ESTRATEGIA E NEGOCIOS LTDA</xNome><enderEmit><xLgr>RUA A</xLgr><nro>1</nro><xBairro>CENTRO</xBairro><xMun>BELEM</xMun><UF>PA</UF><CEP>66000000</CEP></enderEmit><IE>123</IE></emit><dest><CNPJ>04585011000138</CNPJ><xNome>PM BARCARENA</xNome><enderDest><UF>PA</UF></enderDest></dest><det nItem="1"><prod><cProd>1</cProd><xProd>ACUC TRIT 1KG</xProd><NCM>17019900</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>200.0000</qCom><vUnCom>5.0400</vUnCom><vProd>1008.00</vProd></prod></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>1008.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vNF>1008.00</vNF></ICMSTot></total><infAdic><infCpl>Pedido 1</infCpl></infAdic></infNFe></NFe><protNFe><infProt><nProt>315240001234567</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;
    const nfe = parseNFeXML(xml);
    const pdf = gerarDanfePdf(nfe);
    expect(pdf.byteLength).toBeGreaterThan(2000);
    const texto = new TextDecoder('latin1').decode(new Uint8Array(pdf.slice(0, 8)));
    expect(texto.startsWith('%PDF')).toBe(true);
  });
});
