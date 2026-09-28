/**
 * A situação de um item do contrato para os seletores de pedido e de empenho
 * (28/09/2026): qual foi o último termo aditivo APLICADO a ele.
 *
 * O seletor rotulava pela camada (`origem_aditivo_id`): "Contrato Original"
 * para toda linha criada pelo contrato. Como o termo aditivo, desde 26/09,
 * altera a MESMA linha (preço, quantidade), todo item lia "Contrato Original"
 * depois de três termos — o rótulo dizia quem criou a linha, não o que ela
 * vale. Aqui a fonte é `contrato_aditivo_itens` aplicada, a mesma da coluna
 * Situação em Itens/Lotes. Puro: a tela só chama.
 */
import { rotuloCurtoDoTermo } from '@/lib/contratos/itens-do-termo';

export type LinhaAplicada = {
  contrato_item_id: string | null;
  aditivo_id: string;
  numero_aditivo: string | null;
  aplicado_em: string | null;
};
export type SituacaoDoItem = { aditivoId: string; rotulo: string; rotuloCurto: string; aplicadoEm: string | null };

/** Por item, o termo aplicado mais recente (pela data de aplicação; empate = ordem de chegada). */
export function situacaoPorItem(linhas: LinhaAplicada[]): Map<string, SituacaoDoItem> {
  const r = new Map<string, SituacaoDoItem>();
  const ordenadas = [...linhas].filter((l) => l.contrato_item_id && l.aplicado_em)
    .sort((a, b) => String(a.aplicado_em).localeCompare(String(b.aplicado_em)));
  for (const l of ordenadas) {
    r.set(l.contrato_item_id!, {
      aditivoId: l.aditivo_id, rotulo: l.numero_aditivo ?? 'Termo aditivo', rotuloCurto: rotuloCurtoDoTermo(l.numero_aditivo), aplicadoEm: l.aplicado_em,
    });
  }
  return r;
}

// Espaço comum depois do R$ (o Intl põe um não separável, que quebra busca e teste).
const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');

/** "3º TA · R$ 6,81" para item atualizado por termo; "Original · R$ 5,04" para item nunca alterado. */
export function rotuloDoItemNoSeletor(item: { valor_unitario: number | null }, situacao: SituacaoDoItem | null | undefined): string {
  return `${situacao ? situacao.rotuloCurto : 'Original'} · ${brl(Number(item.valor_unitario) || 0)}`;
}

export const FILTRO_TODOS = '__todos__';
export const FILTRO_ORIGINAL = '__original__';

/** Filtro do seletor: todos, só os nunca alterados, ou só os atualizados por um termo. */
export function filtrarPorSituacao<T extends { id: string }>(itens: T[], situacoes: Map<string, SituacaoDoItem>, filtro: string): T[] {
  if (!filtro || filtro === FILTRO_TODOS) return itens;
  if (filtro === FILTRO_ORIGINAL) return itens.filter((i) => !situacoes.has(i.id));
  return itens.filter((i) => situacoes.get(i.id)?.aditivoId === filtro);
}

/** Os termos que aparecem no filtro: só os que responderam pela situação de algum item, na ordem de aplicação. */
export function termosDoFiltro(situacoes: Map<string, SituacaoDoItem>): Array<{ id: string; rotulo: string; rotuloCurto: string; itens: number }> {
  const por = new Map<string, { id: string; rotulo: string; rotuloCurto: string; itens: number; primeiro: string }>();
  for (const s of situacoes.values()) {
    const t = por.get(s.aditivoId);
    if (t) t.itens += 1; else por.set(s.aditivoId, { id: s.aditivoId, rotulo: s.rotulo, rotuloCurto: s.rotuloCurto, itens: 1, primeiro: s.aplicadoEm ?? '' });
  }
  return [...por.values()].sort((a, b) => a.primeiro.localeCompare(b.primeiro)).map(({ primeiro: _p, ...t }) => t);
}
