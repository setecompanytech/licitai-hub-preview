/**
 * ESPELHO de `src/lib/licitacao/status.ts` — o Deno das edge functions não
 * enxerga `src/`, então o vocabulário é repetido aqui. As duas versões precisam
 * mudar juntas. (Mesmo padrão já usado por `comercial_sem_acento` no SQL, que
 * se declara espelho de `src/lib/metas/modalidades.ts`.)
 *
 * Só o necessário para o arquivamento: quais status/resultados encerram um
 * processo. A grafia é a do banco — os triggers de metas comparam com estes
 * literais exatos.
 */

/** Status que representam disputa encerrada. Grafia canônica do Kanban/banco. */
export const STATUS_DECIDIDOS = ['Vencida', 'Homologada', 'Perdida'] as const;

/**
 * Desfechos que vivem na coluna `resultado`, não em `status`.
 * A versão anterior desta função procurava estes valores em `status`, onde eles
 * nunca estiveram — por isso o arquivamento automático nunca disparou.
 */
export const RESULTADOS_ENCERRADORES = [
  'Deserto',
  'Fracassado',
  'Revogado',
  'Anulado',
  'Desclassificada',
  'Perdedor',
] as const;

/** Carência entre o desfecho e o arquivamento automático. */
export const DIAS_CARENCIA_ARQUIVAMENTO = 30;

/** Retenção do arquivo antes do expurgo definitivo. */
export const DIAS_RETENCAO_ARQUIVO = 120;
