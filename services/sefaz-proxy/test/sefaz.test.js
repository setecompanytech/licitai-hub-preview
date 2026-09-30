import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { chaveValida, envelopeDistDFe, motivoDoStatus, parseRetDistDFe, resumoDoDocumento } from '../lib/sefaz.js';

const CHAVE = '15240633734346000172550010000005951405758929';

test('chave com dígito verificador', () => {
  assert.equal(chaveValida(CHAVE), true);
  assert.equal(chaveValida(CHAVE.slice(0, 43) + '1'), false);
  assert.equal(chaveValida('123'), false);
});

test('envelope por chave e por NSU', () => {
  const porChave = envelopeDistDFe({ cnpj: '33.734.346/0001-72', consulta: { chave: CHAVE } });
  assert.match(porChave, /<tpAmb>1<\/tpAmb><cUFAutor>15<\/cUFAutor><CNPJ>33734346000172<\/CNPJ><consChNFe><chNFe>15240633734346000172550010000005951405758929<\/chNFe><\/consChNFe>/);
  assert.match(porChave, /versao="1\.01"/);
  const porNsu = envelopeDistDFe({ cnpj: '33734346000172', ambiente: 'homologacao', ufAutor: '15', consulta: { ultNSU: '42' } });
  assert.match(porNsu, /<tpAmb>2<\/tpAmb><cUFAutor>15<\/cUFAutor>.*<distNSU><ultNSU>000000000000042<\/ultNSU><\/distNSU>/);
  assert.throws(() => envelopeDistDFe({ cnpj: '123', consulta: { chave: CHAVE } }), /CNPJ/);
  assert.throws(() => envelopeDistDFe({ cnpj: '33734346000172', consulta: { chave: '1234' } }), /Chave/);
});

test('retorno da SEFAZ: cStat, NSUs e docZip aberto; procNFe e resNFe resumidos', () => {
  const procNFe = `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${CHAVE}" versao="4.00"><ide><serie>1</serie><nNF>595</nNF><dhEmi>2024-06-28T10:00:00-03:00</dhEmi></ide><emit><CNPJ>33734346000172</CNPJ><xNome>ETHOS ESTRATEGIA E NEGOCIOS LTDA</xNome></emit><dest><CNPJ>04585011000138</CNPJ><xNome>PM BARCARENA</xNome></dest><total><ICMSTot><vNF>17283.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><nProt>315240001234567</nProt></infProt></protNFe></nfeProc>`;
  const resNFe = `<resNFe versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>${CHAVE}</chNFe><CNPJ>33734346000172</CNPJ><xNome>ETHOS</xNome><dhEmi>2024-06-28T10:00:00-03:00</dhEmi><vNF>17283.00</vNF><cSitNFe>1</cSitNFe><nProt>315240001234567</nProt></resNFe>`;
  const zip = (s) => zlib.gzipSync(Buffer.from(s, 'utf8')).toString('base64');
  const xml = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDistDFeInteresseResult><retDistDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><verAplic>1.5</verAplic><cStat>138</cStat><xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2026-09-30T12:00:00-03:00</dhResp><ultNSU>000000000000010</ultNSU><maxNSU>000000000000010</maxNSU><loteDistDFeInt><docZip NSU="000000000000009" schema="resNFe_v1.01.xsd">${zip(resNFe)}</docZip><docZip schema="procNFe_v4.00.xsd" NSU="000000000000010">${zip(procNFe)}</docZip></loteDistDFeInt></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;
  const ret = parseRetDistDFe(xml);
  assert.equal(ret.cStat, '138');
  assert.equal(ret.ultNSU, '000000000000010');
  assert.equal(ret.docs.length, 2);
  assert.equal(ret.docs[1].nsu, '000000000000010');
  const [resumo, inteira] = ret.docs.map(resumoDoDocumento);
  assert.equal(resumo.tipo, 'resNFe');
  assert.equal(resumo.chave, CHAVE);
  assert.equal(resumo.valor_total, 17283);
  assert.equal(inteira.tipo, 'procNFe');
  assert.equal(inteira.chave, CHAVE);
  assert.equal(inteira.numero, '595');
  assert.equal(inteira.emitente_cnpj, '33734346000172');
  assert.equal(inteira.destinatario_cnpj, '04585011000138');
  assert.equal(inteira.data_emissao, '2024-06-28');
  assert.match(inteira.xml, /<nfeProc/);
});

test('sem documento e consumo indevido têm explicação', () => {
  const ret = parseRetDistDFe('<retDistDFeInt><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo></retDistDFeInt>');
  assert.equal(ret.docs.length, 0);
  assert.match(motivoDoStatus(ret.cStat, ret.xMotivo), /Nenhum documento/);
  assert.match(motivoDoStatus('656', 'Consumo indevido'), /uma hora/);
});
