/**
 * O preço do item NA DATA do documento (30/09/2026).
 *
 * `contrato_itens.valor_unitario` é o preço VIGENTE (depois dos termos
 * aditivos aplicados). A NF-e 595 do 772/2024 é de junho de 2024, antes de
 * qualquer reequilíbrio — e o vínculo mostrava R$ 6,81 (reequilibrado) para
 * um açúcar faturado a R$ 5,20 (preço original). A referência certa é o
 * preço que valia na emissão da nota: original até o primeiro termo com
 * efeitos, depois o do último termo aplicado até aquela data. Quem escolhe
 * um "Aditivo de origem" à mão manda: vale o preço logo depois dele.
 * Puro: a tela só chama.
 */
export type TermoComData = {
  id: string;
  numero_aditivo: string;
  data_efeitos?: string | null;
  data_assinatura?: string | null;
  data_aditivo?: string | null;
};

export type PassoDePreco = {
  aditivo_id: string;
  contrato_item_id: string;
  valor_unitario_novo: number | null;
  aplicado_em?: string | null;
};

export type PrecoDeReferencia = {
  valor: number;
  origem: 'original' | 'termo' | 'vigente';
  /** "contrato original" · "1º TA" · "vigente" */
  rotulo: string;
  /** A data que decidiu (a do documento ou a do termo escolhido). */
  data: string | null;
};

/** A data a partir da qual o termo vale: efeitos, senão assinatura, senão a do registro. */
export function dataDoTermo(t: TermoComData | null | undefined): string | null {
  if (!t) return null;
  return (t.data_efeitos || t.data_assinatura || t.data_aditivo || null)?.slice(0, 10) ?? null;
}

const rotuloDoTermo = (t: TermoComData) => {
  const n = String(t.numero_aditivo ?? '').trim();
  return /^\d+$/.test(n) ? `${n}º TA` : n || 'termo aditivo';
};

export function precoDoItemEm(
  item: { id: string; valor_unitario: number | null; valor_unitario_original?: number | null },
  termos: TermoComData[],
  passos: PassoDePreco[],
  opts: { data?: string | null; origemAditivoId?: string | null } = {},
): PrecoDeReferencia {
  const vigente = Number(item.valor_unitario) || 0;
  const original = item.valor_unitario_original != null && Number(item.valor_unitario_original) > 0
    ? Number(item.valor_unitario_original)
    : null;
  const porId = new Map(termos.map((t) => [t.id, t]));
  const doItem = passos
    .filter((p) => p.contrato_item_id === item.id && p.valor_unitario_novo != null && Number(p.valor_unitario_novo) > 0 && p.aplicado_em)
    .map((p) => ({ p, termo: porId.get(p.aditivo_id) ?? null, data: dataDoTermo(porId.get(p.aditivo_id)) }));

  const escolhido = opts.origemAditivoId ? porId.get(opts.origemAditivoId) ?? null : null;
  const dataLimite = escolhido ? dataDoTermo(escolhido) : (opts.data ? opts.data.slice(0, 10) : null);

  // Sem termo escolhido e sem data: o vigente, como sempre.
  if (!escolhido && !dataLimite) return { valor: vigente, origem: 'vigente', rotulo: 'vigente', data: null };

  const ateAData = doItem
    .filter((x) => (escolhido && x.p.aditivo_id === escolhido.id) || (x.data != null && dataLimite != null && x.data <= dataLimite))
    .sort((a, b) => String(a.data ?? '').localeCompare(String(b.data ?? '')));
  const ultimo = ateAData[ateAData.length - 1];
  if (ultimo) {
    return { valor: Number(ultimo.p.valor_unitario_novo), origem: 'termo', rotulo: ultimo.termo ? rotuloDoTermo(ultimo.termo) : 'termo aditivo', data: dataLimite };
  }
  // Nenhum termo até a data: o preço da contratação. Sem original registrado, o vigente é o único que há.
  if (original != null) return { valor: original, origem: 'original', rotulo: 'contrato original', data: dataLimite };
  return { valor: vigente, origem: 'vigente', rotulo: 'vigente', data: dataLimite };
}

// ─────────────────────────────────────────────────────────────────────────────
// A tabela de preços por termo — o que o dono chamou de "1º TA já com os 18
// itens" (30/09/2026). Cada termo é uma COLUNA acumulada: o item que o termo
// não mexeu carrega o preço da coluna anterior. É a auditoria: quanto cada
// termo mudou em cada item, em R$ e em %.
// ─────────────────────────────────────────────────────────────────────────────

export type ItemParaTabela = { id: string; codigo_item?: string | null; descricao: string; valor_unitario: number | null; valor_unitario_original?: number | null };

export type ColunaDoTermo = { aditivo_id: string; rotulo: string; data: string | null; itensAlterados: number };
export type CelulaDoTermo = { aditivo_id: string; valor: number; mudou: boolean; deltaReais: number; deltaPct: number | null };
export type LinhaDaTabelaDePrecos = { contrato_item_id: string; codigo_item: string | null; descricao: string; original: number; porTermo: CelulaDoTermo[]; vigente: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Os termos na ordem em que valem: data de efeitos/assinatura; sem data, a ordem de chegada. */
export function ordenarTermos<T extends TermoComData>(termos: T[]): T[] {
  return termos.map((t, i) => ({ t, i, d: dataDoTermo(t) })).sort((a, b) => (a.d && b.d ? a.d.localeCompare(b.d) : a.d ? -1 : b.d ? 1 : a.i - b.i)).map((x) => x.t);
}

/** Preço de partida do item: o original registrado; sem registro, o vigente (item nunca alterado). */
const precoOriginal = (item: ItemParaTabela) =>
  item.valor_unitario_original != null && Number(item.valor_unitario_original) > 0 ? Number(item.valor_unitario_original) : Number(item.valor_unitario) || 0;

export function tabelaDePrecosPorTermo(itens: ItemParaTabela[], termos: TermoComData[], passos: PassoDePreco[]): { colunas: ColunaDoTermo[]; linhas: LinhaDaTabelaDePrecos[] } {
  const ordenados = ordenarTermos(termos);
  const aplicados = passos.filter((p) => p.aplicado_em && p.valor_unitario_novo != null && Number(p.valor_unitario_novo) > 0);
  const colunas: ColunaDoTermo[] = ordenados.map((t) => ({
    aditivo_id: t.id, rotulo: rotuloCurto(t), data: dataDoTermo(t),
    itensAlterados: new Set(aplicados.filter((p) => p.aditivo_id === t.id).map((p) => p.contrato_item_id)).size,
  }));
  const linhas = itens.map((item) => {
    const original = precoOriginal(item);
    let anterior = original;
    const porTermo = ordenados.map((t) => {
      const passo = aplicados.find((p) => p.aditivo_id === t.id && p.contrato_item_id === item.id);
      const valor = passo ? Number(passo.valor_unitario_novo) : anterior;
      const cel: CelulaDoTermo = { aditivo_id: t.id, valor, mudou: !!passo, deltaReais: r2(valor - anterior), deltaPct: anterior > 0 ? r2(((valor - anterior) / anterior) * 100) : null };
      anterior = valor;
      return cel;
    });
    return { contrato_item_id: item.id, codigo_item: item.codigo_item ?? null, descricao: item.descricao, original, porTermo, vigente: Number(item.valor_unitario) || 0 };
  });
  return { colunas, linhas };
}

function rotuloCurto(t: TermoComData): string {
  const n = String(t.numero_aditivo ?? '').trim();
  const m = /^(\d+)/.exec(n);
  return m ? `${m[1]}º TA` : n || 'termo aditivo';
}

/** O preço de cada item NA COLUNA do termo escolhido (nulo = contrato original). */
export function precosNoTermo(itens: ItemParaTabela[], termos: TermoComData[], passos: PassoDePreco[], aditivoId: string | null): Map<string, number> {
  const { linhas } = tabelaDePrecosPorTermo(itens, termos, passos);
  const m = new Map<string, number>();
  for (const l of linhas) {
    const cel = aditivoId ? l.porTermo.find((c) => c.aditivo_id === aditivoId) : null;
    m.set(l.contrato_item_id, aditivoId ? (cel ? cel.valor : l.vigente) : l.original);
  }
  return m;
}
