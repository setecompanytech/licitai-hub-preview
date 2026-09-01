/**
 * O número do empenho que entra no recibo do kit de faturamento.
 *
 * O kit imprimia `pedido.numero_pedido` como "NOTA DE EMPENHO nº 001" —
 * herança do modelo antigo, quando nota de empenho era registrada como
 * pedido. Desde a bifurcação de 30/08 pedido nunca mais é empenho, e a linha
 * ficou mentindo num documento que se APRESENTA ao órgão: recibo com número
 * de empenho errado é devolução na certa.
 *
 * ── Duas fontes, na ordem que o dono do produto apontou ─────────────────────
 *
 *   1. O VÍNCULO: `contrato_pedidos.empenho_id → contrato_empenhos.numero`.
 *      É fato estrutural — quem criou o pedido disse de qual empenho ele sai.
 *
 *   2. A PRÓPRIA NOTA: as Informações Complementares no rodapé do DANFE
 *      costumam trazer "NOTA DE EMPENHO: 2025NE000064". É o emissor da nota
 *      declarando o empenho — fonte legítima quando o vínculo não existe.
 *
 * Sem nenhuma das duas, devolve null e o recibo OMITE a menção — inventar
 * número de empenho é pior do que não citar empenho nenhum.
 */

/** "2025NE000064", com espaços ou pontos opcionais no meio. */
const FORMATO_FORTE = /\b(20\d{2})\s*[.-]?\s*NE\s*[.-]?\s*(\d{3,7})\b/i;

/**
 * Número logo após o rótulo "empenho": "EMPENHO Nº 001/2025",
 * "nota de empenho: 4402". Sem o rótulo, dígitos soltos não são empenho.
 */
const COM_ROTULO = /empenho\s*(?:n[ºo°.]?)?\s*[:-]?\s*([A-Z0-9][A-Z0-9/.-]{1,23})/i;

export type OrigemDoEmpenho = 'vinculo' | 'nota';

export function numeroDoEmpenho(fontes: {
  /** `contrato_empenhos.numero` do empenho apontado pelo pedido. */
  doVinculo?: string | null;
  /** Informações complementares da NF-e (infCpl), ou texto equivalente. */
  textoDaNota?: string | null;
}): { numero: string; origem: OrigemDoEmpenho } | null {
  const v = String(fontes.doVinculo ?? '').trim();
  if (v) return { numero: v, origem: 'vinculo' };

  const t = String(fontes.textoDaNota ?? '');
  if (!t.trim()) return null;

  const forte = t.match(FORMATO_FORTE);
  if (forte) {
    // Normaliza "2025 NE 000064" para a grafia contínua do padrão estadual.
    return { numero: `${forte[1]}NE${forte[2]}`.toUpperCase(), origem: 'nota' };
  }

  const rotulado = t.match(COM_ROTULO);
  if (rotulado) {
    const bruto = rotulado[1].replace(/[.,;]+$/, '');
    // "nº" capturado por engano, ou sobra curta demais para ser número.
    if (/^n[ºo°]?$/i.test(bruto) || bruto.length < 2) return null;
    return { numero: bruto.toUpperCase(), origem: 'nota' };
  }

  return null;
}
