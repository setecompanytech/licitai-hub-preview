/**
 * Preço observado: todo valor carrega NATUREZA e ESTÁGIO (22/09/2026).
 *
 * A aba Preços resumia o total estimado dos editais e chamava de "mediana do
 * edital" sem dizer que era o valor GLOBAL do processo — para "carne moída
 * patinho" a tela dizia R$ 11.941,25 enquanto os itens do PNCP diziam
 * R$ 35,00 por kg. A partir daqui nenhum valor de mercado aparece sem a
 * etiqueta: o que ele mede (global do processo ou unitário do item) e em que
 * estágio (estimado pelo órgão, homologado ao vencedor, registrado em ata,
 * contratado, empenhado, faturado em NF-e). Blocos de natureza diferente não
 * se somam nem se comparam.
 */
export type Natureza = 'global' | 'unitario';
export type Estagio = 'estimado' | 'homologado' | 'registrado' | 'contratado' | 'empenhado' | 'faturado';

export const ROTULO_DA_NATUREZA: Record<Natureza, string> = {
  global: 'Global',
  unitario: 'Unitário',
};

export const ROTULO_DO_ESTAGIO: Record<Estagio, string> = {
  estimado: 'estimado',
  homologado: 'homologado',
  registrado: 'registrado em ata',
  contratado: 'contratado',
  empenhado: 'empenhado',
  faturado: 'faturado em NF-e',
};

const EXPLICACAO_DA_NATUREZA: Record<Natureza, string> = {
  global: 'o processo inteiro, todos os itens juntos',
  unitario: 'um item, por unidade de medida',
};

const EXPLICACAO_DO_ESTAGIO: Record<Estagio, string> = {
  estimado: 'o que o órgão estimou no edital',
  homologado: 'o que o vencedor levou, no resultado publicado',
  registrado: 'o preço registrado na ata',
  contratado: 'o valor do contrato assinado',
  empenhado: 'o que o órgão empenhou',
  faturado: 'o que foi faturado ao órgão em nota fiscal',
};

/** "Global · estimado", "Unitário · homologado". */
export function etiquetaDoValor(natureza: Natureza, estagio: Estagio): string {
  return `${ROTULO_DA_NATUREZA[natureza]} · ${ROTULO_DO_ESTAGIO[estagio]}`;
}

export function explicacaoDoValor(natureza: Natureza, estagio: Estagio): string {
  return `${EXPLICACAO_DA_NATUREZA[natureza]}; ${EXPLICACAO_DO_ESTAGIO[estagio]}`;
}

// ── Os itens do acervo, como a tela lê ─────────────────────────────────────

/** O que a busca por objeto devolve de cada edital, no que os itens precisam. */
export interface EditalDoAcervo {
  pncp_id: string;
  cnpj_orgao: string | null;
  ano_compra: string | null;
  sequencial_compra: string | null;
  orgao?: string | null;
  numero_compra?: string | null;
  data_publicacao_pncp?: string | null;
  url_pncp?: string | null;
}

export interface ItemUnitario {
  pncpId: string;
  numeroItem: number;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  estimado: number | null;
  homologado: number | null;
  situacao: string;
  temResultado: boolean;
  fornecedor: string;
  dataResultado: string;
  orgao: string;
  numeroCompra: string;
  anoCompra: string;
  dataPublicacao: string;
  urlPncp: string;
}

type Reg = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const n = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim()) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
};

/** Uma linha de `pncp_editais_itens` (como a edge devolve) mais o edital que a busca já tinha. */
export function itemUnitario(raw: Reg, edital?: EditalDoAcervo): ItemUnitario {
  return {
    pncpId: s(raw.pncp_id),
    numeroItem: Number(raw.numero_item) || 0,
    descricao: s(raw.descricao),
    unidade: s(raw.unidade),
    quantidade: n(raw.quantidade),
    estimado: n(raw.valor_unitario_estimado),
    homologado: n(raw.valor_unitario_homologado),
    situacao: s(raw.situacao),
    temResultado: raw.tem_resultado === true,
    fornecedor: s(raw.fornecedor),
    dataResultado: s(raw.data_resultado),
    orgao: s(edital?.orgao),
    numeroCompra: s(edital?.numero_compra),
    anoCompra: s(edital?.ano_compra),
    dataPublicacao: s(edital?.data_publicacao_pncp),
    urlPncp: s(edital?.url_pncp),
  };
}

const quantil = (ordenado: number[], p: number): number | null => {
  if (ordenado.length === 0) return null;
  const i = (ordenado.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
};

const positivos = (valores: Array<number | null>): number[] =>
  valores.filter((v): v is number => typeof v === 'number' && v > 0).sort((a, b) => a - b);

export interface EstatisticaUnitaria {
  /** Só os itens com resultado publicado — a âncora, como a Precificação já faz. */
  amostraHomologada: number;
  medianaHomologada: number | null;
  amostraEstimada: number;
  medianaEstimada: number | null;
  q1Estimado: number | null;
  q3Estimado: number | null;
  minimoEstimado: number | null;
  maximoEstimado: number | null;
  editais: number;
  /** As unidades que aparecem, da mais comum à mais rara. */
  unidades: string[];
}

/** A estatística dos itens que casaram: homologados de um lado, estimados do outro, nunca misturados. */
export function estatisticaUnitaria(itens: ItemUnitario[]): EstatisticaUnitaria {
  const homologados = positivos(itens.map((i) => i.homologado));
  const estimados = positivos(itens.map((i) => i.estimado));
  const contagem = new Map<string, number>();
  for (const i of itens) {
    const u = unidadeLegivel(i.unidade);
    if (u) contagem.set(u, (contagem.get(u) ?? 0) + 1);
  }
  return {
    amostraHomologada: homologados.length,
    medianaHomologada: quantil(homologados, 0.5),
    amostraEstimada: estimados.length,
    medianaEstimada: quantil(estimados, 0.5),
    q1Estimado: quantil(estimados, 0.25),
    q3Estimado: quantil(estimados, 0.75),
    minimoEstimado: estimados[0] ?? null,
    maximoEstimado: estimados[estimados.length - 1] ?? null,
    editais: new Set(itens.map((i) => i.pncpId)).size,
    unidades: [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u),
  };
}

/** "Quilo", "QUILOGRAMA", "KG", "Quilogramas" → "kg"; "Unidade"/"UN" → "un"; o resto em minúsculas. */
export function unidadeLegivel(unidade: string): string {
  const u = unidade.trim().toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
  if (!u) return '';
  if (/^(kg|quilo|quilos|quilograma|quilogramas|kilo|kilos)$/.test(u)) return 'kg';
  if (/^(un|und|unid|unidade|unidades)$/.test(u)) return 'un';
  if (/^(l|lt|litro|litros)$/.test(u)) return 'l';
  if (/^(pct|pacote|pacotes)$/.test(u)) return 'pct';
  if (/^(cx|caixa|caixas)$/.test(u)) return 'cx';
  return u;
}

// ── O filtro dos itens: só o homologado, e o ano ────────────────────────────

export type SituacaoDoFiltro = 'homologados' | 'todos';

export interface FiltroDeItens {
  /** `homologados` (padrão): só item com resultado publicado — nem "em andamento", nem orçamento sigiloso. */
  situacao: SituacaoDoFiltro;
  /** 'todos' ou o ano com quatro dígitos, entre os três últimos. */
  ano: string;
}

export const FILTRO_PADRAO: FiltroDeItens = { situacao: 'homologados', ano: 'todos' };

/** Os três últimos anos, do atual para trás — o recorte que o dono pediu (22/09). */
export function anosDoFiltro(hoje = new Date()): string[] {
  const a = hoje.getFullYear();
  return [String(a), String(a - 1), String(a - 2)];
}

/** O ano do item: o da compra; sem ele, o da publicação; sem ela, o do resultado. */
export function anoDoItem(i: ItemUnitario): string {
  return i.anoCompra.slice(0, 4) || i.dataPublicacao.slice(0, 4) || i.dataResultado.slice(0, 4);
}

/** Homologado: há preço do vencedor publicado. */
export const itemHomologado = (i: ItemUnitario): boolean => typeof i.homologado === 'number' && i.homologado > 0;

/** Orçamento sigiloso: o órgão não publicou a estimativa (a API manda zero) e ainda não há resultado. */
export const itemSigiloso = (i: ItemUnitario): boolean => !itemHomologado(i) && !(typeof i.estimado === 'number' && i.estimado > 0);

export function filtrarItens(itens: ItemUnitario[], filtro: FiltroDeItens): ItemUnitario[] {
  return itens.filter((i) =>
    (filtro.situacao === 'todos' || itemHomologado(i))
    && (filtro.ano === 'todos' || anoDoItem(i) === filtro.ano));
}

/** Os itens agrupados pelo edital, na ordem em que os editais vieram. */
export function itensPorEdital(itens: ItemUnitario[]): Map<string, ItemUnitario[]> {
  const mapa = new Map<string, ItemUnitario[]>();
  for (const i of itens) {
    const lista = mapa.get(i.pncpId) ?? [];
    lista.push(i);
    mapa.set(i.pncpId, lista);
  }
  return mapa;
}
