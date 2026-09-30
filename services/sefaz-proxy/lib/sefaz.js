/**
 * NFeDistribuicaoDFe — o serviço nacional que entrega ao interessado
 * (destinatário, transportador, terceiro autorizado) os documentos fiscais
 * em que ele figura. Duas consultas: por CHAVE (consChNFe) e por NSU
 * (distNSU, a esteira). Exige certificado A1 do interessado, em mTLS.
 *
 * Sem dependência: SOAP montado à mão, resposta lida por expressão regular
 * (o retorno é pequeno e de forma fixa), docZip aberto com o zlib do Node.
 * Nada aqui grava nem loga certificado ou senha.
 */
import https from 'node:https';
import zlib from 'node:zlib';

export const ENDPOINTS = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

const digitos = (s) => String(s ?? '').replace(/\D/g, '');

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita para a esquerda). */
export function chaveValida(chave) {
  const c = digitos(chave);
  if (c.length !== 44) return false;
  let soma = 0;
  for (let i = 0; i < 43; i++) soma += Number(c[42 - i]) * (2 + (i % 8));
  const r = 11 - (soma % 11);
  return (r >= 10 ? 0 : r) === Number(c[43]);
}

/**
 * O envelope SOAP 1.2 da consulta. `consulta` é { chave } (consChNFe) ou
 * { ultNSU } (distNSU). cUFAutor: a UF do interessado (a da chave serve
 * como padrão para a consulta por chave).
 */
export function envelopeDistDFe({ cnpj, ambiente = 'producao', ufAutor, consulta }) {
  const cnpjLimpo = digitos(cnpj);
  if (cnpjLimpo.length !== 14) throw new Error('CNPJ do interessado inválido');
  const tpAmb = ambiente === 'homologacao' ? '2' : '1';
  let corpo;
  if (consulta?.chave) {
    const chave = digitos(consulta.chave);
    if (!chaveValida(chave)) throw new Error('Chave de acesso inválida (44 dígitos com dígito verificador)');
    corpo = `<consChNFe><chNFe>${chave}</chNFe></consChNFe>`;
  } else if (consulta?.ultNSU != null) {
    corpo = `<distNSU><ultNSU>${String(digitos(consulta.ultNSU) || '0').padStart(15, '0')}</ultNSU></distNSU>`;
  } else {
    throw new Error('Consulta sem chave nem NSU');
  }
  const cUF = digitos(ufAutor || (consulta?.chave ? String(consulta.chave).slice(0, 2) : '')) || '91';
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body>' +
    '<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">' +
    '<nfeDadosMsg>' +
    `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${cnpjLimpo}</CNPJ>${corpo}</distDFeInt>` +
    '</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>'
  );
}

const tag = (xml, nome) => {
  const m = new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>([^<]*)<`).exec(xml);
  return m ? m[1].trim() : null;
};

/** O retorno da SEFAZ: código, motivo, NSUs e cada docZip aberto. */
export function parseRetDistDFe(xml) {
  const cStat = tag(xml, 'cStat');
  const xMotivo = tag(xml, 'xMotivo');
  const ultNSU = tag(xml, 'ultNSU');
  const maxNSU = tag(xml, 'maxNSU');
  const docs = [];
  const re = /<(?:[\w-]+:)?docZip([^>]*)>([^<]+)<\/(?:[\w-]+:)?docZip>/g;
  for (const m of xml.matchAll(re)) {
    const atributos = m[1];
    const nsu = /NSU="(\d+)"/.exec(atributos)?.[1] ?? null;
    const schema = /schema="([^"]+)"/.exec(atributos)?.[1] ?? null;
    let conteudo = null;
    try {
      conteudo = zlib.gunzipSync(Buffer.from(m[2].replace(/\s+/g, ''), 'base64')).toString('utf8');
    } catch (e) {
      conteudo = null;
    }
    docs.push({ nsu, schema, xml: conteudo });
  }
  // Erro de SOAP (fault) sem retDistDFeInt.
  const fault = tag(xml, 'Reason') ?? tag(xml, 'faultstring');
  return { cStat, xMotivo: xMotivo ?? fault, ultNSU, maxNSU, docs };
}

/** O que dizer de um documento: procNFe (nota inteira) ou resNFe (só o resumo). */
export function resumoDoDocumento(doc) {
  const x = doc?.xml ?? '';
  const schema = doc?.schema ?? '';
  if (/procNFe|nfeProc/i.test(schema) || /<nfeProc|<NFe/.test(x)) {
    const id = /Id="NFe(\d{44})"/.exec(x)?.[1] ?? null;
    return {
      tipo: 'procNFe',
      chave: id,
      numero: tag(x, 'nNF'),
      serie: tag(x, 'serie'),
      emitente_cnpj: /<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>/.exec(x)?.[1] ?? null,
      emitente_razao: /<emit>[\s\S]*?<xNome>([^<]*)<\/xNome>/.exec(x)?.[1] ?? null,
      destinatario_cnpj: /<dest>[\s\S]*?<(?:CNPJ|CPF)>(\d+)<\/(?:CNPJ|CPF)>/.exec(x)?.[1] ?? null,
      valor_total: Number(tag(x, 'vNF')) || null,
      data_emissao: (tag(x, 'dhEmi') ?? tag(x, 'dEmi') ?? '').slice(0, 10) || null,
      protocolo: tag(x, 'nProt'),
      xml: x,
    };
  }
  if (/resNFe/i.test(schema) || /<resNFe/.test(x)) {
    return {
      tipo: 'resNFe',
      chave: tag(x, 'chNFe'),
      numero: null,
      serie: null,
      emitente_cnpj: tag(x, 'CNPJ'),
      emitente_razao: tag(x, 'xNome'),
      destinatario_cnpj: null,
      valor_total: Number(tag(x, 'vNF')) || null,
      data_emissao: (tag(x, 'dhEmi') ?? '').slice(0, 10) || null,
      protocolo: tag(x, 'nProt'),
      situacao: tag(x, 'cSitNFe'),
      xml: x,
    };
  }
  return { tipo: 'outro', schema, chave: null, xml: x };
}

/** O que cada cStat quer dizer para quem opera. */
export function motivoDoStatus(cStat, xMotivo) {
  switch (String(cStat)) {
    case '138': return 'Documento(s) localizado(s).';
    case '137': return 'Nenhum documento localizado para este CNPJ — a SEFAZ só entrega notas em que a empresa é destinatária, transportadora ou terceiro autorizado.';
    case '656': return 'Consumo indevido: a SEFAZ limita as consultas; aguarde uma hora e tente de novo.';
    case '589': return 'Ambiente errado para este certificado/consulta.';
    default: return xMotivo ? `SEFAZ ${cStat}: ${xMotivo}` : `SEFAZ respondeu ${cStat ?? 'sem código'}.`;
  }
}

/** A chamada em si: mTLS com o .pfx e a senha, SOAP 1.2, resposta como texto. */
export function chamarSefaz({ pfxBase64, senha, key, cert, envelope, ambiente = 'producao', timeoutMs = 45000 }) {
  const url = new URL(ENDPOINTS[ambiente] ?? ENDPOINTS.producao);
  // PEM (chave + cadeia) quando o chamador já abriu o .pfx pelo OpenSSL; o
  // .pfx direto fica como reserva.
  const credencial = key && cert ? { key, cert } : { pfx: Buffer.from(pfxBase64, 'base64'), passphrase: senha };
  return new Promise((resolve, reject) => {
    let req;
    try {
    req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
          'Content-Length': Buffer.byteLength(envelope),
        },
        ...credencial,
        // A cadeia da SEFAZ é ICP-Brasil; o Node valida com a lista do sistema.
        rejectUnauthorized: true,
        timeout: timeoutMs,
      },
      (res) => {
        const partes = [];
        res.on('data', (c) => partes.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes).toString('utf8') }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('SEFAZ não respondeu a tempo')));
    req.on('error', (e) => reject(new Error(traduzErroTls(e))));
    req.write(envelope);
    req.end();
    } catch (e) {
      // Erro ao montar o contexto TLS (o .pfx e a senha) sai síncrono daqui.
      reject(new Error(traduzErroTls(e)));
    }
  });
}

function traduzErroTls(e) {
  const msg = String(e?.message ?? e);
  if (/mac verify failure|wrong password|PKCS12|bad decrypt/i.test(msg)) return 'A senha do certificado não abre o .pfx';
  if (/certificate has expired|CERT_HAS_EXPIRED/i.test(msg)) return 'Certificado vencido';
  if (/handshake|alert/i.test(msg)) return `A SEFAZ recusou o certificado (${msg})`;
  return msg;
}
