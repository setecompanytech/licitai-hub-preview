/**
 * Regras de estágio do processo usadas pelo módulo de metas.
 *
 * Decisão de negócio: "participado" conta a partir da **proposta enviada**,
 * não da saída do monitoramento. O banco materializa isso em
 * `licitacoes.data_proposta_enviada` (trigger `comercial_marcar_proposta_enviada`);
 * estas funções são o espelho da mesma regra no front, para a interface poder
 * antecipar o comportamento sem consultar o banco.
 */

/** Status a partir dos quais a proposta já foi enviada. */
export const STATUS_POS_PROPOSTA = [
  'Proposta Enviada',
  'Em Disputa',
  'Vencida',
  'Homologada',
  'Perdida',
] as const;

/** O processo já conta como participação? */
export function contaComoParticipacao(status: string | null | undefined): boolean {
  return STATUS_POS_PROPOSTA.includes((status ?? '') as (typeof STATUS_POS_PROPOSTA)[number]);
}

/**
 * A transição exige o registro de motivo de perda?
 * Só a entrada em "Perdida" exige — sair dela, ou permanecer, não.
 */
export function exigeMotivoDePerda(
  statusAtual: string | null | undefined,
  novoStatus: string,
): boolean {
  return novoStatus === 'Perdida' && statusAtual !== 'Perdida';
}
