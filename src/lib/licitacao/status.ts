/**
 * Autoridade única do vocabulário de status do processo licitatório.
 *
 * Antes deste arquivo havia três listas independentes — `PainelLicitacoes`,
 * `KanbanPage` e a edge function `licitacoes-cleanup` — e a interseção entre o
 * que o Kanban gravava e o que o arquivamento procurava era **vazia**:
 * o Kanban escrevia `Homologada`, o cleanup procurava `Homologado`. Resultado:
 * nenhum processo jamais se qualificou para arquivamento automático.
 *
 * A grafia canônica aqui é a do Kanban porque ela já é a do **banco**: os
 * triggers `comercial_marcar_proposta_enviada` e `comercial_exigir_motivo_perda`
 * (migration 20260803000002) comparam `status` com estes literais exatos.
 * Mudar a grafia aqui sem mudar o SQL quebra as metas do comercial.
 *
 * ESPELHO: `supabase/functions/_shared/licitacao-status.ts` repete o mínimo
 * necessário para o Deno das edge functions, que não enxerga `src/`. As duas
 * versões precisam mudar juntas.
 */

export const STATUS_PROCESSO = [
  'Monitorando',
  'Em Análise',
  'Proposta Enviada',
  'Em Disputa',
  'Vencida',
  'Homologada',
  'Perdida',
  'Arquivada',
] as const;

export type StatusProcesso = (typeof STATUS_PROCESSO)[number];

/**
 * Desfechos que vivem na coluna `resultado`, não em `status`.
 * O comentário da coluna no banco (migration 20260223030808) já os declara:
 * 'Resultado: Vencida, Perdida, Desclassificada, Deserto, Fracassado,
 * Revogado, Anulado'. O cleanup antigo procurava estes valores em `status`,
 * onde eles nunca estiveram — parte da causa de D1.
 */
export const RESULTADOS_ENCERRADORES = [
  'Deserto',
  'Fracassado',
  'Revogado',
  'Anulado',
  'Desclassificada',
  'Perdedor',
] as const;

/** Status que representam um processo cuja disputa já terminou. */
export const STATUS_DECIDIDOS: StatusProcesso[] = ['Vencida', 'Homologada', 'Perdida'];

// ---------------------------------------------------------------------------
// Faixas do painel
// ---------------------------------------------------------------------------

/**
 * As quatro faixas do ciclo de vida. O que separa `arquivo` das demais não é
 * o desfecho, é a decisão de que o processo não ocupa mais a mesa de trabalho —
 * por isso ela é decidida por `arquivado_em`, não por `status`.
 */
export type Faixa = 'radar' | 'em_jogo' | 'decidido' | 'arquivo';

export const FAIXAS: { id: Faixa; label: string; descricao: string }[] = [
  { id: 'radar', label: 'Radar', descricao: 'De olho, ainda sem decisão de participar' },
  { id: 'em_jogo', label: 'Em jogo', descricao: 'Trabalho comprometido — prazo manda' },
  { id: 'decidido', label: 'Decidido', descricao: 'Acabou, faltam as pontas (contrato, faturamento)' },
  { id: 'arquivo', label: 'Arquivo', descricao: 'Fora do painel, consultável no histórico' },
];

/** Faixas que o painel mostra por padrão — o que de fato ocupa a mesa hoje. */
export const FAIXAS_PADRAO: Faixa[] = ['radar', 'em_jogo', 'decidido'];

const FAIXA_POR_STATUS: Record<StatusProcesso, Faixa> = {
  Monitorando: 'radar',
  'Em Análise': 'radar',
  'Proposta Enviada': 'em_jogo',
  'Em Disputa': 'em_jogo',
  Vencida: 'decidido',
  Homologada: 'decidido',
  Perdida: 'decidido',
  Arquivada: 'arquivo',
};

/**
 * Em que faixa o processo está. `arquivado_em` vence qualquer status: um
 * processo homologado e arquivado está no Arquivo, e continua homologado.
 */
export function faixaDe(status: string, arquivadoEm?: string | null): Faixa {
  if (arquivadoEm) return 'arquivo';
  return FAIXA_POR_STATUS[normalizarStatus(status)];
}

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/**
 * Traduz qualquer grafia já gravada no banco para a canônica.
 *
 * Cobre o histórico real de escritas: o `Publicado` que vem do PNCP, os
 * minúsculos do painel antigo (`monitorando`, `analisando`, `proposta`), os
 * particípios masculinos do cleanup (`Homologado`) e os rótulos de resultado
 * (`Vencedor`, `Perdedor`).
 *
 * NOTA — divergência conhecida, preservada de propósito: `revogado`, `anulado`
 * e `cancelado` caem em `Perdida`, como o Kanban já fazia. Semanticamente eles
 * são encerramentos neutros do órgão, não derrota comercial, e a Onda 2 os move
 * para o eixo `desfecho`. Mudar isso agora reclassificaria processos vivos e
 * mexeria nas metas do comercial — que é exatamente o tipo de efeito colateral
 * que esta onda não deve ter.
 */
export function normalizarStatus(valor?: string | null): StatusProcesso {
  const s = (valor || '').trim().toLowerCase();
  if (!s) return 'Monitorando';

  if (s.includes('arquiv')) return 'Arquivada';
  if (s.includes('homolog')) return 'Homologada';
  if (s.includes('contrato assinado')) return 'Homologada';
  if (s.includes('perd')) return 'Perdida';
  if (s.includes('cancel') || s.includes('revog') || s.includes('anulad')) return 'Perdida';
  if (s.includes('vencid') || s.includes('adjudic') || s.includes('vencedor') || s.includes('ata_registro')) return 'Vencida';
  if (s.includes('disputa')) return 'Em Disputa';
  if (s.includes('proposta') || s === 'enviada') return 'Proposta Enviada';
  if (s.includes('anális') || s.includes('analis')) return 'Em Análise';

  // `Publicado`, `novo`, `monitorando` e qualquer desconhecido entram pelo topo
  // do funil — é o único destino que não afirma nada de errado sobre o processo.
  return 'Monitorando';
}

/**
 * O processo terminou? Olha os dois eixos, porque o desfecho pode estar em
 * `resultado` sem nunca ter passado por `status` (Deserto, Fracassado…).
 */
export function ehDecidido(status: string, resultado?: string | null): boolean {
  if (STATUS_DECIDIDOS.includes(normalizarStatus(status))) return true;
  const r = (resultado || '').trim().toLowerCase();
  return RESULTADOS_ENCERRADORES.some((v) => r === v.toLowerCase());
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

/**
 * Classes de badge por status. Segue a regra de cor da auditoria do repo:
 * semântica só onde o estado é real (andamento / ganho / perda); azul e teal
 * decorativos são neutros.
 */
const APARENCIA: Record<StatusProcesso, { label: string; className: string }> = {
  Monitorando: { label: 'Monitorando', className: 'bg-muted text-muted-foreground border-border' },
  'Em Análise': { label: 'Analisando', className: 'bg-warning/10 text-warning border-warning/20' },
  'Proposta Enviada': { label: 'Proposta', className: 'bg-primary/10 text-primary border-primary/20' },
  'Em Disputa': { label: 'Em Disputa', className: 'bg-accent/10 text-accent border-accent/20' },
  Vencida: { label: 'Vencida', className: 'bg-success/10 text-success border-success/20' },
  Homologada: { label: 'Homologada', className: 'bg-success/10 text-success border-success/20' },
  Perdida: { label: 'Perdida', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  Arquivada: { label: 'Arquivada', className: 'bg-muted text-muted-foreground border-border' },
};

export function aparenciaStatus(status: string) {
  return APARENCIA[normalizarStatus(status)];
}

export function rotuloStatus(status: string): string {
  return APARENCIA[normalizarStatus(status)].label;
}

// ---------------------------------------------------------------------------
// Regras de tempo
// ---------------------------------------------------------------------------

/** Carência entre o desfecho e o arquivamento automático, para Contratos e Financeiro engancharem. */
export const DIAS_CARENCIA_ARQUIVAMENTO = 30;

/** Retenção do arquivo antes do expurgo — a política já declarada no COMMENT da coluna. */
export const DIAS_RETENCAO_ARQUIVO = 120;

/** Processo em Radar cujo prazo já passou: falha operacional que a gestão precisa ver. */
export function prazoPerdidoNoRadar(
  status: string,
  dataEncerramento?: string | null,
  arquivadoEm?: string | null,
): boolean {
  if (arquivadoEm || !dataEncerramento) return false;
  if (faixaDe(status, null) !== 'radar') return false;
  return new Date(dataEncerramento).getTime() < Date.now();
}
