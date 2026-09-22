/**
 * A empresa como credora da União, e a prospecção federal (Onda 3 do Portal
 * da Transparência, 22/09/2026): leituras puras dos DTOs de despesas por
 * favorecido, recursos recebidos, convênios e emendas.
 */
type Reg = Record<string, unknown>;

const s = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const n = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const x = Number(v.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(x) ? x : null;
  }
  return null;
};
const obj = (v: unknown): Reg => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Reg) : {});

export const FASES = [
  { valor: 1, rotulo: 'Empenhos' },
  { valor: 2, rotulo: 'Liquidações' },
  { valor: 3, rotulo: 'Pagamentos' },
] as const;

export type Fase = 1 | 2 | 3;

export interface DocumentoDeDespesa {
  data: string;
  documento: string;
  documentoResumido: string;
  fase: string;
  especie: string;
  orgao: string;
  orgaoSuperior: string;
  unidadeGestora: string;
  elemento: string;
  observacao: string;
  processo: string;
  valor: number | null;
  /** O documento foi emitido a um intermediário que repassa ao favorecido final. */
  intermediario: boolean;
}

export function documentoDeDespesa(raw: Reg): DocumentoDeDespesa {
  return {
    data: s(raw.data),
    documento: s(raw.documento),
    documentoResumido: s(raw.documentoResumido) || s(raw.documento),
    fase: s(raw.fase),
    especie: s(raw.especie),
    orgao: s(raw.orgao),
    orgaoSuperior: s(raw.orgaoSuperior),
    unidadeGestora: s(raw.ug),
    elemento: s(raw.elemento),
    observacao: s(raw.observacao),
    processo: s(raw.numeroProcesso),
    valor: n(raw.valor),
    intermediario: raw.favorecidoIntermediario === true || s(raw.favorecidoIntermediario).toLowerCase() === 'sim',
  };
}

/** Soma dos valores, ignorando os sem valor. */
export function somaDosValores(docs: Array<{ valor: number | null }>): number {
  return docs.reduce((acc, d) => acc + (d.valor ?? 0), 0);
}

export interface RecursoRecebido {
  anoMes: string;
  orgao: string;
  orgaoSuperior: string;
  unidadeGestora: string;
  valor: number | null;
}

export function recursoRecebido(raw: Reg): RecursoRecebido {
  return {
    anoMes: s(raw.anoMes),
    orgao: s(raw.nomeOrgao),
    orgaoSuperior: s(raw.nomeOrgaoSuperior),
    unidadeGestora: s(raw.nomeUG),
    valor: n(raw.valor),
  };
}

/** "202609" ou "2026-09" ou "09/2026" → "09/2026"; o resto passa como veio. */
export function mesAnoLegivel(anoMes: string): string {
  const t = String(anoMes ?? '').trim();
  let m = t.match(/^(\d{4})-?(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  m = t.match(/^(\d{2})\/(\d{4})$/);
  if (m) return t;
  return t;
}

/** Totais por mês, do mais recente ao mais antigo. */
export function totaisPorMes(recursos: RecursoRecebido[]): Array<{ mes: string; valor: number }> {
  const mapa = new Map<string, number>();
  for (const r of recursos) {
    const chave = r.anoMes;
    mapa.set(chave, (mapa.get(chave) ?? 0) + (r.valor ?? 0));
  }
  return [...mapa.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([mes, valor]) => ({ mes: mesAnoLegivel(mes), valor }));
}

// ── Prospecção: convênios e emendas ─────────────────────────────────────────

export interface ConvenioFederal {
  id: string;
  numero: string;
  objeto: string;
  convenente: string;
  cnpjConvenente: string;
  municipio: string;
  uf: string;
  orgao: string;
  situacao: string;
  valor: number | null;
  valorLiberado: number | null;
  valorUltimaLiberacao: number | null;
  dataUltimaLiberacao: string;
  fimVigencia: string;
}

export function convenioFederal(raw: Reg): ConvenioFederal {
  const dim = obj(raw.dimConvenio);
  const conv = obj(raw.convenente);
  const mun = obj(raw.municipioConvenente);
  return {
    id: s(raw.id),
    numero: s(dim.numero) || s(raw.numero),
    objeto: s(dim.objeto) || s(raw.objeto),
    convenente: s(conv.nome) || s(conv.razaoSocialReceita),
    cnpjConvenente: s(conv.cnpjFormatado) || s(conv.cpfFormatado),
    municipio: s(mun.nomeIBGE),
    uf: s(mun.uf),
    orgao: s(obj(raw.orgao).nome),
    situacao: s(raw.situacao),
    valor: n(raw.valor),
    valorLiberado: n(raw.valorLiberado),
    valorUltimaLiberacao: n(raw.valorDaUltimaLiberacao),
    dataUltimaLiberacao: s(raw.dataUltimaLiberacao),
    fimVigencia: s(raw.dataFinalVigencia),
  };
}

export interface EmendaFederal {
  codigo: string;
  ano: string;
  tipo: string;
  autor: string;
  numero: string;
  localidade: string;
  funcao: string;
  subfuncao: string;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
}

export function emendaFederal(raw: Reg): EmendaFederal {
  return {
    codigo: s(raw.codigoEmenda),
    ano: s(raw.ano),
    tipo: s(raw.tipoEmenda),
    autor: s(raw.nomeAutor) || s(raw.autor),
    numero: s(raw.numeroEmenda),
    localidade: s(raw.localidadeDoGasto),
    funcao: s(raw.funcao),
    subfuncao: s(raw.subfuncao),
    empenhado: n(raw.valorEmpenhado),
    liquidado: n(raw.valorLiquidado),
    pago: n(raw.valorPago),
  };
}

/** A localidade do gasto fala da UF? "BELÉM - PA", "PARÁ (UF)", "Nacional" não. */
export function emendaEhDaUf(emenda: EmendaFederal, uf: string, nomeDaUf: string): boolean {
  const loc = emenda.localidade.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  const sigla = uf.toLowerCase();
  const nome = nomeDaUf.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  return new RegExp(`(^|[^a-z])${sigla}([^a-z]|$)`).test(loc) || (nome.length > 0 && loc.includes(nome));
}

/** As funções de governo que viram compra de fornecedor. Códigos SIAFI. */
export const FUNCOES_DE_GOVERNO: ReadonlyArray<{ codigo: string; rotulo: string }> = [
  { codigo: '12', rotulo: 'Educação' },
  { codigo: '10', rotulo: 'Saúde' },
  { codigo: '08', rotulo: 'Assistência social' },
  { codigo: '04', rotulo: 'Administração' },
  { codigo: '06', rotulo: 'Segurança pública' },
  { codigo: '15', rotulo: 'Urbanismo' },
  { codigo: '17', rotulo: 'Saneamento' },
  { codigo: '20', rotulo: 'Agricultura' },
  { codigo: '26', rotulo: 'Transporte' },
  { codigo: '27', rotulo: 'Desporto e lazer' },
];

export const NOMES_DAS_UFS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
