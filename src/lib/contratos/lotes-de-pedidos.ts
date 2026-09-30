/**
 * Lote de pedidos (29/09/2026): uma nota rateada em N itens do contrato vira
 * N pedidos no banco (um por item, cada um consumindo o seu saldo), mas para
 * quem lê a aba é UM lançamento — a NF-e 595 do 772/2024 apareceu como 18
 * linhas "595-1 … 595-18 (parte n/18)". Aqui as partes se juntam numa linha
 * de lote; o painel do lote mostra cada parte. Puro: a tela só chama.
 */
export type PedidoDoLote = {
  id: string; numero_pedido: string; descricao: string | null; contrato_item_id: string | null;
  quantidade: number; valor_total: number; data_pedido: string | null; status: string;
  nota_fiscal: string | null; numero_empenho?: string | null; empenho_id?: string | null;
  custo_total?: number | null; lote_id?: string | null;
  /** Unidade composta do lote (30/09): "cesta básica" × quantas a nota entrega. */
  unidade_composta?: string | null; unidades_compostas?: number | null;
};

export type Lote<P extends PedidoDoLote = PedidoDoLote> = {
  id: string;
  numero: string;
  partes: P[];
  valor_total: number;
  custo_total: number | null;
  status: string;
  /** "12 de 18 entregues", quando faz diferença. */
  progresso: string | null;
  data_pedido: string | null;
  nota_fiscal: string | null;
  numero_empenho: string | null;
  empenho_id: string | null;
  unidade_composta: string | null;
  unidades_compostas: number | null;
};

export type LinhaDaTabela<P extends PedidoDoLote> = { tipo: 'pedido'; pedido: P } | { tipo: 'lote'; lote: Lote<P> };

const PARTE = /\s*\(parte\s+\d+\s*\/\s*\d+\)\s*$/i;

/** "595-18" → "595"; sem sufixo, o número inteiro. */
export const numeroBaseDoPedido = (numero: string): string => numero.replace(/-\d+$/, '');

/** A descrição sem o "(parte n/N)". */
export const descricaoSemParte = (d: string | null | undefined): string => String(d ?? '').replace(PARTE, '').trim();

/** Situação do conjunto: todos iguais → ela; senão, cancelado só se todos; entregue só se todos; o resto é parcial. */
export function statusDoLote(partes: Array<{ status: string }>): { status: string; progresso: string | null } {
  const vivas = partes.filter((p) => p.status !== 'cancelado');
  if (partes.length === 0) return { status: 'pendente', progresso: null };
  if (vivas.length === 0) return { status: 'cancelado', progresso: null };
  const entregues = vivas.filter((p) => p.status === 'entregue').length;
  if (entregues === vivas.length) return { status: 'entregue', progresso: vivas.length < partes.length ? `${vivas.length} de ${partes.length} (restante cancelado)` : null };
  if (entregues === 0 && vivas.every((p) => p.status === 'pendente')) return { status: 'pendente', progresso: vivas.length < partes.length ? `${partes.length - vivas.length} de ${partes.length} cancelada(s)` : null };
  return { status: 'parcial', progresso: `${entregues} de ${vivas.length} entregue(s)` };
}

/**
 * Agrupa por `lote_id` (gravado pela Extração de Documentos e pela migration
 * que retroalimentou as partes antigas). Pedidos sem lote ficam soltos. A
 * ordem das linhas segue a primeira aparição de cada lote/pedido.
 */
export function agruparEmLotes<P extends PedidoDoLote>(pedidos: P[]): LinhaDaTabela<P>[] {
  const linhas: LinhaDaTabela<P>[] = [];
  const lotes = new Map<string, Lote<P>>();
  for (const p of pedidos) {
    if (!p.lote_id) { linhas.push({ tipo: 'pedido', pedido: p }); continue; }
    let lote = lotes.get(p.lote_id);
    if (!lote) {
      lote = { id: p.lote_id, numero: numeroBaseDoPedido(p.numero_pedido), partes: [], valor_total: 0, custo_total: null, status: 'pendente', progresso: null, data_pedido: p.data_pedido, nota_fiscal: p.nota_fiscal, numero_empenho: p.numero_empenho ?? null, empenho_id: p.empenho_id ?? null, unidade_composta: null, unidades_compostas: null };
      lotes.set(p.lote_id, lote);
      linhas.push({ tipo: 'lote', lote });
    }
    lote.partes.push(p);
  }
  for (const lote of lotes.values()) {
    // Um lote de uma parte só não é lote: volta a ser pedido comum.
    lote.partes.sort((a, b) => a.numero_pedido.localeCompare(b.numero_pedido, 'pt-BR', { numeric: true }));
    lote.valor_total = Math.round(lote.partes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0) * 100) / 100;
    const custos = lote.partes.map((p) => p.custo_total).filter((c): c is number => c != null);
    lote.custo_total = custos.length > 0 ? Math.round(custos.reduce((s, c) => s + Number(c), 0) * 100) / 100 : null;
    const st = statusDoLote(lote.partes);
    lote.status = st.status; lote.progresso = st.progresso;
    lote.data_pedido = lote.partes.map((p) => p.data_pedido).filter(Boolean).sort()[0] ?? null;
    const comCesta = lote.partes.find((p) => p.unidades_compostas != null && Number(p.unidades_compostas) > 0);
    lote.unidade_composta = comCesta?.unidade_composta ?? null;
    lote.unidades_compostas = comCesta ? Number(comCesta.unidades_compostas) : null;
  }
  return linhas.map((l) => (l.tipo === 'lote' && l.lote.partes.length === 1 ? { tipo: 'pedido', pedido: l.lote.partes[0] } : l));
}

/**
 * O rótulo da linha do lote é a DESCRIÇÃO do lote (30/09): o prefixo antes
 * de " · " nas partes, que "Editar lote" renomeia. Sem prefixo, o número da
 * nota. A contagem de itens saiu: a coluna Quantidade já a diz.
 */
export function rotuloDoLote(lote: Lote): string {
  const base = descricaoSemParte(lote.partes[0]?.descricao);
  const nota = lote.nota_fiscal ? `NF-e ${lote.nota_fiscal}` : `Lote ${lote.numero}`;
  return base.split(' · ')[0].trim() || nota;
}

/** Preço faturado, custo e margem POR unidade composta (cesta), quando o lote sabe quantas entregou. */
export function porUnidadeComposta(lote: Pick<Lote, 'valor_total' | 'custo_total' | 'unidades_compostas'>): { preco: number; custo: number | null; margem: number | null; margemPct: number | null } | null {
  const n = Number(lote.unidades_compostas) || 0;
  if (n <= 0) return null;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const preco = r2(lote.valor_total / n);
  const custo = lote.custo_total != null ? r2(Number(lote.custo_total) / n) : null;
  const margem = custo != null ? r2(preco - custo) : null;
  return { preco, custo, margem, margemPct: margem != null && preco > 0 ? r2((margem / preco) * 100) : null };
}
