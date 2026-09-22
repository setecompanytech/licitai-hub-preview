/**
 * Itens do PNCP — o preço UNITÁRIO por item, ao lado do valor GLOBAL do
 * edital (22/09/2026).
 *
 * O acervo (`pncp_editais_cache`) guarda o edital: `valor_total_estimado` é
 * o processo inteiro, todos os itens juntos. O preço de "carne moída" está
 * no ITEM, que a API pública do PNCP entrega por edital:
 *   /orgaos/{cnpj}/compras/{ano}/{seq}/itens            → unitário ESTIMADO
 *   /orgaos/{cnpj}/compras/{ano}/{seq}/itens/{n}/resultados → unitário HOMOLOGADO
 * Este módulo é a porta única para as duas rotas: a leitura dos DTOs, o
 * casamento do item com o objeto pesquisado e as URLs. Quem chama decide o
 * cache (edge `itens-do-acervo-pncp`, tabela `pncp_editais_itens`).
 *
 * Sem `Deno.*` de propósito: o `fetch` entra por parâmetro e o módulo é
 * testado pelo vitest do front (src/lib/mercado/__tests__/pncp-itens.test.ts).
 * Regra operacional do portal: sem rajadas — quem chama espaça as chamadas.
 */
export const PNCP_API = "https://pncp.gov.br/api/pncp/v1";
export const ESPACO_ENTRE_CHAMADAS_MS = 300;
export const CABECALHOS_PNCP = { Accept: "application/json", "User-Agent": "Praefectus/1.0 (licitacoes@praefectus.com.br)" };

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export type Registro = Record<string, unknown>;

/** O que identifica a compra no PNCP, como o acervo guarda. */
export interface CompraDoAcervo {
  pncp_id: string;
  cnpj_orgao: string;
  ano_compra: string;
  sequencial_compra: string;
}

/** Uma linha de `pncp_editais_itens`. */
export interface ItemDoAcervo {
  pncp_id: string;
  cnpj_orgao: string;
  ano_compra: string;
  sequencial_compra: string;
  numero_item: number;
  descricao: string;
  unidade: string | null;
  quantidade: number | null;
  valor_unitario_estimado: number | null;
  valor_total_estimado: number | null;
  situacao: string | null;
  tem_resultado: boolean;
  valor_unitario_homologado: number | null;
  valor_total_homologado: number | null;
  quantidade_homologada: number | null;
  fornecedor: string | null;
  cnpj_fornecedor: string | null;
  data_resultado: string | null;
  ncm: string | null;
  categoria: string | null;
}

const s = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

/** Número da API (JSON numérico) ou texto brasileiro ("1.234,56"); o resto é null. */
export function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const t = v.trim();
  const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(x) ? x : null;
}

export const digitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** cnpj, ano e sequencial como a rota pede (sequencial sem zeros à esquerda). */
export function coordenadas(c: CompraDoAcervo): { cnpj: string; ano: string; seq: string } {
  const seqDigitos = digitos(c.sequencial_compra);
  return {
    cnpj: digitos(c.cnpj_orgao),
    ano: digitos(c.ano_compra).slice(0, 4),
    seq: seqDigitos ? String(Number(seqDigitos)) : s(c.sequencial_compra),
  };
}

export function urlDosItens(c: CompraDoAcervo, pagina = 1, tamanho = 100): string {
  const { cnpj, ano, seq } = coordenadas(c);
  return `${PNCP_API}/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=${pagina}&tamanhoPagina=${tamanho}`;
}

export function urlDoResultado(c: CompraDoAcervo, numeroItem: number): string {
  const { cnpj, ano, seq } = coordenadas(c);
  return `${PNCP_API}/orgaos/${cnpj}/compras/${ano}/${seq}/itens/${numeroItem}/resultados`;
}

export function urlDoEditalNoPortal(c: CompraDoAcervo): string {
  const { cnpj, ano, seq } = coordenadas(c);
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`;
}

/** "02/10/2025", "2025-10-02T00:00:00" → "2025-10-02"; o resto é null. */
export function dataIso(v: unknown): string | null {
  const t = s(v);
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

/** A lista que a API devolve: um array puro, ou embrulhado em `data`/`itens`. */
export function listaDaApi(payload: unknown): Registro[] {
  const ehRegistro = (x: unknown): x is Registro => !!x && typeof x === "object" && !Array.isArray(x);
  if (Array.isArray(payload)) return payload.filter(ehRegistro);
  if (ehRegistro(payload)) {
    if (Array.isArray(payload.data)) return payload.data.filter(ehRegistro);
    if (Array.isArray(payload.itens)) return payload.itens.filter(ehRegistro);
  }
  return [];
}

/** O DTO do item (rota /itens) na forma da tabela. */
export function itemDoAcervo(raw: Registro, c: CompraDoAcervo): ItemDoAcervo {
  const material = raw.materialOuServico && typeof raw.materialOuServico === "object" ? (raw.materialOuServico as Registro) : {};
  return {
    pncp_id: s(c.pncp_id),
    cnpj_orgao: digitos(c.cnpj_orgao),
    ano_compra: s(c.ano_compra),
    sequencial_compra: s(c.sequencial_compra),
    numero_item: Number(raw.numeroItem) || 0,
    descricao: s(raw.descricao) || s(material.descricao),
    unidade: s(raw.unidadeMedida) || null,
    quantidade: numero(raw.quantidade),
    valor_unitario_estimado: numero(raw.valorUnitarioEstimado),
    valor_total_estimado: numero(raw.valorTotal),
    situacao: s(raw.situacaoCompraItemNome) || null,
    tem_resultado: raw.temResultado === true,
    valor_unitario_homologado: null,
    valor_total_homologado: null,
    quantidade_homologada: null,
    fornecedor: null,
    cnpj_fornecedor: null,
    data_resultado: null,
    ncm: s(raw.ncmNbsCodigo) || null,
    categoria: s(raw.itemCategoriaNome) || null,
  };
}

/** O DTO do resultado (rota /resultados) aplicado ao item: o homologado ao vencedor. */
export function comResultado(item: ItemDoAcervo, res: Registro | null): ItemDoAcervo {
  if (!res) return item;
  return {
    ...item,
    tem_resultado: true,
    valor_unitario_homologado: numero(res.valorUnitarioHomologado),
    valor_total_homologado: numero(res.valorTotalHomologado),
    quantidade_homologada: numero(res.quantidadeHomologada),
    fornecedor: s(res.nomeRazaoSocialFornecedor) || null,
    cnpj_fornecedor: digitos(res.niFornecedor) || null,
    data_resultado: dataIso(res.dataResultado),
  };
}

/**
 * Entre os resultados de um item, o que vale: sem cancelamento e, no
 * registro de preços, o primeiro classificado.
 */
export function resultadoQueVale(lista: Registro[]): Registro | null {
  const validos = lista.filter((r) => !s(r.dataCancelamento));
  const ordenados = [...validos].sort(
    (a, b) => (Number(a.ordemClassificacaoSrp) || 1) - (Number(b.ordemClassificacaoSrp) || 1),
  );
  return ordenados[0] ?? null;
}

/** Todos os itens da compra, paginados; 404 é "sem itens", não erro. */
export async function itensDaCompra(
  c: CompraDoAcervo,
  fetcher: Fetcher = fetch,
  maxPaginas = 5,
): Promise<{ itens: ItemDoAcervo[]; erro?: string }> {
  const itens: ItemDoAcervo[] = [];
  const vistos = new Set<number>();
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    let r: Response;
    try {
      r = await fetcher(urlDosItens(c, pagina), { headers: CABECALHOS_PNCP });
    } catch (e) {
      return { itens, erro: e instanceof Error ? e.message : String(e) };
    }
    if (r.status === 404 || r.status === 204) break;
    if (!r.ok) return { itens, erro: `HTTP ${r.status}` };
    const lista = listaDaApi(await r.json());
    for (const raw of lista) {
      const item = itemDoAcervo(raw, c);
      if (item.numero_item <= 0 || vistos.has(item.numero_item)) continue;
      vistos.add(item.numero_item);
      itens.push(item);
    }
    if (lista.length < 100) break;
  }
  return { itens };
}

/** O resultado que vale para o item, ou null (sem resultado, ou API fora). */
export async function resultadoDoItem(c: CompraDoAcervo, numeroItem: number, fetcher: Fetcher = fetch): Promise<Registro | null> {
  try {
    const r = await fetcher(urlDoResultado(c, numeroItem), { headers: CABECALHOS_PNCP });
    if (!r.ok) return null;
    return resultadoQueVale(listaDaApi(await r.json()));
  } catch {
    return null;
  }
}

// ── O casamento do item com o objeto pesquisado ─────────────────────────────

export const semAcento = (t: string): string => t.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");

/** Palavras que não dizem o que o produto é. */
const VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "para", "com", "sem", "em", "no", "na", "nos", "nas", "por", "e", "ou", "a", "o", "as", "os",
  "tipo", "uso", "und", "unid", "unidade", "kg", "kilo", "quilo", "pct", "pacote", "cx", "caixa", "fardo", "litro", "lt",
]);

/** As palavras do objeto: três letras ou mais, sem acento, sem as vazias, sem repetição. */
export function palavrasDoObjeto(texto: string): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const p of semAcento(texto).split(/[^\p{L}\p{N}]+/u)) {
    if (p.length < 3 || VAZIAS.has(p) || vistas.has(p)) continue;
    vistas.add(p);
    saida.push(p);
  }
  return saida;
}

/**
 * Quantas palavras do objeto a descrição do item traz. Tolera o gênero e o
 * plural ("moída" casa "MOÍDO", "congelada" casa "CONGELADO") pelo radical.
 */
export function palavrasQueBatem(descricao: string, palavras: string[]): number {
  const d = semAcento(descricao);
  let bateu = 0;
  for (const p of palavras) {
    if (d.includes(p) || (p.length >= 5 && d.includes(p.slice(0, -1)))) bateu++;
  }
  return bateu;
}

/**
 * O item fala do objeto? Todas as palavras, com uma de folga a partir de
 * três: "carne moída patinho" aceita "CARNE BOVINA MOÍDA" (sem patinho) e
 * recusa "CARNE DE FRANGO" e "CAFÉ TORRADO E MOÍDO".
 */
export function itemCasa(descricao: string, palavras: string[]): boolean {
  if (palavras.length === 0) return false;
  const exigidas = Math.max(1, palavras.length - (palavras.length >= 3 ? 1 : 0));
  return palavrasQueBatem(descricao, palavras) >= exigidas;
}

export const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
