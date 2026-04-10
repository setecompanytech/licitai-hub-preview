// Parser client-side completo NF-e 4.0 + NT 2025.002

export interface NFeItemData {
  n_item: number;
  c_prod: string;
  c_ean: string;
  x_prod: string;
  ncm: string;
  cest: string;
  cfop: string;
  u_com: string;
  q_com: number;
  v_un_com: number;
  v_prod: number;
  v_desc: number;
  cst_icms: string;
  csosn: string;
  cst_pis: string;
  cst_cofins: string;
  v_pis: number;
  v_cofins: number;
  cst_ibs_cbs: string;
  c_class_trib: string;
  v_ibs: number;
  v_cbs: number;
  inf_ad_prod: string;
}

export interface NFeData {
  chave_acesso: string;
  numero_nf: number;
  serie: number;
  modelo: number;
  nat_op: string;
  data_emissao: string;
  tipo_nf: 'entrada' | 'saida';
  crt_emitente: number;
  cnpj_emitente: string;
  nome_emitente: string;
  ie_emitente: string;
  uf_emitente: string;
  cnpj_dest: string;
  cpf_dest: string;
  nome_dest: string;
  ie_dest: string;
  uf_dest: string;
  email_dest: string;
  ind_ie_dest: number;
  v_bc: number;
  v_icms: number;
  v_pis: number;
  v_cofins: number;
  v_ipi: number;
  v_prod: number;
  v_frete: number;
  v_seg: number;
  v_desc: number;
  v_nf: number;
  v_ibs: number;
  v_cbs: number;
  ir_retido: number;
  csll_retido: number;
  pis_retido: number;
  cofins_retido: number;
  inss_retido: number;
  inf_compl: string;
  protocolo_auth: string;
  data_autorizacao: string;
  status_sefaz: string;
  codigo_status: number;
  motivo_status: string;
  itens: NFeItemData[];
}

export function parseNFeXML(xmlString: string): NFeData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const get = (tag: string) =>
    doc.getElementsByTagName(tag)[0]?.textContent ?? '';
  const getFloat = (tag: string) => parseFloat(get(tag) || '0') || 0;

  const infNFe = doc.getElementsByTagName('infNFe')[0];
  const chaveId = infNFe?.getAttribute('Id') ?? '';
  const chave = chaveId.replace('NFe', '');

  return {
    chave_acesso: chave,
    numero_nf: parseInt(get('nNF')) || 0,
    serie: parseInt(get('serie')) || 1,
    modelo: parseInt(get('mod')) || 55,
    nat_op: get('natOp'),
    data_emissao: get('dhEmi'),
    tipo_nf: get('tpNF') === '0' ? 'entrada' : 'saida',
    crt_emitente: parseInt(get('CRT')) || 1,

    cnpj_emitente: doc.querySelector('emit CNPJ')?.textContent ?? '',
    nome_emitente: doc.querySelector('emit xNome')?.textContent ?? '',
    ie_emitente: doc.querySelector('emit IE')?.textContent ?? '',
    uf_emitente: doc.querySelector('emit enderEmit UF')?.textContent ?? '',

    cnpj_dest: doc.querySelector('dest CNPJ')?.textContent ?? '',
    cpf_dest: doc.querySelector('dest CPF')?.textContent ?? '',
    nome_dest: doc.querySelector('dest xNome')?.textContent ?? '',
    ie_dest: doc.querySelector('dest IE')?.textContent ?? '',
    uf_dest: doc.querySelector('dest enderDest UF')?.textContent ?? '',
    email_dest: doc.querySelector('dest email')?.textContent ?? '',
    ind_ie_dest: parseInt(doc.querySelector('dest indIEDest')?.textContent || '9'),

    v_bc: getFloat('vBC'),
    v_icms: getFloat('vICMS'),
    v_pis: getFloat('vPIS'),
    v_cofins: getFloat('vCOFINS'),
    v_ipi: getFloat('vIPI'),
    v_prod: getFloat('vProd'),
    v_frete: getFloat('vFrete'),
    v_seg: getFloat('vSeg'),
    v_desc: getFloat('vDesc'),
    v_nf: getFloat('vNF'),

    v_ibs: getFloat('vIBS'),
    v_cbs: getFloat('vCBS'),

    ir_retido: getFloat('vRetIR'),
    csll_retido: getFloat('vRetCSLL'),
    pis_retido: getFloat('vRetPIS'),
    cofins_retido: getFloat('vRetCOFINS'),
    inss_retido: getFloat('vRetINSS'),

    inf_compl: get('infCpl'),
    protocolo_auth: get('nProt'),
    data_autorizacao: get('dhRecbto'),
    status_sefaz: get('cStat') === '100' ? 'autorizada' : 'rejeitada',
    codigo_status: parseInt(get('cStat') || '0'),
    motivo_status: get('xMotivo'),

    itens: Array.from(doc.getElementsByTagName('det')).map((det) => ({
      n_item: parseInt(det.getAttribute('nItem') || '0'),
      c_prod: det.querySelector('prod cProd')?.textContent ?? '',
      c_ean: det.querySelector('prod cEAN')?.textContent ?? '',
      x_prod: det.querySelector('prod xProd')?.textContent ?? '',
      ncm: det.querySelector('prod NCM')?.textContent ?? '',
      cest: det.querySelector('prod CEST')?.textContent ?? '',
      cfop: det.querySelector('prod CFOP')?.textContent ?? '',
      u_com: det.querySelector('prod uCom')?.textContent ?? '',
      q_com: parseFloat(det.querySelector('prod qCom')?.textContent || '0'),
      v_un_com: parseFloat(det.querySelector('prod vUnCom')?.textContent || '0'),
      v_prod: parseFloat(det.querySelector('prod vProd')?.textContent || '0'),
      v_desc: parseFloat(det.querySelector('prod vDesc')?.textContent || '0'),
      cst_icms: det.querySelector('[cst]')?.textContent ?? '',
      csosn: det.querySelector('CSOSN')?.textContent ?? '',
      cst_pis: det.querySelector('PIS CST')?.textContent ?? '07',
      cst_cofins: det.querySelector('COFINS CST')?.textContent ?? '07',
      v_pis: parseFloat(det.querySelector('PIS vPIS')?.textContent || '0'),
      v_cofins: parseFloat(det.querySelector('COFINS vCOFINS')?.textContent || '0'),
      cst_ibs_cbs: det.querySelector('IBSCBS CST')?.textContent ?? '',
      c_class_trib: det.querySelector('cClassTrib')?.textContent ?? '',
      v_ibs: parseFloat(det.querySelector('IBSCBS vIBS')?.textContent || '0'),
      v_cbs: parseFloat(det.querySelector('IBSCBS vCBS')?.textContent || '0'),
      inf_ad_prod: det.querySelector('infAdProd')?.textContent ?? '',
    })),
  };
}

// Cálculo automático de retenções para serviços
export function calcRetencoes(valorBruto: number, opts?: {
  aliqIR?: number;
  aliqCSLL?: number;
  aliqPIS?: number;
  aliqCOFINS?: number;
  aliqINSS?: number;
  aliqISS?: number;
  retINSS?: boolean;
  retISS?: boolean;
}) {
  const o = opts || {};
  const ir = valorBruto >= 666.67 ? valorBruto * ((o.aliqIR ?? 1.5) / 100) : 0;
  const csll = valorBruto * ((o.aliqCSLL ?? 1) / 100);
  const pis = valorBruto * ((o.aliqPIS ?? 0.65) / 100);
  const cofins = valorBruto * ((o.aliqCOFINS ?? 3) / 100);
  const inss = o.retINSS ? valorBruto * ((o.aliqINSS ?? 11) / 100) : 0;
  const iss = o.retISS ? valorBruto * ((o.aliqISS ?? 5) / 100) : 0;
  const total = ir + csll + pis + cofins + inss + iss;

  return {
    ir_retido: Math.round(ir * 100) / 100,
    csll_retido: Math.round(csll * 100) / 100,
    pis_retido: Math.round(pis * 100) / 100,
    cofins_retido: Math.round(cofins * 100) / 100,
    inss_retido: Math.round(inss * 100) / 100,
    iss_retido: Math.round(iss * 100) / 100,
    total_retencoes: Math.round(total * 100) / 100,
    valor_liquido: Math.round((valorBruto - total) * 100) / 100,
  };
}

// Parser de código de barras de boleto (47/48 dígitos)
export function parseCodigoBarras(codigo: string) {
  const limpo = codigo.replace(/[\s.-]/g, '');
  if (limpo.length < 47) return null;

  const bancoCodigo = limpo.substring(0, 3);
  // Campo 5 do código: fator de vencimento e valor
  const fatorVenc = parseInt(limpo.substring(33, 37));
  const valorStr = limpo.substring(37, 47);
  const valor = parseInt(valorStr) / 100;

  // Data base: 07/10/1997
  const dataBase = new Date(1997, 9, 7);
  const vencimento = new Date(dataBase.getTime() + fatorVenc * 86400000);
  const vencStr = vencimento.toISOString().split('T')[0];

  return { bancoCodigo, valor, data_vencimento: vencStr };
}

// Bancos para importação de extrato
export const BANCOS_EXTRATO = [
  { ispb: '00000000', codigo: '001', nome: 'Banco do Brasil', cor: '#FFCC00' },
  { ispb: '04902979', codigo: '077', nome: 'Banco Inter', cor: '#FF7A00' },
  { ispb: '04913574', codigo: 'BP', nome: 'Banpará', cor: '#003D6E' },
  { ispb: '00000208', codigo: '033', nome: 'Santander', cor: '#CC0000' },
  { ispb: '60746948', codigo: '341', nome: 'Itaú Unibanco', cor: '#F88800' },
  { ispb: '00360305', codigo: '104', nome: 'Caixa Econômica Federal', cor: '#005CA9' },
  { ispb: '00000000', codigo: '237', nome: 'Bradesco', cor: '#CC0000' },
  { ispb: '18236120', codigo: '260', nome: 'Nubank', cor: '#8A05BE' },
  { ispb: '92894922', codigo: '748', nome: 'Sicredi', cor: '#005F1F' },
  { ispb: '00714671', codigo: '756', nome: 'Sicoob/Bancoob', cor: '#006E2E' },
  { ispb: null, codigo: 'OFX', nome: 'Arquivo Genérico OFX', cor: '#6B7590' },
];

// Parser OFX simplificado
export function parseOFX(text: string) {
  const transactions: Array<{
    data: string;
    valor: number;
    tipo: 'credito' | 'debito';
    descricao: string;
    fitid: string;
  }> = [];

  const stmtTrns = text.split('<STMTTRN>').slice(1);
  for (const trn of stmtTrns) {
    const getVal = (tag: string) => {
      const match = trn.match(new RegExp(`<${tag}>([^<\\n]+)`));
      return match ? match[1].trim() : '';
    };

    const dtPosted = getVal('DTPOSTED');
    const trnAmt = parseFloat(getVal('TRNAMT') || '0');
    const memo = getVal('MEMO') || getVal('NAME') || '';
    const fitid = getVal('FITID');

    if (dtPosted) {
      const year = dtPosted.substring(0, 4);
      const month = dtPosted.substring(4, 6);
      const day = dtPosted.substring(6, 8);

      transactions.push({
        data: `${year}-${month}-${day}`,
        valor: Math.abs(trnAmt),
        tipo: trnAmt >= 0 ? 'credito' : 'debito',
        descricao: memo,
        fitid,
      });
    }
  }

  return transactions;
}
