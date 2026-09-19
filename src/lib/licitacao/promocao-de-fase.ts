/**
 * Promoção automática de fase — o processo avança sozinho quando um ato da
 * operação prova em que fase ele está.
 *
 * Em 19/09 a agenda do painel cobrava "Atrasado" de processo em disputa: o
 * encerramento das propostas tinha passado, mas o status continuava
 * "Monitorando" porque ninguém foi ao Kanban mover o card. O dono do produto
 * fechou a regra: o sistema não pode depender da atualização manual para saber
 * que o processo está em andamento — os atos da operação já dizem isso.
 *
 * Dois atos promovem, e só para a frente:
 *  - cadastrar sessão de DISPUTA no Robô de Lances → "Em Disputa";
 *  - registrar a proposta como enviada, na aba Proposta → "Proposta Enviada".
 *
 * Nunca volta fase, nunca mexe em decidido (Vencida, Homologada, Perdida) nem
 * em arquivado: desfecho é decisão da pessoa. A promoção passa pelo mesmo
 * caminho da mudança manual (`atualizarStatus`), então deixa trilha de
 * auditoria, mensagem de sistema e notificação como qualquer outra mudança.
 *
 * ATENÇÃO — efeito colateral no banco: o gatilho
 * `comercial_marcar_proposta_enviada` carimba `data_proposta_enviada` na
 * primeira entrada em "Proposta Enviada"/"Em Disputa", e as metas do
 * comercial contam participação a partir daí. Por isso a sessão de
 * ACOMPANHAMENTO (dia anterior, regra do dono em 17/09) não promove:
 * acompanhar uma disputa não é participar dela.
 */
import { faixaDe, normalizarStatus, type StatusProcesso } from './status';
import { prazoDaDisputa } from '@/lib/robo/prazo-da-disputa';

/** Fases às quais a operação promove sozinha. */
export type FaseAlvo = 'Proposta Enviada' | 'Em Disputa';

/**
 * Ordem do funil — só se anda para número maior. Decidido e arquivado ficam
 * fora pela faixa, antes de a ordem ser consultada.
 */
const ORDEM: Record<StatusProcesso, number> = {
  Monitorando: 0,
  'Em Análise': 1,
  'Proposta Enviada': 2,
  'Em Disputa': 3,
  Vencida: 9,
  Homologada: 9,
  Perdida: 9,
  Arquivada: 9,
};

/**
 * O processo pode ser promovido a `alvo`? Só do radar e de "em jogo", e só
 * para a frente: "Em Disputa" não volta a "Proposta Enviada", e um processo
 * já na fase alvo não é tocado (o gatilho do banco nem chega a rodar).
 */
export function podePromover(
  statusAtual: string | null | undefined,
  arquivadoEm: string | null | undefined,
  alvo: FaseAlvo,
): boolean {
  const faixa = faixaDe(statusAtual ?? '', arquivadoEm ?? null);
  if (faixa === 'decidido' || faixa === 'arquivo') return false;
  return ORDEM[normalizarStatus(statusAtual)] < ORDEM[alvo];
}

/**
 * A sessão cadastrada no robô é disputa de verdade — ou só acompanhamento?
 *
 * O diálogo de cadastro já decide isso (`soAcompanhamento`, gravado quando a
 * sessão é de dia anterior); a data da própria sessão é a segunda trava, para
 * o caso de a disputa chegar por outro caminho sem a marca.
 */
export function sessaoDoRoboEhDisputa(
  lance: { soAcompanhamento?: boolean; dataSessao?: string | null; horario?: string | null },
  agora: Date,
): boolean {
  if (lance.soAcompanhamento) return false;
  return prazoDaDisputa({ dataSessao: lance.dataSessao, horario: lance.horario, agora }).tipo !== 'encerrado';
}
