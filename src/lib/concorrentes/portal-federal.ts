/**
 * Portal da Transparência no front (22/09/2026): os nomes de campo da
 * especificação, a estatística de itens de nota fiscal e a ficha federal.
 *
 * A tela de contratos federais lia `valorInicial`, `valorEstimado` e
 * `objeto` da licitação; a especificação chama de `valorInicialCompra`,
 * `valor` e `licitacao.objeto` — e a tela mostrava "Sem descrição" e valor
 * nenhum. Aqui cada leitura aceita o nome da spec e o antigo, nesta ordem.
 */
type Reg = Record<string, unknown>;

const s = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const n = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const limpo = v.replace(/\./g, '').replace(',', '.');
    const x = Number(limpo);
    return Number.isFinite(x) && v.trim() !== '' ? x : null;
  }
  return null;
};
const obj = (v: unknown): Reg => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Reg) : {});

/** "2/2020" → "22020"; "00037/2026" → "372026": só dígitos, sem zeros à esquerda do sequencial. */
export function numeroDaLicitacaoParaApi(numero: string): string {
  const t = String(numero ?? '').trim();
  const m = t.match(/^0*(\d+)\s*\/\s*(\d{4})$/);
  if (m) return `${m[1]}${m[2]}`;
  return t.replace(/\D/g, '');
}

export interface ContratoFederal {
  id: string;
  numero: string;
  objeto: string;
  orgao: string;
  fornecedor: string;
  cnpjFornecedor: string;
  situacao: string;
  modalidade: string;
  valorInicial: number | null;
  valorFinal: number | null;
  vigenciaDe: string;
  vigenciaAte: string;
  processo: string;
}

export function contratoFederal(item: Reg): ContratoFederal {
  const compra = obj(item.compra);
  const ug = obj(item.unidadeGestora);
  const forn = obj(item.fornecedor);
  return {
    id: s(item.id),
    numero: s(item.numero),
    objeto: s(item.objeto) || s(compra.objeto),
    orgao: s(ug.nome) || s(obj(item.orgao).nome),
    fornecedor: s(forn.nome) || s(forn.razaoSocialReceita),
    cnpjFornecedor: s(forn.cnpjFormatado) || s(forn.cpfFormatado),
    situacao: s(item.situacaoContrato),
    modalidade: s(item.modalidadeCompra),
    valorInicial: n(item.valorInicialCompra) ?? n(item.valorInicial),
    valorFinal: n(item.valorFinalCompra) ?? n(item.valorFinal),
    vigenciaDe: s(item.dataInicioVigencia),
    vigenciaAte: s(item.dataFimVigencia),
    processo: s(item.numeroProcesso) || s(compra.numeroProcesso),
  };
}

export interface LicitacaoFederal {
  id: string;
  numero: string;
  /** O número como a API pede nas rotas de participantes e empenhos. */
  numeroParaApi: string;
  objeto: string;
  processo: string;
  modalidade: string;
  codigoModalidade: string;
  codigoUG: string;
  orgao: string;
  valor: number | null;
  dataAbertura: string;
  dataResultado: string;
  situacao: string;
  municipio: string;
}

export function licitacaoFederal(item: Reg): LicitacaoFederal {
  const lic = obj(item.licitacao);
  const modalidade = item.modalidadeLicitacao;
  const mod = obj(modalidade);
  const ug = obj(item.unidadeGestora);
  const mun = obj(item.municipio);
  const numero = s(lic.numero) || s(item.numero);
  return {
    id: s(item.id),
    numero,
    numeroParaApi: numeroDaLicitacaoParaApi(numero),
    objeto: s(lic.objeto) || s(item.objeto),
    processo: s(lic.numeroProcesso) || s(item.numeroProcesso),
    modalidade: s(mod.descricao) || s(modalidade),
    codigoModalidade: s(mod.codigo),
    codigoUG: s(ug.codigo),
    orgao: s(ug.nome) || s(ug.orgaoVinculado),
    valor: n(item.valor) ?? n(item.valorEstimado),
    dataAbertura: s(item.dataAbertura),
    dataResultado: s(item.dataResultadoCompra),
    situacao: s(item.situacaoCompra),
    municipio: s(mun.nomeIBGE) || s(item.municipio),
  };
}

// ── Notas fiscais: preço por item ───────────────────────────────────────────

export interface ItemDeNota {
  descricao: string;
  ncm: string;
  quantidade: number | null;
  unidade: string;
  valorUnitario: number | null;
  valor: number | null;
}

export function itemDeNota(raw: Reg): ItemDeNota {
  return {
    descricao: s(raw.descricaoProdutoServico) || s(raw.descricao),
    ncm: s(raw.codigoNcmSh) || s(raw.ncmSh),
    quantidade: n(raw.quantidade),
    unidade: s(raw.unidade),
    valorUnitario: n(raw.valorUnitario),
    valor: n(raw.valor),
  };
}

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');

/** As palavras do termo com três letras ou mais, sem acento e sem repetição. */
export function palavrasDoTermo(termo: string): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const p of semAcento(termo).split(/[^\p{L}\p{N}]+/u)) {
    if (p.length < 3 || vistas.has(p)) continue;
    vistas.add(p);
    saida.push(p);
  }
  return saida;
}

export interface EstatisticaDeItens {
  itens: ItemDeNota[];
  /** Todas as palavras do termo casaram; se nenhum item casou todas, vale "ao menos uma". */
  casouTodas: boolean;
  amostra: number;
  mediana: number | null;
  minimo: number | null;
  maximo: number | null;
  q1: number | null;
  q3: number | null;
}

const quantil = (ordenado: number[], p: number): number | null => {
  if (ordenado.length === 0) return null;
  const i = (ordenado.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
};

/**
 * Dos itens de todas as notas, os que falam do produto pesquisado, e a
 * estatística do valor unitário: mediana e quartis resistem ao item que
 * veio com preço de lote. Primeiro tenta todas as palavras; se nada casar,
 * ao menos uma — e diz qual das duas réguas valeu.
 */
export function estatisticaDeItens(itens: ItemDeNota[], termo: string): EstatisticaDeItens {
  const palavras = palavrasDoTermo(termo);
  const casa = (item: ItemDeNota, todas: boolean) => {
    const d = semAcento(item.descricao);
    return palavras.length === 0 ? true : todas ? palavras.every((p) => d.includes(p)) : palavras.some((p) => d.includes(p));
  };
  let casouTodas = true;
  let escolhidos = itens.filter((i) => casa(i, true));
  if (escolhidos.length === 0) {
    casouTodas = false;
    escolhidos = itens.filter((i) => casa(i, false));
  }
  const valores = escolhidos
    .map((i) => i.valorUnitario)
    .filter((v): v is number => typeof v === 'number' && v > 0)
    .sort((a, b) => a - b);
  return {
    itens: escolhidos,
    casouTodas,
    amostra: valores.length,
    mediana: quantil(valores, 0.5),
    minimo: valores[0] ?? null,
    maximo: valores[valores.length - 1] ?? null,
    q1: quantil(valores, 0.25),
    q3: quantil(valores, 0.75),
  };
}

// ── A ficha da pessoa jurídica no governo federal ───────────────────────────

export interface FichaFederal {
  favorecidoDespesas?: boolean;
  possuiContratacao?: boolean;
  convenios?: boolean;
  favorecidoTransferencias?: boolean;
  participanteLicitacao?: boolean;
  emitiuNFe?: boolean;
  sancionadoCEIS?: boolean;
  sancionadoCNEP?: boolean;
  sancionadoCEPIM?: boolean;
  sancionadoCEAF?: boolean;
}

export const PRESENCAS_FEDERAIS: ReadonlyArray<{ chave: keyof FichaFederal; rotulo: string }> = [
  { chave: 'possuiContratacao', rotulo: 'Tem contrato federal' },
  { chave: 'participanteLicitacao', rotulo: 'Participou de licitação federal' },
  { chave: 'favorecidoDespesas', rotulo: 'Recebeu pagamento da União' },
  { chave: 'emitiuNFe', rotulo: 'Emitiu NF-e a órgão federal' },
  { chave: 'convenios', rotulo: 'Tem convênio' },
  { chave: 'favorecidoTransferencias', rotulo: 'Recebeu transferência' },
];

export const SANCOES_DA_FICHA: ReadonlyArray<{ chave: keyof FichaFederal; rotulo: string }> = [
  { chave: 'sancionadoCEIS', rotulo: 'Sanção no CEIS' },
  { chave: 'sancionadoCNEP', rotulo: 'Sanção no CNEP' },
  { chave: 'sancionadoCEPIM', rotulo: 'Impedimento no CEPIM' },
  { chave: 'sancionadoCEAF', rotulo: 'Registro no CEAF' },
];

/** Os rótulos das bandeiras acesas, presenças primeiro, sanções depois. */
export function presencasDaFicha(ficha: FichaFederal | null | undefined): { presencas: string[]; sancoes: string[] } {
  if (!ficha) return { presencas: [], sancoes: [] };
  return {
    presencas: PRESENCAS_FEDERAIS.filter((p) => ficha[p.chave] === true).map((p) => p.rotulo),
    sancoes: SANCOES_DA_FICHA.filter((p) => ficha[p.chave] === true).map((p) => p.rotulo),
  };
}
