/**
 * Praefectus — proxy mTLS para a SEFAZ.
 *
 * As edge functions do Supabase não fazem mTLS com certificado A1; este
 * serviço faz. Ele NÃO guarda certificado nem senha: cada pedido traz o
 * .pfx (base64) e a senha, usa-os na chamada e esquece. Quem chama precisa
 * do PROXY_TOKEN (cabeçalho x-proxy-token).
 *
 *   POST /consulta-chave     { cnpj, chave, ambiente?, uf_autor?, pfx_base64, senha }
 *   POST /distribuicao-dfe   { cnpj, ultimo_nsu, ambiente?, uf_autor?, pfx_base64, senha }
 *   POST /certificado/testar { cnpj?, pfx_base64, senha }  → quem é o certificado, validade, senha confere
 *   GET  /saude
 */
import http from 'node:http';
import { chamarSefaz, envelopeDistDFe, motivoDoStatus, parseRetDistDFe, resumoDoDocumento } from './lib/sefaz.js';
import { confereCnpj, inspecionarPfx } from './lib/certificado.js';

const PORTA = Number(process.env.PORT || 8787);
const TOKEN = process.env.PROXY_TOKEN;
const LIMITE_CORPO = 12 * 1024 * 1024;

if (!TOKEN) {
  console.error('PROXY_TOKEN não definido — o proxy não sobe sem ele.');
  process.exit(1);
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const lerCorpo = (req) =>
  new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    req.on('data', (c) => {
      tamanho += c.length;
      if (tamanho > LIMITE_CORPO) { reject(new Error('Corpo grande demais')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });

const mascara = (cnpj) => String(cnpj ?? '').replace(/\D/g, '').replace(/^(\d{2})\d{8}(\d{4})$/, '$1********$2');

/** Antes da SEFAZ: a senha abre? está vencido? é do CNPJ consultado? */
function conferirCertificado(corpo) {
  const inspecao = inspecionarPfx({ pfxBase64: corpo.pfx_base64, senha: corpo.senha });
  if (!inspecao.ok) throw new Error(inspecao.mensagem);
  if (inspecao.vencido) throw new Error(`Certificado vencido em ${inspecao.valido_ate.slice(0, 10)} (${inspecao.titular}).`);
  const confere = confereCnpj(inspecao, corpo.cnpj);
  if (confere === false) throw new Error(`O certificado é do CNPJ ${inspecao.cnpj} (${inspecao.titular}), e a consulta é para ${String(corpo.cnpj).replace(/\D/g, '')}: a SEFAZ só atende o próprio interessado.`);
  return inspecao;
}

async function consultar(corpo, consulta) {
  const { cnpj, ambiente = 'producao', uf_autor, pfx_base64, senha } = corpo;
  if (!pfx_base64 || !senha) throw new Error('Certificado (.pfx em base64) e senha são obrigatórios');
  conferirCertificado(corpo);
  const envelope = envelopeDistDFe({ cnpj, ambiente, ufAutor: uf_autor, consulta });
  const inicio = Date.now();
  const { status, corpo: xml } = await chamarSefaz({ pfxBase64: pfx_base64, senha, envelope, ambiente });
  const ret = parseRetDistDFe(xml);
  const documentos = ret.docs.map(resumoDoDocumento);
  console.log(`[sefaz] ${consulta.chave ? 'chave' : 'nsu'} cnpj=${mascara(cnpj)} http=${status} cStat=${ret.cStat} docs=${documentos.length} ${Date.now() - inicio}ms`);
  return {
    ok: ret.cStat === '138',
    http_status: status,
    cStat: ret.cStat,
    xMotivo: ret.xMotivo,
    mensagem: motivoDoStatus(ret.cStat, ret.xMotivo),
    ultimo_nsu: ret.ultNSU,
    max_nsu: ret.maxNSU,
    documentos,
  };
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/saude') return json(res, 200, { ok: true, servico: 'praefectus-sefaz-proxy' });
    if (req.headers['x-proxy-token'] !== TOKEN) return json(res, 401, { error: 'token do proxy inválido' });
    if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
    const corpo = await lerCorpo(req);
    if (req.url === '/consulta-chave') {
      if (!corpo.chave) return json(res, 400, { error: 'chave é obrigatória' });
      return json(res, 200, await consultar(corpo, { chave: corpo.chave }));
    }
    if (req.url === '/distribuicao-dfe') {
      return json(res, 200, await consultar(corpo, { ultNSU: corpo.ultimo_nsu ?? '0' }));
    }
    if (req.url === '/certificado/testar') {
      const inspecao = inspecionarPfx({ pfxBase64: corpo.pfx_base64, senha: corpo.senha });
      console.log(`[sefaz] testar-certificado ok=${inspecao.ok} ${inspecao.ok ? `cnpj=${mascara(inspecao.cnpj)} ate=${inspecao.valido_ate.slice(0, 10)}` : inspecao.motivo}`);
      return json(res, 200, { ...inspecao, confere_cnpj: corpo.cnpj ? confereCnpj(inspecao, corpo.cnpj) : null });
    }
    return json(res, 404, { error: 'rota desconhecida' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[sefaz] erro:', msg);
    return json(res, 502, { ok: false, error: msg });
  }
});

servidor.listen(PORTA, () => console.log(`praefectus-sefaz-proxy ouvindo em :${PORTA}`));
