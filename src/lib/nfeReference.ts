// Referências fiscais para emissão de NF-e
// Base: Manual SEBRAE de Emissão Fiscal + tabelas oficiais SEFAZ

export type CFOPOption = { codigo: string; descricao: string; tipo: "saida" | "entrada"; uf_destino: "mesma" | "outra" | "exterior" };

export const CFOPS_FREQUENTES: CFOPOption[] = [
  // Vendas internas (mesmo estado)
  { codigo: "5101", descricao: "Venda de produção do estabelecimento", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5102", descricao: "Venda de mercadoria adquirida/recebida de terceiros", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5405", descricao: "Venda de mercadoria adquirida — ICMS retido por ST", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5910", descricao: "Remessa em bonificação, doação ou brinde", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5915", descricao: "Remessa para conserto ou reparo", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5916", descricao: "Retorno de mercadoria recebida para conserto", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5202", descricao: "Devolução de compra para industrialização", tipo: "saida", uf_destino: "mesma" },
  { codigo: "5949", descricao: "Outra saída de mercadoria não especificada", tipo: "saida", uf_destino: "mesma" },

  // Vendas interestaduais
  { codigo: "6101", descricao: "Venda de produção do estabelecimento (outra UF)", tipo: "saida", uf_destino: "outra" },
  { codigo: "6102", descricao: "Venda de mercadoria adquirida (outra UF)", tipo: "saida", uf_destino: "outra" },
  { codigo: "6108", descricao: "Venda destinada a não contribuinte (outra UF)", tipo: "saida", uf_destino: "outra" },
  { codigo: "6910", descricao: "Remessa em bonificação/doação/brinde (outra UF)", tipo: "saida", uf_destino: "outra" },
  { codigo: "6949", descricao: "Outra saída não especificada (outra UF)", tipo: "saida", uf_destino: "outra" },

  // Exportação
  { codigo: "7101", descricao: "Venda de produção do estabelecimento (exterior)", tipo: "saida", uf_destino: "exterior" },
  { codigo: "7102", descricao: "Venda de mercadoria adquirida (exterior)", tipo: "saida", uf_destino: "exterior" },
];

export const NATUREZAS_OPERACAO = [
  "Venda de mercadoria adquirida/recebida de terceiros",
  "Venda de produção do estabelecimento",
  "Venda destinada a órgão público",
  "Remessa em bonificação, doação ou brinde",
  "Remessa para conserto ou reparo",
  "Devolução de compra",
  "Transferência entre estabelecimentos",
  "Exportação direta",
];

// CSOSN - Simples Nacional
export const CSOSN_OPCOES = [
  { codigo: "101", descricao: "Tributada com permissão de crédito" },
  { codigo: "102", descricao: "Tributada sem permissão de crédito" },
  { codigo: "103", descricao: "Isenção do ICMS para faixa de receita bruta" },
  { codigo: "201", descricao: "Tributada com cobrança de ICMS por ST" },
  { codigo: "202", descricao: "Tributada sem permissão de crédito e com ICMS-ST" },
  { codigo: "203", descricao: "Isenção do ICMS na faixa e com ICMS-ST" },
  { codigo: "300", descricao: "Imune" },
  { codigo: "400", descricao: "Não tributada" },
  { codigo: "500", descricao: "ICMS cobrado anteriormente por ST ou antecipação" },
  { codigo: "900", descricao: "Outros (mais comum em devoluções)" },
];

// CST - Lucro Real / Presumido
export const CST_ICMS_OPCOES = [
  { codigo: "00", descricao: "Tributada integralmente" },
  { codigo: "10", descricao: "Tributada e com cobrança de ICMS por ST" },
  { codigo: "20", descricao: "Com redução de base de cálculo" },
  { codigo: "30", descricao: "Isenta ou não tributada com cobrança de ICMS por ST" },
  { codigo: "40", descricao: "Isenta" },
  { codigo: "41", descricao: "Não tributada" },
  { codigo: "50", descricao: "Suspensão" },
  { codigo: "51", descricao: "Diferimento" },
  { codigo: "60", descricao: "ICMS cobrado anteriormente por ST" },
  { codigo: "70", descricao: "Com redução de base e cobrança de ICMS por ST" },
  { codigo: "90", descricao: "Outras" },
];

export const ORIGEM_MERCADORIA = [
  { codigo: "0", descricao: "Nacional" },
  { codigo: "1", descricao: "Estrangeira — importação direta" },
  { codigo: "2", descricao: "Estrangeira — adquirida no mercado interno" },
  { codigo: "3", descricao: "Nacional com mais de 40% de conteúdo importado" },
  { codigo: "4", descricao: "Nacional produzida com processos de Lei 8.387/91" },
  { codigo: "5", descricao: "Nacional com até 40% de conteúdo importado" },
  { codigo: "6", descricao: "Estrangeira de importação direta sem similar" },
  { codigo: "7", descricao: "Estrangeira adquirida no mercado interno sem similar" },
  { codigo: "8", descricao: "Nacional com Conteúdo de Importação superior a 70%" },
];

export const UNIDADES_COMERCIAIS = [
  "UN", "PC", "CX", "KG", "G", "L", "ML", "M", "M2", "M3", "PAR", "DZ", "GRAMAS", "GF", "PCT", "SC", "TON",
];

export const FRETE_MODALIDADES = [
  { codigo: "0", descricao: "Por conta do remetente (CIF)" },
  { codigo: "1", descricao: "Por conta do destinatário (FOB)" },
  { codigo: "2", descricao: "Por conta de terceiros" },
  { codigo: "3", descricao: "Próprio por conta do remetente" },
  { codigo: "4", descricao: "Próprio por conta do destinatário" },
  { codigo: "9", descricao: "Sem ocorrência de transporte" },
];

export const FINALIDADES_NFE = [
  { codigo: "1", descricao: "NF-e normal" },
  { codigo: "2", descricao: "NF-e complementar" },
  { codigo: "3", descricao: "NF-e de ajuste" },
  { codigo: "4", descricao: "Devolução / retorno" },
];

export const PRESENCA_COMPRADOR = [
  { codigo: "0", descricao: "Não se aplica" },
  { codigo: "1", descricao: "Operação presencial" },
  { codigo: "2", descricao: "Operação não presencial — Internet" },
  { codigo: "3", descricao: "Operação não presencial — Teleatendimento" },
  { codigo: "4", descricao: "NFC-e em entrega a domicílio" },
  { codigo: "9", descricao: "Operação não presencial — outros" },
];

// Etapas SEBRAE para emissão de NF-e
export const ETAPAS_EMISSAO = [
  { id: "natureza", titulo: "Natureza da operação", descricao: "Defina o CFOP e a finalidade da nota." },
  { id: "emitente", titulo: "Dados do emitente", descricao: "Carregados automaticamente da empresa ativa." },
  { id: "destinatario", titulo: "Destinatário", descricao: "Busca automática por CPF/CNPJ via BrasilAPI." },
  { id: "produtos", titulo: "Produtos / Serviços", descricao: "NCM, valor, quantidade e descrição." },
  { id: "tributos", titulo: "Dados fiscais", descricao: "ICMS, IPI, PIS, COFINS conforme regime." },
  { id: "transporte", titulo: "Transporte", descricao: "Modalidade de frete e transportador." },
  { id: "validar", titulo: "Validar e transmitir", descricao: "Assinatura digital e envio à SEFAZ." },
  { id: "danfe", titulo: "DANFE", descricao: "Após autorização, gere o PDF do DANFE." },
];
