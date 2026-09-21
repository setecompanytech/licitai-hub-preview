/**
 * Encerramento do contrato — vocabulário e regras puras.
 *
 * Pergunta do dono (21/09/2026): "como saber se o contrato já se encerrou?"
 * Vigência em dia não significa obrigação em aberto: o quantitativo pode ter
 * sido todo fornecido antes do prazo. O sistema tinha três sinais que nunca
 * se juntavam — a situação gravada (`status`), o saldo (coluna gerada) e a
 * entrega (forma de fornecimento) — e nenhum registrava o fato "encerrado,
 * por este motivo, nesta data".
 *
 * Decisões do dono (21/09):
 *   1. o encerramento é DECLARADO por quem opera; o sistema SUGERE quando o
 *      saldo se esgota ou a vigência vence, e oferece o aditivo como a outra
 *      saída (CLAUDE.md, princípio 7: hipótese, não regra);
 *   2. a carteira ("Saldo remanescente") não soma encerrados nem saldo
 *      negativo, e a lista esconde encerrados por padrão, com filtro;
 *   3. metas seguem contando o contrato no mês da assinatura — nada muda lá.
 *
 * Aqui só vive o que é regra pura e testável: rótulos, a sugestão, o saldo
 * da carteira e o filtro da lista. A escrita no banco é das RPCs
 * `encerrar_contrato` e `reabrir_contrato` (migration 20260921000002),
 * chamadas em `components/contratos/EncerramentoDoContrato.tsx`.
 */

export type MotivoEncerramento =
  | 'quantitativo_esgotado'
  | 'prazo_vencido'
  | 'entrega_unica_concluida'
  | 'rescisao'
  | 'outro'
  | 'nao_informado';

export const MOTIVOS_ENCERRAMENTO: Record<MotivoEncerramento, { rotulo: string; explicacao: string }> = {
  quantitativo_esgotado: {
    rotulo: 'Quantitativo esgotado',
    explicacao: 'Todo o quantitativo contratado foi fornecido: as obrigações se cumpriram antes do fim da vigência.',
  },
  prazo_vencido: {
    rotulo: 'Prazo vencido',
    explicacao: 'A vigência terminou sem prorrogação; o saldo que restou não será executado.',
  },
  entrega_unica_concluida: {
    rotulo: 'Entrega única concluída',
    explicacao: 'O fornecimento integral foi entregue e recebido.',
  },
  rescisao: {
    rotulo: 'Rescisão',
    explicacao: 'O contrato foi extinto antes do termo (Lei 14.133/2021, arts. 137 a 139).',
  },
  outro: {
    rotulo: 'Outro motivo',
    explicacao: 'Descreva o motivo na observação.',
  },
  nao_informado: {
    rotulo: 'Motivo não informado',
    explicacao: 'A situação foi alterada para Encerrado sem motivo. Informe-o no Resumo do contrato.',
  },
};

/** Os motivos que quem opera escolhe — `nao_informado` só nasce do gatilho. */
export const MOTIVOS_ESCOLHIVEIS: MotivoEncerramento[] = [
  'quantitativo_esgotado',
  'prazo_vencido',
  'entrega_unica_concluida',
  'rescisao',
  'outro',
];

export function rotuloDoMotivo(motivo: string | null | undefined): string {
  return MOTIVOS_ENCERRAMENTO[(motivo ?? 'nao_informado') as MotivoEncerramento]?.rotulo
    ?? MOTIVOS_ENCERRAMENTO.nao_informado.rotulo;
}

/** Hoje em São Paulo, AAAA-MM-DD — a mesma régua das RPCs. */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** dd/mm/aaaa a partir de AAAA-MM-DD, sem passar por fuso. */
export function dataBrDoIso(iso: string | null | undefined): string | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

// ── A sugestão ──────────────────────────────────────────────────────────────

export type SinaisDoContrato = {
  /** `status === 'encerrado'` gravado — a declaração. */
  encerrado: boolean;
  /** Valor consumido ≥ valor global, ou todos os itens com saldo ≤ 0. */
  saldoEsgotado: boolean;
  /** `data_fim` no passado. */
  vencido: boolean;
  /** Frase pronta da vigência ("Venceu há 12 dias"), quando vencido. */
  vigenciaFrase?: string | null;
  /** Entrega única com tudo entregue e saldo zerado (decisão de 02/09). */
  entregaUnicaConcluida: boolean;
  /** Todos os pedidos não cancelados estão entregues. */
  todosEntregues: boolean;
  instrumento: 'contrato' | 'ata';
};

export type SugestaoDeEncerramento = {
  motivo: MotivoEncerramento;
  titulo: string;
  detalhe: string;
  /** O aditivo que resolveria em vez de encerrar. */
  aditivo: 'quantidade ou valor' | 'prazo';
};

/**
 * O que o painel pergunta quando o contrato dá sinal de fim — e só então.
 *
 * Três saídas, sempre as mesmas: registrar o aditivo (o contrato segue com
 * saldo ou vigência novos), encerrar (com motivo e data) ou deixar para
 * depois (a pendência fica no cartão "Próximas ações"). Encerrado não
 * pergunta mais nada.
 */
export function sugestaoDeEncerramento(s: SinaisDoContrato): SugestaoDeEncerramento | null {
  if (s.encerrado) return null;
  const nome = s.instrumento === 'ata' ? 'a ata' : 'o contrato';

  if (s.entregaUnicaConcluida) {
    return {
      motivo: 'entrega_unica_concluida',
      aditivo: 'quantidade ou valor',
      titulo: `Entrega única concluída — encerrar ${nome}?`,
      detalhe: 'O fornecimento integral foi entregue e o saldo se esgotou. Se não restam outras obrigações, '
        + 'encerre por entrega única concluída. Se houve aditivo de quantidade ou de valor, registre-o antes: '
        + 'ele devolve saldo e o fornecimento continua.',
    };
  }
  if (s.saldoEsgotado) {
    return {
      motivo: 'quantitativo_esgotado',
      aditivo: 'quantidade ou valor',
      titulo: `Saldo esgotado — ${nome} chegou ao fim?`,
      detalhe: s.todosEntregues
        ? 'Os pedidos cobrem todo o contratado e estão entregues. Há aditivo de quantidade ou de valor a registrar? '
          + 'Ele devolve saldo e o contrato segue. Não há? As obrigações se cumpriram: encerre por quantitativo esgotado.'
        : 'Os pedidos lançados cobrem todo o contratado, mas nem todos estão entregues. Se houve aditivo, registre-o '
          + 'agora; se não, encerre quando as entregas terminarem — saldo esgotado mede pedidos lançados, não entregues.',
    };
  }
  if (s.vencido) {
    return {
      motivo: 'prazo_vencido',
      aditivo: 'prazo',
      titulo: `Vigência vencida — ${nome} chegou ao fim?`,
      detalhe: `${s.vigenciaFrase ? `${s.vigenciaFrase}. ` : ''}Se houve prorrogação, registre o aditivo de prazo e a `
        + 'vigência volta a valer. Se não houve, encerre por prazo vencido: o saldo que restou fica registrado como não executado.',
    };
  }
  return null;
}

// ── A reabertura sugerida ───────────────────────────────────────────────────

export type AditivoRef = {
  id: string;
  numero_aditivo?: string | null;
  data_assinatura?: string | null;
  data_aditivo?: string | null;
  created_at?: string | null;
};

/**
 * Um aditivo ASSINADO depois do encerramento diz que o contrato continuou —
 * é o caso de reabrir. Aditivo antigo registrado tarde (documentação) não
 * conta: a data que vale é a da assinatura, e só na falta dela a do registro.
 */
export function aditivoPosteriorAoEncerramento(
  dataEncerramento: string | null | undefined,
  aditivos: AditivoRef[],
): { id: string; numero: string; data: string } | null {
  const corte = String(dataEncerramento ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte)) return null;
  let melhor: { id: string; numero: string; data: string } | null = null;
  for (const a of aditivos) {
    const data = String(a.data_assinatura || a.data_aditivo || a.created_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data <= corte) continue;
    if (!melhor || data > melhor.data) {
      melhor = { id: a.id, numero: a.numero_aditivo || 'sem número', data };
    }
  }
  return melhor;
}

// ── A carteira ──────────────────────────────────────────────────────────────

export type ContratoDaCarteira = {
  status: string;
  saldo_remanescente: number | null;
  valor_global: number | null;
};

const apurado = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * O que o cartão "Saldo remanescente" soma — e o que deixa de fora, contado.
 *
 * Fora ficam o contrato ENCERRADO (declarado; saldo que sobrou não é
 * carteira) e o saldo NEGATIVO (execução acima do valor global: é pendência
 * de aditivo ou de conferência, não saldo — e subtraí-lo da carteira fazia
 * R$ 152,6 mil virarem R$ 76 mil na tela do dono, 21/09). Só entra o que foi
 * apurado: `null` continua sendo ausência, não zero.
 */
export function saldoDaCarteira<T extends ContratoDaCarteira>(contratos: T[]): {
  total: number;
  /** Σ valor global dos contratos que entraram — a base do percentual. */
  valorDaBase: number;
  apurados: number;
  encerrados: number;
  negativos: number;
  base: T[];
} {
  let encerrados = 0;
  let negativos = 0;
  let apurados = 0;
  const base: T[] = [];
  for (const c of contratos) {
    if (!apurado(c.saldo_remanescente)) continue;
    apurados += 1;
    if (c.status === 'encerrado') { encerrados += 1; continue; }
    if (c.saldo_remanescente < 0) { negativos += 1; continue; }
    base.push(c);
  }
  return {
    total: base.reduce((s, c) => s + (c.saldo_remanescente as number), 0),
    valorDaBase: base.reduce((s, c) => s + (apurado(c.valor_global) ? c.valor_global : 0), 0),
    apurados,
    encerrados,
    negativos,
    base,
  };
}

// ── O filtro da lista ───────────────────────────────────────────────────────

export type FiltroDeSituacao =
  | 'em_andamento'
  | 'all'
  | 'vigente'
  | 'vencendo'
  | 'suspenso'
  | 'encerrado'
  | 'saldo_negativo';

/** Encerrados saem da lista por padrão (decisão 2); o filtro os traz de volta. */
export const FILTRO_DE_SITUACAO_PADRAO: FiltroDeSituacao = 'em_andamento';

export const OPCOES_DO_FILTRO_DE_SITUACAO: Array<{ valor: FiltroDeSituacao; rotulo: string }> = [
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'all', rotulo: 'Todos' },
  { valor: 'vigente', rotulo: 'Vigente' },
  { valor: 'vencendo', rotulo: 'Vencendo' },
  { valor: 'suspenso', rotulo: 'Suspenso' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
  { valor: 'saldo_negativo', rotulo: 'Executados acima do valor' },
];

/**
 * Situação é a GRAVADA (`status`), como sempre foi neste filtro: "Em
 * andamento" é tudo o que ninguém declarou encerrado — inclusive o vencido
 * sem decisão, que é justamente o que está pendente. "Executados acima do
 * valor" cruza a outra exclusão da carteira, para quem quer vê-los.
 */
export function atendeAoFiltroDeSituacao(
  c: { status: string; saldo_remanescente: number | null },
  filtro: string,
): boolean {
  switch (filtro) {
    case 'all':
      return true;
    case 'em_andamento':
      return c.status !== 'encerrado';
    case 'saldo_negativo':
      return apurado(c.saldo_remanescente) && c.saldo_remanescente < 0;
    default:
      return c.status === filtro;
  }
}

// ── O que o selo explica ────────────────────────────────────────────────────

/**
 * A explicação do selo de situação — a diferença entre "Encerrado" (alguém
 * declarou: data e motivo) e "Vencido" (o calendário passou e ninguém
 * decidiu: aditivo de prazo ou encerramento).
 */
export function explicacaoDaSituacao(
  c: { status: string; data_fim?: string | null; data_encerramento?: string | null; motivo_encerramento?: string | null },
  chaveExibida: string,
): string | undefined {
  if (c.status === 'encerrado') {
    const quando = dataBrDoIso(c.data_encerramento);
    return `Encerrado${quando ? ` em ${quando}` : ''} · ${rotuloDoMotivo(c.motivo_encerramento)}.`;
  }
  if (chaveExibida === 'vencido') {
    const fim = dataBrDoIso(c.data_fim);
    return `Vigência vencida${fim ? ` em ${fim}` : ''} — o encerramento não foi declarado. `
      + 'Registre o aditivo de prazo ou encerre o contrato no Resumo.';
  }
  return undefined;
}
