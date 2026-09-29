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
 */
export function sugerirPartes(itensMarcados: ItemMarcado[], itensDaNota: ItemDaNota[] | null | undefined, partesAtuais: ParteDoVinculo[] = []): ParteDoVinculo[] {
  const usados = new Set<number>();
  return itensMarcados.map((item) => {
    const atual = partesAtuais.find((p) => p.contrato_item_id === item.id);
    if (atual && atual.quantidade > 0) return atual;
    const toks = new Set(normalizar(item.descricao));
    let melhor = -1; let pontos = 0;
    (itensDaNota ?? []).forEach((n, i) => {
      if (usados.has(i)) return;
      const comuns = normalizar(String(n.descricao ?? '')).filter((t) => toks.has(t)).length;
      if (comuns > pontos) { pontos = comuns; melhor = i; }
    });
    if (melhor >= 0 && pontos > 0) {
      usados.add(melhor);
      const n = itensDaNota![melhor];
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
