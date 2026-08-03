/**
 * Apuração do ticket médio por modalidade a partir do histórico de contratos.
 *
 * É o insumo `tickets` do motor de projeção. O motor decide sozinho quando
 * descartar o ticket real e cair no valor-alvo (parâmetro `minAmostraTicket`);
 * aqui a única responsabilidade é medir o que o histórico diz.
 */

import { normalizarModalidade } from './modalidades';
import type { TicketModalidade } from './projecao';

/** Um contrato assinado, como vem de `contratos`. */
export type ContratoHistorico = {
  modalidade: string | null;
  valorGlobalCent: number;
};

/**
 * Agrupa os contratos por modalidade normalizada e devolve ticket e mix.
 *
 * Contrato com valor não positivo é ignorado: não informa ticket e ainda
 * distorceria o mix, dando peso a uma modalidade que não gerou receita.
 *
 * O `mix` é a fatia de CONTRATOS da modalidade, não de valor — o motor usa o
 * ticket ponderado para responder "quanto vale o próximo contrato", e essa é
 * uma média por contrato.
 */
export function apurarTickets(contratos: ContratoHistorico[]): TicketModalidade[] {
  const porModalidade = new Map<string, { amostra: number; somaCent: number }>();

  for (const c of contratos) {
    if (c.valorGlobalCent <= 0) continue;
    const codigo = normalizarModalidade(c.modalidade);
    const atual = porModalidade.get(codigo) ?? { amostra: 0, somaCent: 0 };
    atual.amostra += 1;
    atual.somaCent += c.valorGlobalCent;
    porModalidade.set(codigo, atual);
  }

  const total = [...porModalidade.values()].reduce((s, v) => s + v.amostra, 0);
  if (total === 0) return [];

  return [...porModalidade.entries()]
    .map(([modalidade, v]) => ({
      modalidade,
      amostra: v.amostra,
      ticketCent: Math.round(v.somaCent / v.amostra),
      mix: v.amostra / total,
    }))
    // Maior peso primeiro: é a ordem em que a interface lista a carteira.
    .sort((a, b) => b.mix - a.mix);
}
