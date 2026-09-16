/**
 * A compra do Compras.gov a partir do que o operador sabe: UASG, número e ano.
 *
 * Fase 6 do robô (checklist do grupo, 14/09/2026): "extrair os itens do edital
 * no lançamento manual da nova sessão" e "retornar dados da licitação para
 * complementar as informações".
 *
 * POR QUE OS DADOS ABERTOS DO COMPRAS.GOV, E NÃO O PNCP (conferido em 16/09):
 * - o PNCP não busca por UASG sem o CNPJ do órgão ("Obrigatório que o CNPJ do
 *   órgão seja informado") e levou ~28 s por consulta;
 * - `dadosabertos.compras.gov.br` acha a compra pelo `idCompra` em ~0,5 s e os
 *   itens em ~0,9 s, e devolve junto as coordenadas do PNCP;
 * - a API não libera chamada do navegador (sem Access-Control-Allow-Origin),
 *   por isso a consulta passa por uma edge function.
 *
 * `idCompra` = UASG (6) + modalidade (2) + número (5) + ano (4). O 7/2026 da
 * UASG 925315, pregão: 925315 05 00007 2026. O mesmo número pode existir em
 * modalidades diferentes da mesma UASG, então as três com fase de lances são
 * consultadas e a tela escolhe quando vier mais de uma.
 *
 * Funções puras: o teste do front importa este arquivo direto.
 */

export const MODALIDADES_COM_DISPUTA = [
  { codigo: "05", nome: "Pregão" },
  { codigo: "03", nome: "Concorrência" },
  { codigo: "06", nome: "Dispensa" },
] as const;

export const BASE_DADOS_ABERTOS = "https://dadosabertos.compras.gov.br/modulo-contratacoes";

export function urlDaCompra(idCompra: string): string {
  return `${BASE_DADOS_ABERTOS}/1.1_consultarContratacoes_PNCP_14133_Id?tipo=idCompra&codigo=${idCompra}`;
}

export function urlDosItens(idCompra: string, pagina: number): string {
  return `${BASE_DADOS_ABERTOS}/2.1_consultarItensContratacoes_PNCP_14133_Id?tipo=idCompra&codigo=${idCompra}&pagina=${pagina}`;
}

/**
 * "07/2026", "90012/2025", "PE 7/2026" → número e ano. O Compras.gov numera a
 * compra com até 5 dígitos; mais que isso não é número de compra de lá.
 */
export function lerNumeroEAno(edital: string | null | undefined): { numero: number; ano: number } | null {
  const m = String(edital ?? "").match(/(\d{1,6})\s*\/\s*(\d{4})/);
  if (!m) return null;
  const numero = Number(m[1]);
  const ano = Number(m[2]);
  if (!(numero > 0) || numero > 99999 || ano < 2000 || ano > 2100) return null;
  return { numero, ano };
}

export function uasgValida(uasg: string | null | undefined): string | null {
  const limpa = String(uasg ?? "").replace(/\D/g, "");
  return limpa.length === 6 ? limpa : null;
}

export function idDaCompra(uasg: string, modalidade: string, numero: number, ano: number): string {
  return `${uasg}${modalidade}${String(numero).padStart(5, "0")}${ano}`;
}

/**
 * As datas chegam SEM fuso, no horário de Brasília ("2026-09-14T08:59:00").
 * Gravadas cruas, o banco as lê como UTC e o prazo aparece 3 horas adiantado —
 * o defeito achado nos processos vindos do PNCP em 16/09. Aqui o fuso é dito.
 */
export function instanteDeBrasilia(texto: unknown): string | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  const t = texto.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(t)) return t;
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  if (!m[2]) return `${m[1]}T00:00:00-03:00`;
  return `${m[1]}T${m[2]}:${m[3] ?? "00"}-03:00`;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface ItemDaCompra {
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  /** Nulo quando o orçamento é sigiloso — a API manda 0, que não é o valor. */
  valorUnitarioEstimado: number | null;
  sigiloso: boolean;
  /** "Grupo 2" quando a compra agrupa itens; nulo quando o item é disputado sozinho. */
  grupo: string | null;
  beneficio: string | null;
  situacao: string | null;
  criterio: string | null;
  materialOuServico: string | null;
}

export function itemDaCompra(bruto: Record<string, unknown>): ItemDaCompra | null {
  const n = numero(bruto.numeroItemCompra) ?? numero(bruto.numeroItemPncp);
  if (n === null) return null;
  const sigiloso = bruto.orcamentoSigiloso === true;
  const estimado = numero(bruto.valorUnitarioEstimado);
  const grupo = numero(bruto.numeroGrupo);
  return {
    numero: n,
    descricao: texto(bruto.descricaoResumida) ?? texto(bruto.descricaodetalhada) ?? `Item ${n}`,
    quantidade: numero(bruto.quantidade) ?? 1,
    unidade: texto(bruto.unidadeMedida) ?? "UN",
    valorUnitarioEstimado: sigiloso || !(estimado && estimado > 0) ? null : estimado,
    sigiloso,
    grupo: grupo && grupo > 0 ? `Grupo ${grupo}` : null,
    beneficio: texto(bruto.tipoBeneficioNome),
    situacao: texto(bruto.situacaoCompraItemNome),
    criterio: texto(bruto.criterioJulgamentoNome),
    materialOuServico: texto(bruto.materialOuServicoNome),
  };
}

export interface CompraDoComprasGov {
  idCompra: string;
  uasg: string;
  numero: number;
  ano: number;
  modalidade: string;
  orgao: string | null;
  unidade: string | null;
  uf: string | null;
  municipio: string | null;
  objeto: string | null;
  srp: boolean;
  modoDisputa: string | null;
  criterio: string | null;
  situacao: string | null;
  processo: string | null;
  /** Instantes com fuso de Brasília (ver `instanteDeBrasilia`). */
  aberturaPropostas: string | null;
  encerramentoPropostas: string | null;
  numeroControlePncp: string | null;
  urlPncp: string | null;
  /** Coordenadas da compra no PNCP — é por elas que se acham os arquivos publicados. */
  cnpjOrgao: string | null;
  anoPncp: number | null;
  sequencialPncp: number | null;
  itens: ItemDaCompra[];
}

export function compraDoComprasGov(
  bruta: Record<string, unknown>,
  itensBrutos: Record<string, unknown>[],
): CompraDoComprasGov {
  const itens = itensBrutos
    .map(itemDaCompra)
    .filter((i): i is ItemDaCompra => i !== null)
    .sort((a, b) => a.numero - b.numero);
  // O critério é por item na API; quando todos concordam, vira o da compra.
  const criterios = [...new Set(itens.map((i) => i.criterio).filter(Boolean))];
  const cnpj = texto(bruta.orgaoEntidadeCnpj);
  const ano = numero(bruta.anoCompraPncp);
  const seq = numero(bruta.sequencialCompraPncp);
  const idCompra = texto(bruta.idCompra) ?? "";
  return {
    idCompra,
    uasg: texto(bruta.unidadeOrgaoCodigoUnidade) ?? idCompra.slice(0, 6),
    numero: Number(texto(bruta.numeroCompra) ?? idCompra.slice(8, 13)),
    ano: Number(idCompra.slice(13, 17)) || (ano ?? 0),
    modalidade: texto(bruta.modalidadeNome) ?? "",
    orgao: texto(bruta.orgaoEntidadeRazaoSocial),
    unidade: texto(bruta.unidadeOrgaoNomeUnidade),
    uf: texto(bruta.unidadeOrgaoUfSigla),
    municipio: texto(bruta.unidadeOrgaoMunicipioNome),
    objeto: texto(bruta.objetoCompra),
    srp: bruta.srp === true,
    modoDisputa: texto(bruta.modoDisputaNomePncp),
    criterio: criterios.length === 1 ? criterios[0] : null,
    situacao: texto(bruta.situacaoCompraNomePncp),
    processo: texto(bruta.processo),
    aberturaPropostas: instanteDeBrasilia(bruta.dataAberturaPropostaPncp),
    encerramentoPropostas: instanteDeBrasilia(bruta.dataEncerramentoPropostaPncp),
    numeroControlePncp: texto(bruta.numeroControlePNCP),
    urlPncp: cnpj && ano && seq ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : null,
    cnpjOrgao: cnpj,
    anoPncp: ano,
    sequencialPncp: seq,
    itens,
  };
}
