// ============================================================================
// PRAEFECTUS — Helpers para NF-e/NFS-e
// Path no Lovable: src/lib/financeiro/nfe-helpers.ts
// ============================================================================
// Validações, listas comuns, e utilitários para emissão fiscal.
// ============================================================================

// ============================================================================
// VALIDAÇÃO CHAVE DE ACESSO NF-e (44 dígitos com DV)
// ============================================================================

export function validarChaveNFe(chave: string): boolean {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) return false;

  // DV calculado pelos primeiros 43 dígitos
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += parseInt(c[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === parseInt(c[43], 10);
}

export function decompoeChaveNFe(chave: string): {
  uf: string;
  ano: string;
  mes: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string;
  tipo_emissao: string;
  codigo: string;
  dv: string;
} | null {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) return null;

  return {
    uf: c.substring(0, 2),
    ano: c.substring(2, 4),
    mes: c.substring(4, 6),
    cnpj: c.substring(6, 20),
    modelo: c.substring(20, 22),
    serie: c.substring(22, 25),
    numero: c.substring(25, 34),
    tipo_emissao: c.substring(34, 35),
    codigo: c.substring(35, 43),
    dv: c.substring(43, 44),
  };
}

export function formatarChaveNFe(chave: string): string {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) return chave;
  return c.match(/.{1,4}/g)?.join(" ") ?? chave;
}

// ============================================================================
// CÓDIGOS UF (IBGE)
// ============================================================================

export const CODIGO_UF: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53,
  ES: 32, GO: 52, MA: 21, MG: 31, MS: 50, MT: 51, PA: 15,
  PB: 25, PE: 26, PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11,
  RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
};

// ============================================================================
// CFOP COMUNS (lista resumida)
// ============================================================================

export interface CFOPInfo {
  codigo: string;
  descricao: string;
  tipo: "saida" | "entrada";
  natureza: string;
}

export const CFOPS_VENDA: readonly CFOPInfo[] = Object.freeze([
  { codigo: "5101", descricao: "Venda de produção do estabelecimento", tipo: "saida", natureza: "Venda" },
  { codigo: "5102", descricao: "Venda de mercadoria adquirida ou recebida de terceiros", tipo: "saida", natureza: "Venda" },
  { codigo: "5103", descricao: "Venda de produção do estabelecimento, efetuada fora do estabelecimento", tipo: "saida", natureza: "Venda" },
  { codigo: "5104", descricao: "Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento", tipo: "saida", natureza: "Venda" },
  { codigo: "5109", descricao: "Venda de produção do estabelecimento destinada à Zona Franca de Manaus", tipo: "saida", natureza: "Venda ZFM" },
  { codigo: "5113", descricao: "Venda de produção do estabelecimento, originada de encomenda para entrega futura", tipo: "saida", natureza: "Venda futura" },
  { codigo: "5114", descricao: "Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda", tipo: "saida", natureza: "Venda futura" },
  { codigo: "6101", descricao: "Venda de produção do estabelecimento (interestadual)", tipo: "saida", natureza: "Venda interestadual" },
  { codigo: "6102", descricao: "Venda de mercadoria adquirida ou recebida de terceiros (interestadual)", tipo: "saida", natureza: "Venda interestadual" },
  { codigo: "6107", descricao: "Venda de produção do estabelecimento, destinada a não contribuinte (interestadual)", tipo: "saida", natureza: "Venda final interestadual" },
  { codigo: "6108", descricao: "Venda de mercadoria adquirida ou recebida de terceiros, destinada a não contribuinte (interestadual)", tipo: "saida", natureza: "Venda final interestadual" },
  { codigo: "5910", descricao: "Remessa em bonificação, doação ou brinde", tipo: "saida", natureza: "Bonificação" },
  { codigo: "5911", descricao: "Remessa de amostra grátis", tipo: "saida", natureza: "Amostra" },
  { codigo: "5949", descricao: "Outra saída de mercadoria ou prestação de serviço não especificado", tipo: "saida", natureza: "Outra" },
]);

export const CFOPS_DEVOLUCAO: readonly CFOPInfo[] = Object.freeze([
  { codigo: "5202", descricao: "Devolução de compra para comercialização", tipo: "saida", natureza: "Devolução" },
  { codigo: "5411", descricao: "Devolução de compra para industrialização", tipo: "saida", natureza: "Devolução" },
  { codigo: "6202", descricao: "Devolução de compra para comercialização (interestadual)", tipo: "saida", natureza: "Devolução interestadual" },
]);

// ============================================================================
// LISTA DE SERVIÇOS LC 116/2003 (resumida)
// ============================================================================

export interface ItemServico {
  codigo: string;
  descricao: string;
  cnae?: string;
}

export const ITENS_SERVICO_COMUNS: readonly ItemServico[] = Object.freeze([
  { codigo: "01.01", descricao: "Análise e desenvolvimento de sistemas", cnae: "6201-5/01" },
  { codigo: "01.02", descricao: "Programação", cnae: "6201-5/01" },
  { codigo: "01.03", descricao: "Processamento, armazenamento ou hospedagem de dados", cnae: "6311-9/00" },
  { codigo: "01.04", descricao: "Elaboração de programas de computadores, inclusive jogos eletrônicos", cnae: "5829-8/99" },
  { codigo: "01.05", descricao: "Licenciamento ou cessão de direito de uso de programas de computação", cnae: "5829-8/99" },
  { codigo: "01.06", descricao: "Assessoria e consultoria em informática", cnae: "6204-0/00" },
  { codigo: "01.07", descricao: "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas", cnae: "6202-3/00" },
  { codigo: "01.08", descricao: "Planejamento, confecção, manutenção e atualização de páginas eletrônicas", cnae: "6311-9/00" },
  { codigo: "10.01", descricao: "Agenciamento, corretagem ou intermediação de câmbio, seguros e planos de previdência privada" },
  { codigo: "10.02", descricao: "Agenciamento, corretagem ou intermediação de títulos quaisquer" },
  { codigo: "17.01", descricao: "Assessoria ou consultoria de qualquer natureza, não contida em outros itens", cnae: "7020-4/00" },
  { codigo: "17.06", descricao: "Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas" },
  { codigo: "17.19", descricao: "Contabilidade, inclusive serviços técnicos e auxiliares", cnae: "6920-6/01" },
  { codigo: "17.20", descricao: "Consultoria e assessoria econômica ou financeira" },
  { codigo: "23.01", descricao: "Serviços de programação e comunicação visual, desenho industrial" },
]);

// ============================================================================
// FORMAS DE PAGAMENTO NF-e (tabela oficial)
// ============================================================================

export const FORMAS_PAGAMENTO_NFE = Object.freeze([
  { codigo: "01", nome: "Dinheiro" },
  { codigo: "02", nome: "Cheque" },
  { codigo: "03", nome: "Cartão de Crédito" },
  { codigo: "04", nome: "Cartão de Débito" },
  { codigo: "05", nome: "Crédito Loja" },
  { codigo: "10", nome: "Vale Alimentação" },
  { codigo: "11", nome: "Vale Refeição" },
  { codigo: "12", nome: "Vale Presente" },
  { codigo: "13", nome: "Vale Combustível" },
  { codigo: "15", nome: "Boleto Bancário" },
  { codigo: "16", nome: "Depósito Bancário" },
  { codigo: "17", nome: "Pagamento Instantâneo (PIX)" },
  { codigo: "18", nome: "Transferência bancária, Carteira Digital" },
  { codigo: "19", nome: "Programa de fidelidade, Cashback, Crédito Virtual" },
  { codigo: "90", nome: "Sem pagamento" },
  { codigo: "99", nome: "Outros" },
] as const);

// ============================================================================
// CSTs ICMS (Tabela A da NT 2013/005)
// ============================================================================

export const CST_ICMS = Object.freeze([
  { codigo: "00", descricao: "Tributada integralmente" },
  { codigo: "10", descricao: "Tributada e com cobrança do ICMS por substituição tributária" },
  { codigo: "20", descricao: "Com redução de base de cálculo" },
  { codigo: "30", descricao: "Isenta ou não tributada e com cobrança do ICMS por substituição tributária" },
  { codigo: "40", descricao: "Isenta" },
  { codigo: "41", descricao: "Não tributada" },
  { codigo: "50", descricao: "Suspensão" },
  { codigo: "51", descricao: "Diferimento" },
  { codigo: "60", descricao: "ICMS cobrado anteriormente por substituição tributária" },
  { codigo: "70", descricao: "Com redução de base de cálculo e cobrança do ICMS por substituição tributária" },
  { codigo: "90", descricao: "Outras" },
] as const);

// CSTs Simples Nacional (CSOSN)
export const CSOSN_SIMPLES = Object.freeze([
  { codigo: "101", descricao: "Tributada pelo Simples Nacional com permissão de crédito" },
  { codigo: "102", descricao: "Tributada pelo Simples Nacional sem permissão de crédito" },
  { codigo: "103", descricao: "Isenção do ICMS no Simples Nacional para faixa de receita bruta" },
  { codigo: "201", descricao: "Tributada pelo Simples Nacional com permissão de crédito e cobrança ST" },
  { codigo: "202", descricao: "Tributada pelo Simples Nacional sem permissão de crédito e cobrança ST" },
  { codigo: "203", descricao: "Isenção do ICMS no Simples Nacional para faixa de receita bruta e ST" },
  { codigo: "300", descricao: "Imune" },
  { codigo: "400", descricao: "Não tributada pelo Simples Nacional" },
  { codigo: "500", descricao: "ICMS cobrado anteriormente por substituição tributária ou por antecipação" },
  { codigo: "900", descricao: "Outros" },
] as const);

// ============================================================================
// CSTs PIS/COFINS (resumido)
// ============================================================================

export const CST_PIS_COFINS = Object.freeze([
  { codigo: "01", descricao: "Operação Tributável com Alíquota Básica" },
  { codigo: "02", descricao: "Operação Tributável com Alíquota Diferenciada" },
  { codigo: "03", descricao: "Operação Tributável com Alíquota por Unidade de Medida de Produto" },
  { codigo: "04", descricao: "Operação Tributável Monofásica - Revenda a Alíquota Zero" },
  { codigo: "05", descricao: "Operação Tributável por Substituição Tributária" },
  { codigo: "06", descricao: "Operação Tributável a Alíquota Zero" },
  { codigo: "07", descricao: "Operação Isenta da Contribuição" },
  { codigo: "08", descricao: "Operação sem Incidência da Contribuição" },
  { codigo: "09", descricao: "Operação com Suspensão da Contribuição" },
  { codigo: "49", descricao: "Outras Operações de Saída" },
  { codigo: "99", descricao: "Outras Operações" },
] as const);

// ============================================================================
// HELPER: SUGERIR CFOP A PARTIR DE UF EMITENTE/DESTINATÁRIO
// ============================================================================

export function sugerirCFOPVenda(
  ufEmitente: string,
  ufDestinatario: string,
  contribuinte: boolean = true
): string {
  const interno = ufEmitente === ufDestinatario;
  if (interno) return "5102";              // Venda interna padrão
  if (contribuinte) return "6102";         // Venda interestadual contribuinte
  return "6108";                            // Venda interestadual consumidor final
}

// ============================================================================
// HELPER: GERAR NATUREZA DA OPERAÇÃO PADRÃO
// ============================================================================

export function naturezaOperacaoPadrao(cfop: string): string {
  const found = [...CFOPS_VENDA, ...CFOPS_DEVOLUCAO].find((c) => c.codigo === cfop);
  return found?.natureza ?? "Venda";
}

// ============================================================================
// VALIDAR NCM (8 dígitos)
// ============================================================================

export function validarNCM(ncm: string): boolean {
  const c = ncm.replace(/\D/g, "");
  return c.length === 8;
}

// ============================================================================
// CONVERSORES MONETÁRIOS PARA TRIBUTOS
// ============================================================================

/**
 * Calcula o valor de um tributo aplicando alíquota sobre base.
 * Usado para PIS, COFINS, ICMS, ISS.
 */
export function calcularTributo(base: number, aliquota: number): number {
  return Math.round(base * (aliquota / 100) * 100) / 100;
}

/**
 * Calcula ICMS de operação interestadual com diferencial de alíquota (DIFAL).
 * Aplica-se quando UF origem ≠ UF destino e destinatário é não contribuinte.
 */
export function calcularDIFAL(
  valorOperacao: number,
  aliquotaInterestadual: number,
  aliquotaInterna: number
): { valor_origem: number; valor_destino: number; valor_total: number } {
  const valorInterestadual = calcularTributo(valorOperacao, aliquotaInterestadual);
  const valorInterno = calcularTributo(valorOperacao, aliquotaInterna);
  const difalTotal = Math.max(0, valorInterno - valorInterestadual);

  return {
    valor_origem: valorInterestadual,
    valor_destino: difalTotal,
    valor_total: valorInterestadual + difalTotal,
  };
}
