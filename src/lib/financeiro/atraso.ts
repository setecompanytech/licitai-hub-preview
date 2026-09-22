import { deDataLocal, hojeLocal } from './data-local';

/**
 * Atraso é DERIVADO na leitura, nunca gravado.
 *
 * O enum `financeiro_status_lancamento` tem `em_atraso`, mas nada o escreve:
 * zero registros nas três empresas auditadas em 21/09/2026. Enquanto isso,
 * cada tela decidia sozinha o que é "vencido":
 *
 *  - o cartão "Em atraso" olhava só `data_vencimento` — e ignorava o título
 *    que nasceu sem vencimento (NF-e sem duplicata, pela Extração);
 *  - o Kanban caía na COMPETÊNCIA quando não havia vencimento, e chamava de
 *    "Vencido" um título que nunca teve prazo;
 *  - a lista filtrava por `status = 'em_atraso'` e devolvia vazio;
 *  - o quadro e o resumo executivo somavam `status === 'em_atraso'` e davam
 *    zero de inadimplência para uma carteira com meses de atraso.
 *
 * Um job que gravasse o status resolveria só a última linha, e criaria uma
 * segunda autoridade (o campo) que envelhece à meia-noite. Aqui a regra é
 * uma, pura, e todos a chamam:
 *
 *   em atraso = em aberto (previsto ou em_atraso) + COM vencimento + vencimento < hoje.
 *
 * Sem vencimento não há atraso — há um título SEM PRAZO, que é outra
 * situação e é dita com esse nome, em vez de ser escondida (no cartão) ou
 * inventada (no Kanban). "Hoje" é o relógio de quem olha (`data-local.ts`).
 */
export type TituloComPrazo = {
  status?: string | null;
  data_vencimento?: string | null;
};

/** Os status que ainda esperam baixa. `em_atraso` continua aceito por leitura. */
export const STATUS_EM_ABERTO = ['previsto', 'em_atraso'] as const;
const PAGO = new Set(['realizado', 'conciliado']);

export function estaPago(t: TituloComPrazo): boolean {
  return PAGO.has(t.status ?? '');
}

/** Nem pago nem cancelado: ainda vai entrar ou sair da conta. */
export function estaEmAberto(t: TituloComPrazo): boolean {
  return !estaPago(t) && t.status !== 'cancelado';
}

/** Dias até o vencimento (negativo = já passou); `null` sem vencimento. */
export function diasParaVencer(t: TituloComPrazo, hoje: string = hojeLocal()): number | null {
  const venc = (t.data_vencimento ?? '').slice(0, 10);
  if (!venc) return null;
  return Math.round((deDataLocal(venc).getTime() - deDataLocal(hoje).getTime()) / 86_400_000);
}

export function estaEmAtraso(t: TituloComPrazo, hoje: string = hojeLocal()): boolean {
  if (!estaEmAberto(t)) return false;
  const dias = diasParaVencer(t, hoje);
  return dias !== null && dias < 0;
}

/** Quantos dias de atraso; zero quando não está em atraso. */
export function diasDeAtraso(t: TituloComPrazo, hoje: string = hojeLocal()): number {
  if (!estaEmAtraso(t, hoje)) return 0;
  return -(diasParaVencer(t, hoje) ?? 0);
}

export type SituacaoDoTitulo =
  | 'pago'
  | 'cancelado'
  | 'em_atraso'
  | 'vence_em_7_dias'
  | 'em_aberto'
  | 'sem_vencimento';

/** A situação que as telas pintam — colunas do Kanban, selo da tabela, chip do calendário. */
export function situacaoDoTitulo(t: TituloComPrazo, hoje: string = hojeLocal()): SituacaoDoTitulo {
  if (estaPago(t)) return 'pago';
  if (t.status === 'cancelado') return 'cancelado';
  const dias = diasParaVencer(t, hoje);
  if (dias === null) return 'sem_vencimento';
  if (dias < 0) return 'em_atraso';
  if (dias <= 7) return 'vence_em_7_dias';
  return 'em_aberto';
}

export const ROTULO_DA_SITUACAO: Record<SituacaoDoTitulo, string> = {
  pago: 'Pago',
  cancelado: 'Cancelado',
  em_atraso: 'Vencido',
  vence_em_7_dias: 'Vence em 7 dias',
  em_aberto: 'Em aberto',
  sem_vencimento: 'Sem vencimento',
};

/**
 * A mesma régua, para o banco: o filtro "Em atraso" das listas passa a ser
 * `status IN (previsto, em_atraso) AND data_vencimento < hoje` — não
 * `status = 'em_atraso'`, que nunca casa com nada.
 */
export function condicaoDeAtrasoNoBanco(hoje: string = hojeLocal()): {
  status: typeof STATUS_EM_ABERTO;
  vencimentoAntesDe: string;
} {
  return { status: STATUS_EM_ABERTO, vencimentoAntesDe: hoje };
}
