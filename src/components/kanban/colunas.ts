import {
  STATUS_PROCESSO,
  STATUS_DECIDIDOS,
  normalizarStatus,
  rotuloStatus,
  prazoPerdidoNoRadar,
  type StatusProcesso,
} from '@/lib/licitacao/status';

/**
 * As colunas do quadro e as pendências que o cartão carrega.
 *
 * Este módulo existe por causa do princípio 1 do CLAUDE.md: `lib/licitacao/status.ts`
 * é a autoridade única do vocabulário. O Kanban REDECLARAVA os oito status num
 * array local — a quarta cópia do mesmo vocabulário, e o tipo de divergência que
 * já manteve o arquivamento automático quebrado por meses (`Homologada` ×
 * `Homologado`). Aqui os `id` vêm de `STATUS_PROCESSO` e o rótulo exibido vem de
 * `rotuloStatus`; o que sobra de local é só o que é de fato apresentação deste
 * quadro — a descrição da etapa e as classes de cor.
 */

/** O que a consulta do quadro traz de cada processo. */
export type ProcessoDoQuadro = {
  id: string;
  numero: string;
  orgao: string;
  objeto: string;
  status: string;
  modalidade: string | null;
  valor_estimado: number | null;
  uf: string | null;
  municipio: string | null;
  data_encerramento: string | null;
  arquivado_em: string | null;
  /** Colaborador que responde pelo processo hoje — pode não ser quem o criou. */
  operador_id: string | null;
};

/**
 * Em qual coluna o card aparece. `arquivado_em` vence o status: um processo
 * homologado e arquivado mostra-se em Arquivada e continua homologado por baixo
 * — que é exatamente o que a gravação antiga destruía.
 */
export const colunaDe = (lic: { status: string; arquivado_em: string | null }): StatusProcesso =>
  lic.arquivado_em ? 'Arquivada' : normalizarStatus(lic.status);

/**
 * Cor do estado em classes de token (identidade 12/09): a barra superior da
 * coluna, o ponto ao lado do título e a lavagem leve do fundo. Antes a cor
 * entrava por `style` inline — cor escrita à mão dentro do .tsx.
 */
type CorDaEtapa = { topo: string; ponto: string; lavagem: string };

const APARENCIA_DA_ETAPA: Record<StatusProcesso, { description: string; cor: CorDaEtapa }> = {
  Monitorando: {
    description: 'Editais sendo acompanhados',
    cor: { topo: 'border-t-info', ponto: 'bg-info', lavagem: 'bg-info/5' },
  },
  'Em Análise': {
    description: 'Análise de viabilidade',
    cor: { topo: 'border-t-warning', ponto: 'bg-warning', lavagem: 'bg-warning/5' },
  },
  'Proposta Enviada': {
    description: 'Proposta elaborada e enviada',
    cor: { topo: 'border-t-primary', ponto: 'bg-primary', lavagem: 'bg-primary/5' },
  },
  // `--accent` e `--primary` são o mesmo verde nos dois temas: a coluna fica
  // idêntica à de antes, agora pelo token de ação em vez do de hover.
  'Em Disputa': {
    description: 'Disputa/pregão em andamento',
    cor: { topo: 'border-t-primary', ponto: 'bg-primary', lavagem: 'bg-primary/5' },
  },
  Vencida: {
    description: 'Licitação arrematada',
    cor: { topo: 'border-t-success', ponto: 'bg-success', lavagem: 'bg-success/5' },
  },
  // Azul deixou de ser cor de estado no sistema: Homologada usa o token neutro.
  Homologada: {
    description: 'Resultado homologado',
    cor: { topo: 'border-t-info', ponto: 'bg-info', lavagem: 'bg-info/5' },
  },
  Perdida: {
    description: 'Não arrematada',
    cor: { topo: 'border-t-destructive', ponto: 'bg-destructive', lavagem: 'bg-destructive/5' },
  },
  Arquivada: {
    description: 'Processos encerrados',
    cor: { topo: 'border-t-muted-foreground', ponto: 'bg-muted-foreground', lavagem: 'bg-muted/60' },
  },
};

export type ColunaDoQuadro = {
  /** O status gravado no banco — literal que os triggers comparam. */
  id: StatusProcesso;
  /** O que a pessoa lê no topo da coluna. */
  title: string;
  description: string;
  cor: CorDaEtapa;
};

/**
 * As oito colunas, na ordem do funil.
 *
 * O `title` sai de `rotuloStatus`, não de uma tabela local: `status.ts` já
 * carrega exatamente os rótulos que este quadro mostra — inclusive as três
 * divergências deliberadas entre o que se grava e o que se lê
 * (`Em Análise`→"Analisando", `Proposta Enviada`→"Proposta"). Manter uma
 * segunda cópia aqui recriaria, na apresentação, a divergência que o princípio 1
 * proíbe nos dados.
 */
export const COLUNAS: ColunaDoQuadro[] = STATUS_PROCESSO.map((id) => ({
  id,
  title: rotuloStatus(id),
  ...APARENCIA_DA_ETAPA[id],
}));

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

/** Valor em notação compacta — o cartão tem 260px, "R$ 1,2 mi" cabe, o extenso não. */
export const formatarValor = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);

// ---------------------------------------------------------------------------
// Prazo
// ---------------------------------------------------------------------------

/** Quantos dias faltam para o encerramento. Negativo = já passou. */
export function diasAtePrazo(iso: string | null, agora = Date.now()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - agora) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Pendências
// ---------------------------------------------------------------------------

/**
 * A pendência que o cartão mostra.
 *
 * NÃO existe coluna nem tabela de "pendências" em `licitacoes`: o que existe são
 * REGRAS já declaradas no sistema sobre campos que a consulta do quadro traz.
 * Inventar um contador de pendências a partir de dados que ninguém apura seria
 * exatamente o "dado estático de demonstração" que o padrão visual proíbe — por
 * isso a lista abaixo é curta e cada item aponta para uma regra existente.
 */
export type Pendencia = {
  chave: 'prazo-vencido' | 'sem-prazo' | 'sem-responsavel';
  rotulo: string;
  /** Reforço visual; o rótulo é quem informa. */
  tom: 'critico' | 'atencao';
  /** Vira `title` — o critério, escrito por extenso. */
  explicacao: string;
};

/**
 * O que está pendente neste processo, na ordem em que atrapalha.
 *
 * Processo arquivado não acumula pendência: ele saiu da mesa de trabalho por
 * decisão de alguém, e cobrar responsável de um processo encerrado só produz
 * ruído na coluna Arquivada, que é a mais cheia com o tempo.
 */
export function pendenciasDoProcesso(
  lic: Pick<ProcessoDoQuadro, 'status' | 'data_encerramento' | 'arquivado_em' | 'operador_id'>,
): Pendencia[] {
  if (lic.arquivado_em) return [];

  const pendencias: Pendencia[] = [];
  const status = normalizarStatus(lic.status);
  const decidido = STATUS_DECIDIDOS.includes(status);

  // Regra que já existe em status.ts: processo ainda no radar cujo prazo passou
  // é falha operacional — ninguém decidiu nada e a sessão já aconteceu.
  if (prazoPerdidoNoRadar(lic.status, lic.data_encerramento, lic.arquivado_em)) {
    pendencias.push({
      chave: 'prazo-vencido',
      rotulo: 'Prazo vencido',
      tom: 'critico',
      explicacao: 'A sessão já ocorreu e o processo continua no radar, sem decisão registrada.',
    });
  }

  // Sem data não há como priorizar, e o processo some de calendário e alerta.
  // Só cobra de quem ainda disputa: processo decidido não tem prazo a cumprir.
  if (!lic.data_encerramento && !decidido) {
    pendencias.push({
      chave: 'sem-prazo',
      rotulo: 'Sem prazo',
      tom: 'atencao',
      explicacao: 'Sem data de encerramento o processo não entra em calendário nem em alerta.',
    });
  }

  // `operador_id` é quem responde pelo processo hoje. Vazio significa processo
  // sem dono — o caso que a Onda 3 passou a preencher e que os processos
  // antigos deixaram para trás.
  if (!lic.operador_id) {
    pendencias.push({
      chave: 'sem-responsavel',
      rotulo: 'Sem responsável',
      tom: 'atencao',
      explicacao: 'Nenhum colaborador está registrado como responsável por este processo.',
    });
  }

  return pendencias;
}
