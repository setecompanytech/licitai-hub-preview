/**
 * Uma nota, vários itens do contrato (29/09/2026) — como o valor se reparte.
 *
 * O que aconteceu: a NF-e 595 (R$ 17.283,00) foi vinculada aos 18 itens do
 * 772/2024 e a Extração rateou o VALOR pelo saldo de cada item, chamando a
 * função de vínculo 18 vezes — 18 pedidos com a descrição e o preço do
 * primeiro produto da nota, e 18 títulos a receber para uma nota que o
 * órgão paga uma vez só. O rateio por saldo só faz sentido para cota
 * principal + reservada do MESMO produto. Para nota com vários produtos, a
 * pessoa informa quantidade e preço por item, e o título é um só.
 * Puro: as telas só chamam.
 */
export type ParteDoVinculo = { contrato_item_id: string; quantidade: number; valor_unitario: number };
export type Fatia = { contrato_item_id: string; quantidade: number; valor_unitario: number; valor_total: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** As partes informadas item a item valem para TODOS os itens marcados? */
export function partesCompletas(itemIds: string[], partes: ParteDoVinculo[] | null | undefined): boolean {
  if (!partes || partes.length === 0 || itemIds.length < 2) return false;
  return itemIds.every((id) => {
    const p = partes.find((x) => x.contrato_item_id === id);
    return !!p && p.quantidade > 0 && p.valor_unitario > 0;
  });
}

/** Fatias pelas partes informadas: valor = quantidade × unitário, item a item. */
export function fatiasPorPartes(itemIds: string[], partes: ParteDoVinculo[]): Fatia[] {
  return itemIds.map((id) => {
    const p = partes.find((x) => x.contrato_item_id === id)!;
    return { contrato_item_id: id, quantidade: r4(p.quantidade), valor_unitario: r4(p.valor_unitario), valor_total: r2(p.quantidade * p.valor_unitario) };
  });
}

/**
 * Fatias por rateio proporcional (o caminho antigo, para cota principal +
 * reservada): a última fica com o resto para fechar no centavo; a quantidade
 * informada da nota é rateada pela fatia; o unitário é recalculado para
 * fechar com o par (fatia, quantidade).
 */
export function fatiasPorSaldo(itemIds: string[], pesos: number[], valorTotal: number, qtdInformada: number, vuReferencia: number): Fatia[] {
  const somaPesos = pesos.reduce((a, b) => a + b, 0) || itemIds.length;
  let restante = r2(valorTotal);
  return itemIds.map((id, idx) => {
    const ultimo = idx === itemIds.length - 1;
    const fatia = ultimo ? restante : r2((valorTotal * (pesos[idx] ?? 1)) / somaPesos);
    restante = r2(restante - fatia);
    const vu = vuReferencia > 0 ? vuReferencia : valorTotal;
    const qtd = qtdInformada > 0 && valorTotal > 0 ? r4((qtdInformada * fatia) / valorTotal) : vu > 0 ? r4(fatia / vu) : 1;
    const vuCoerente = qtd > 0 ? r4(fatia / qtd) : vu;
    return { contrato_item_id: id, quantidade: qtd || 1, valor_unitario: vuCoerente, valor_total: fatia };
  });
}

export function somaDasFatias(fatias: Array<{ valor_total: number }>): number {
  return r2(fatias.reduce((s, f) => s + (Number(f.valor_total) || 0), 0));
}

/** A soma das partes fecha com a nota? Tolerância de 1 centavo por parte. */
export function diferencaParaANota(fatias: Array<{ valor_total: number }>, valorDaNota: number): { soma: number; diferenca: number; fecha: boolean } {
  const soma = somaDasFatias(fatias);
  const diferenca = r2(soma - valorDaNota);
  return { soma, diferenca, fecha: Math.abs(diferenca) <= 0.01 * Math.max(1, fatias.length) };
}

export type ItemDaNota = { descricao?: string | null; quantidade?: number | null; valor_unitario?: number | null; valor_total?: number | null };
export type ItemMarcado = { id: string; descricao: string; valor_unitario: number | null };

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t.length >= 3);

/**
 * Sugestão de partes: para cada item marcado, procura na nota o produto de
 * descrição mais parecida (palavras em comum) e traz quantidade e unitário;
 * sem par, quantidade 0 e o unitário do contrato, para a pessoa preencher.
 * O casamento é pelo MELHOR par global (maior número de palavras em comum
 * primeiro), para um item não "roubar" a linha que casa melhor com outro.
 */
export function sugerirPartes(itensMarcados: ItemMarcado[], itensDaNota: ItemDaNota[] | null | undefined, partesAtuais: ParteDoVinculo[] = []): ParteDoVinculo[] {
  const linhas = itensDaNota ?? [];
  const toksDasLinhas = linhas.map((n) => normalizar(String(n.descricao ?? '')));
  const pares: Array<{ item: number; linha: number; pontos: number }> = [];
  itensMarcados.forEach((item, i) => {
    const atual = partesAtuais.find((p) => p.contrato_item_id === item.id);
    if (atual && atual.quantidade > 0) return;
    const toks = new Set(normalizar(item.descricao));
    toksDasLinhas.forEach((lt, j) => {
      const pontos = lt.filter((t) => toks.has(t)).length;
      if (pontos > 0) pares.push({ item: i, linha: j, pontos });
    });
  });
  pares.sort((a, b) => b.pontos - a.pontos || a.item - b.item || a.linha - b.linha);
  const linhaDoItem = new Map<number, number>();
  const usadas = new Set<number>();
  for (const par of pares) {
    if (linhaDoItem.has(par.item) || usadas.has(par.linha)) continue;
    linhaDoItem.set(par.item, par.linha); usadas.add(par.linha);
  }
  return itensMarcados.map((item, i) => {
    const atual = partesAtuais.find((p) => p.contrato_item_id === item.id);
    if (atual && atual.quantidade > 0) return atual;
    const j = linhaDoItem.get(i);
    if (j != null) {
      const n = linhas[j];
      const qtd = Number(n.quantidade) || 0;
      const vu = Number(n.valor_unitario) || (qtd > 0 && Number(n.valor_total) ? r4(Number(n.valor_total) / qtd) : 0);
      return { contrato_item_id: item.id, quantidade: qtd, valor_unitario: vu > 0 ? vu : Number(item.valor_unitario) || 0 };
    }
    return { contrato_item_id: item.id, quantidade: 0, valor_unitario: Number(item.valor_unitario) || 0 };
  });
}

/** O aviso que a tela mostra quando há mais de dois itens marcados. */
export function avisoDeVariosItens(n: number): string | null {
  if (n <= 2) return null;
  return `${n} itens marcados. O rateio automático divide o VALOR da nota pelo saldo de cada item e repete a descrição e o preço do primeiro produto em todos — foi assim que a NF-e 595 virou 18 pedidos de "açúcar". Para nota com vários produtos, informe quantidade e unitário de cada item abaixo: cada parte nasce com o produto certo e o título a receber é um só.`;
}

/** Linha de produto como o parser da NF-e devolve (`parseNFeXML().itens`). */
export type LinhaDaNfe = { x_prod?: string | null; q_com?: number | null; v_un_com?: number | null; v_prod?: number | null };

/**
 * As linhas da NF-e no formato que a sugestão lê. Sem isto a Extração passava
 * só a SOMA das quantidades (1.000 = todas as linhas) e nenhuma linha: a
 * sugestão não achava par nenhum, todo item ficava com quantidade zero e o
 * unitário "da nota" virava 17.283 ÷ 1.000 = 17,28 para um macarrão de 5,84.
 */
export function linhasDaNfe(itens: LinhaDaNfe[] | null | undefined): ItemDaNota[] {
  return (itens ?? [])
    .filter((i): i is LinhaDaNfe => !!i)
    .map((i) => ({ descricao: String(i.x_prod ?? '').trim() || null, quantidade: Number(i.q_com) || 0, valor_unitario: Number(i.v_un_com) || 0, valor_total: Number(i.v_prod) || 0 }))
    .filter((i) => i.descricao || i.valor_total > 0);
}

export type ItemParaConferir = {
  id: string; descricao: string; codigo_item?: string | null; unidade?: string | null;
  valor_unitario: number | null; saldo_quantitativo: number | null; saldo_financeiro: number | null;
};
export type Divergencia = { level: 'warning' | 'error'; titulo: string; detalhe: string };

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0|\u202f/g, ' ');
const numero = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const curto = (d: string) => (d.length > 40 ? `${d.slice(0, 40).trim()}…` : d);

/** "Item 7" quando o contrato numera; senão a posição na lista. */
export function rotuloDoItem(item: { codigo_item?: string | null }, posicao: number): string {
  const n = String(item.codigo_item ?? '').trim();
  return n ? `Item ${n}` : `Item ${posicao + 1}`;
}

/**
 * Conferência ITEM A ITEM de uma nota com vários produtos. A conferência
 * agregada (unitário da nota ÷ quantidade somada × preço do primeiro item)
 * comparava o preço médio de 18 produtos com o preço de um só e acusava
 * "+195,94%" numa nota correta. Aqui cada parte informada é comparada com o
 * SEU item: unitário (aviso até 5%, erro acima), quantidade e valor contra o
 * saldo do item. Parte sem quantidade ainda não é conferida.
 */
export function divergenciasDasPartes(itens: ItemParaConferir[], partes: ParteDoVinculo[] | null | undefined): Divergencia[] {
  const alertas: Divergencia[] = [];
  itens.forEach((item, idx) => {
    const p = (partes ?? []).find((x) => x.contrato_item_id === item.id);
    if (!p || !(p.quantidade > 0)) return;
    const rotulo = `${rotuloDoItem(item, idx)} · ${curto(item.descricao)}`;
    const vuContrato = Number(item.valor_unitario) || 0;
    if (vuContrato > 0 && p.valor_unitario > 0 && Math.abs(p.valor_unitario - vuContrato) > 0.01) {
      const pct = ((p.valor_unitario - vuContrato) / vuContrato) * 100;
      alertas.push({
        level: Math.abs(pct) > 5 ? 'error' : 'warning',
        titulo: `Unitário difere do contrato — ${rotuloDoItem(item, idx)}`,
        detalhe: `${rotulo}: nota ${moeda(p.valor_unitario)} · contrato ${moeda(vuContrato)} · diferença ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%. O pedido usa o faturado — confira se há reajuste, desconto ou erro do emissor.`,
      });
    }
    const saldoQtd = item.saldo_quantitativo;
    if (saldoQtd != null && p.quantidade - Number(saldoQtd) > 0.0001) {
      alertas.push({
        level: 'error',
        titulo: `Quantidade excede o saldo — ${rotuloDoItem(item, idx)}`,
        detalhe: `${rotulo}: nota ${numero(p.quantidade)} ${item.unidade ?? ''} · saldo ${numero(Number(saldoQtd))} ${item.unidade ?? ''}.`.replace(/\s+\./, '.'),
      });
    }
    const saldoFin = item.saldo_financeiro;
    const valor = r2(p.quantidade * p.valor_unitario);
    if (saldoFin != null && valor - Number(saldoFin) > 0.01) {
      alertas.push({
        level: 'error',
        titulo: `Valor excede o saldo financeiro — ${rotuloDoItem(item, idx)}`,
        detalhe: `${rotulo}: ${moeda(valor)} · saldo financeiro do item ${moeda(Number(saldoFin))}.`,
      });
    }
  });
  return alertas;
}

/**
 * Itens do contrato na ordem NUMÉRICA do item (1, 2, 3…), como na tabela do
 * contrato; sem número, no fim, na ordem em que vieram. A lista vinha por
 * `created_at`, que não é a ordem do documento.
 */
export function ordenarItensDoContrato<T extends { codigo_item?: string | null }>(itens: T[]): T[] {
  const chave = (i: T) => { const n = parseInt(String(i.codigo_item ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER; };
  return itens.map((i, idx) => ({ i, idx })).sort((a, b) => chave(a.i) - chave(b.i) || a.idx - b.idx).map((x) => x.i);
}
