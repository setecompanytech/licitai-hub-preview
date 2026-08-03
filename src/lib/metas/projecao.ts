/**
 * Motor de projeção e sugestão das metas do comercial.
 *
 * Regras de precisão:
 *   - Todo valor monetário trafega em CENTAVOS INTEIROS. Nada de float binário
 *     acumulando erro em soma de contrato.
 *   - Taxas e índices são frações (0,25 = 25%) — são razões, não dinheiro.
 *   - Dinheiro derivado de multiplicação por fração é arredondado com
 *     `Math.round`; contagem de processos sempre com `Math.ceil`, porque não se
 *     participa de 3,4 licitações.
 *
 * Toda premissa usada entra em `premissas` no retorno, para o relatório
 * continuar reproduzível meses depois mesmo que as taxas mudem.
 */

import { repartirMes, type DataCivil } from './dias-uteis';

export type Confianca = 'alta' | 'baixa';

/** Um mês fechado do colaborador, como vem de vw_comercial_realizado_mensal. */
export type HistoricoMes = {
  ano: number;
  mes: number;
  participados: number;
  ganhos: number;
  valorGanhoCent: number;
  valorFaturadoCent: number;
};

/** Ticket por modalidade, apurado do histórico de contratos. */
export type TicketModalidade = {
  modalidade: string;
  /** Quantos contratos sustentam esse ticket. */
  amostra: number;
  ticketCent: number;
  /** Peso da modalidade na carteira do colaborador (0..1). */
  mix: number;
};

export type ParametrosMotor = {
  /** Assumida quando não há participações no histórico. */
  txGanhoPadrao: number;
  /** Assumida quando não há valor ganho no histórico. */
  txFaturamentoPadrao: number;
  /** Contratos mínimos para confiar no ticket real; abaixo disso usa o valor-alvo. */
  minAmostraTicket: number;
  /** Anos de histórico exigidos para confiar no índice sazonal. */
  minAnosSazonalidade: number;
};

export type Premissas = {
  txGanho: number;
  txFaturamento: number;
  ticketPonderadoCent: number;
  indiceSazonal: number;
  confianca: Confianca;
  /** O que puxou a confiança para baixo. Vazio quando tudo veio de histórico. */
  motivosBaixaConfianca: string[];
};

export type Projecao = {
  metaCent: number;
  realizadoCent: number;
  restanteCent: number;
  /** Quantos processos participar, ganhar e quanto faturar para bater a meta. */
  participacoesNecessarias: number;
  contratosNecessarios: number;
  valorAFaturarCent: number;
  /** Ritmo observado e ritmo exigido, por dia útil. */
  ritmoDiarioCent: number;
  runRateNecessarioCent: number;
  /** Quanto o ritmo precisa subir (0,83 = +83%). null quando não há ritmo ainda. */
  gapRitmo: number | null;
  projecaoFimMesCent: number;
  percentualRealizado: number;
  diasUteisDecorridos: number;
  diasUteisRestantes: number;
  premissas: Premissas;
};

// ─── Taxas de conversão ───────────────────────────────────────────────────────

/**
 * participado → ganho. Sem participações no histórico, cai no padrão
 * conservador (quanto menor a taxa, mais processos o motor vai exigir).
 */
export function calcularTxGanho(
  historico: HistoricoMes[],
  padrao: number,
): { valor: number; confianca: Confianca } {
  const participados = historico.reduce((s, h) => s + h.participados, 0);
  const ganhos = historico.reduce((s, h) => s + h.ganhos, 0);
  if (participados <= 0) return { valor: padrao, confianca: 'baixa' };

  const taxa = ganhos / participados;
  // Taxa zero travaria a divisão adiante; sem nenhum ganho, o padrão é mais útil
  // do que declarar impossível bater a meta.
  if (taxa <= 0) return { valor: padrao, confianca: 'baixa' };
  return { valor: taxa, confianca: 'alta' };
}

/** ganho → faturado, em valor. */
export function calcularTxFaturamento(
  historico: HistoricoMes[],
  padrao: number,
): { valor: number; confianca: Confianca } {
  const ganho = historico.reduce((s, h) => s + h.valorGanhoCent, 0);
  const faturado = historico.reduce((s, h) => s + h.valorFaturadoCent, 0);
  if (ganho <= 0) return { valor: padrao, confianca: 'baixa' };

  const taxa = faturado / ganho;
  if (taxa <= 0) return { valor: padrao, confianca: 'baixa' };
  return { valor: taxa, confianca: 'alta' };
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

/**
 * Ticket médio ponderado pelo mix de modalidades do colaborador.
 * Modalidade com amostra insuficiente usa o valor-alvo parametrizado —
 * é exatamente o papel dos R$ 300k / R$ 100k.
 */
export function calcularTicketPonderado(
  tickets: TicketModalidade[],
  valoresAlvoCent: Record<string, number>,
  minAmostra: number,
): { valorCent: number; confianca: Confianca; modalidadesSemHistorico: string[] } {
  if (tickets.length === 0) {
    const alvos = Object.values(valoresAlvoCent);
    if (alvos.length === 0) return { valorCent: 0, confianca: 'baixa', modalidadesSemHistorico: [] };
    // Sem carteira conhecida, a referência é a média dos valores-alvo
    const media = Math.round(alvos.reduce((s, v) => s + v, 0) / alvos.length);
    return { valorCent: media, confianca: 'baixa', modalidadesSemHistorico: Object.keys(valoresAlvoCent) };
  }

  const semHistorico: string[] = [];
  let acumulado = 0;

  for (const t of tickets) {
    let ticket = t.ticketCent;
    if (t.amostra < minAmostra || ticket <= 0) {
      ticket = valoresAlvoCent[t.modalidade] ?? ticket;
      semHistorico.push(t.modalidade);
    }
    acumulado += t.mix * ticket;
  }

  return {
    valorCent: Math.round(acumulado),
    confianca: semHistorico.length > 0 ? 'baixa' : 'alta',
    modalidadesSemHistorico: semHistorico,
  };
}

// ─── Sazonalidade ─────────────────────────────────────────────────────────────

/**
 * Índice sazonal do mês: quanto ele fatura em relação à média mensal.
 * 1,35 = dezembro costuma render 35% acima da média.
 *
 * Sem anos suficientes, devolve 1,0 — a projeção fica neutra em vez de
 * inventar tendência a partir de um único ano.
 */
export function calcularIndiceSazonal(
  historico: HistoricoMes[],
  mes: number,
  minAnos: number,
): { valor: number; confianca: Confianca } {
  const anosComEsseMes = new Set(historico.filter((h) => h.mes === mes).map((h) => h.ano));
  if (anosComEsseMes.size < minAnos) return { valor: 1, confianca: 'baixa' };

  const doMes = historico.filter((h) => h.mes === mes);
  const mediaMes = doMes.reduce((s, h) => s + h.valorFaturadoCent, 0) / doMes.length;
  const mediaGeral = historico.reduce((s, h) => s + h.valorFaturadoCent, 0) / historico.length;

  if (mediaGeral <= 0) return { valor: 1, confianca: 'baixa' };
  return { valor: mediaMes / mediaGeral, confianca: 'alta' };
}

// ─── Projeção ─────────────────────────────────────────────────────────────────

export type EntradaProjecao = {
  metaCent: number;
  realizadoCent: number;
  ano: number;
  mes: number;
  hoje: DataCivil;
  feriados?: DataCivil[];
  historico: HistoricoMes[];
  tickets: TicketModalidade[];
  valoresAlvoCent: Record<string, number>;
  parametros: ParametrosMotor;
};

export function projetarMeta(entrada: EntradaProjecao): Projecao {
  const { metaCent, realizadoCent, ano, mes, hoje, historico, tickets, valoresAlvoCent, parametros } = entrada;

  const txGanho = calcularTxGanho(historico, parametros.txGanhoPadrao);
  const txFaturamento = calcularTxFaturamento(historico, parametros.txFaturamentoPadrao);
  const ticket = calcularTicketPonderado(tickets, valoresAlvoCent, parametros.minAmostraTicket);
  const sazonal = calcularIndiceSazonal(historico, mes, parametros.minAnosSazonalidade);

  const motivos: string[] = [];
  if (txGanho.confianca === 'baixa') motivos.push('Sem histórico de conversão participado → ganho.');
  if (txFaturamento.confianca === 'baixa') motivos.push('Sem histórico de conversão ganho → faturado.');
  if (ticket.confianca === 'baixa') {
    motivos.push(
      ticket.modalidadesSemHistorico.length > 0
        ? `Ticket veio do valor-alvo em: ${ticket.modalidadesSemHistorico.join(', ')}.`
        : 'Sem histórico de ticket por modalidade.',
    );
  }
  if (sazonal.confianca === 'baixa') motivos.push('Histórico insuficiente para sazonalidade; índice neutro (1,0).');

  const restanteCent = Math.max(0, metaCent - realizadoCent);

  // Quanto de faturamento cada contrato tende a gerar
  const valorPorContratoCent = Math.round(ticket.valorCent * txFaturamento.valor);

  const contratosNecessarios =
    restanteCent === 0 || valorPorContratoCent <= 0
      ? 0
      : Math.ceil(restanteCent / valorPorContratoCent);

  const participacoesNecessarias =
    contratosNecessarios === 0 ? 0 : Math.ceil(contratosNecessarios / txGanho.valor);

  const { decorridos, restantes } = repartirMes(ano, mes, hoje, entrada.feriados ?? []);

  const ritmoDiarioCent = decorridos > 0 ? Math.round(realizadoCent / decorridos) : 0;
  const runRateNecessarioCent = restantes > 0 ? Math.ceil(restanteCent / restantes) : restanteCent;

  const projecaoFimMesCent =
    realizadoCent + Math.round(ritmoDiarioCent * restantes * sazonal.valor);

  const gapRitmo =
    ritmoDiarioCent > 0 ? runRateNecessarioCent / ritmoDiarioCent - 1 : null;

  return {
    metaCent,
    realizadoCent,
    restanteCent,
    participacoesNecessarias,
    contratosNecessarios,
    valorAFaturarCent: restanteCent,
    ritmoDiarioCent,
    runRateNecessarioCent,
    gapRitmo,
    projecaoFimMesCent,
    percentualRealizado: metaCent > 0 ? realizadoCent / metaCent : 0,
    diasUteisDecorridos: decorridos,
    diasUteisRestantes: restantes,
    premissas: {
      txGanho: txGanho.valor,
      txFaturamento: txFaturamento.valor,
      ticketPonderadoCent: ticket.valorCent,
      indiceSazonal: sazonal.valor,
      confianca: motivos.length > 0 ? 'baixa' : 'alta',
      motivosBaixaConfianca: motivos,
    },
  };
}

// ─── Alerta de risco de meta ──────────────────────────────────────────────────

export type Severidade = 'nenhum' | 'atencao' | 'risco' | 'critico';

export type LimiaresAlerta = {
  /** Alerta só passa a valer quando faltam no máximo N dias úteis. */
  diasLimite: number;
  /** Abaixo deste percentual do realizado, dispara (0..100). */
  percentualMinimo: number;
};

/**
 * Severidade do risco de meta.
 *
 * Só avalia dentro da janela final do mês — cobrar 70% no dia 2 não diria nada.
 * Meta zerada nunca alerta: não há o que arriscar.
 */
export function avaliarAlerta(
  projecao: Pick<Projecao, 'metaCent' | 'percentualRealizado' | 'diasUteisRestantes'>,
  limiares: LimiaresAlerta,
): Severidade {
  if (projecao.metaCent <= 0) return 'nenhum';
  if (projecao.diasUteisRestantes > limiares.diasLimite) return 'nenhum';

  const pct = projecao.percentualRealizado * 100;
  if (pct >= limiares.percentualMinimo) return 'nenhum';

  if (pct < limiares.percentualMinimo * (30 / 70)) return 'critico';
  if (pct < limiares.percentualMinimo * (50 / 70)) return 'risco';
  return 'atencao';
}
