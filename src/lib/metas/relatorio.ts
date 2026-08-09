/**
 * Montagem dos relatórios quinzenal e mensal do comercial.
 *
 * Puro de propósito: recebe os dados já carregados e devolve a estrutura do
 * relatório. Quem exporta em PDF ou planilha só formata o que sai daqui, então
 * as duas saídas nunca divergem — e as regras ficam testáveis sem banco.
 */

import { primeiroDiaDoMes, ultimoDiaDoMes, type DataCivil } from './dias-uteis';
import type { Projecao } from './projecao';

export type TipoRelatorio = 'Q1' | 'Q2' | 'MES';

export type Periodo = { inicio: DataCivil; fim: DataCivil; rotulo: string };

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Q1 = dias 1 a 15; Q2 = 16 ao fim do mês; MES = o mês inteiro.
 * O corte no dia 15 é o que define "quinzenal" no negócio — não é meia-metade
 * de dias úteis, é data de calendário, para o relatório sair sempre no mesmo dia.
 */
export function periodoDoRelatorio(tipo: TipoRelatorio, ano: number, mes: number): Periodo {
  const primeiro = primeiroDiaDoMes(ano, mes);
  const ultimo = ultimoDiaDoMes(ano, mes);
  const nome = `${MESES[mes - 1]}/${ano}`;

  if (tipo === 'Q1') {
    return { inicio: primeiro, fim: `${ano}-${String(mes).padStart(2, '0')}-15`, rotulo: `1ª quinzena de ${nome}` };
  }
  if (tipo === 'Q2') {
    return { inicio: `${ano}-${String(mes).padStart(2, '0')}-16`, fim: ultimo, rotulo: `2ª quinzena de ${nome}` };
  }
  return { inicio: primeiro, fim: ultimo, rotulo: `Mês de ${nome}` };
}

/** A data já alcançou o fim do período? Relatório de período aberto é parcial. */
export function periodoFechado(periodo: Periodo, hoje: DataCivil): boolean {
  return hoje > periodo.fim;
}

// ─── Riscos ───────────────────────────────────────────────────────────────────

export type Severidade = 'alta' | 'media' | 'baixa';

export type Risco = {
  codigo: string;
  severidade: Severidade;
  descricao: string;
  /** O que fazer. Vazio quando o risco é só informativo. */
  acao?: string;
};

export type EntradaRiscos = {
  projecao: Projecao;
  perdidosNoPeriodo: number;
  motivoPerdaDominante?: { label: string; quantidade: number; total: number };
  participadosNoPeriodo: number;
};

/**
 * Riscos concretos, derivados dos números — nunca conselho genérico.
 * Cada um aponta um fato verificável do período e o que ele implica.
 */
export function levantarRiscos(e: EntradaRiscos): Risco[] {
  const { projecao: p } = e;
  const riscos: Risco[] = [];

  if (p.metaCent === 0) {
    riscos.push({
      codigo: 'sem_meta',
      severidade: 'alta',
      descricao: 'Nenhuma meta definida para o período.',
      acao: 'Definir a meta em Metas do Comercial → Parametrização para o motor ter o que projetar.',
    });
    return riscos; // sem meta, os demais riscos não têm referência
  }

  if (p.projecaoFimMesCent < p.metaCent) {
    const faltaCent = p.metaCent - p.projecaoFimMesCent;
    riscos.push({
      codigo: 'projecao_abaixo_da_meta',
      severidade: p.projecaoFimMesCent < p.metaCent * 0.7 ? 'alta' : 'media',
      descricao:
        `No ritmo atual o mês fecha ${(faltaCent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} abaixo da meta.`,
      acao: `Elevar o faturamento diário para ${(p.runRateNecessarioCent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por dia útil.`,
    });
  }

  if (p.gapRitmo !== null && p.gapRitmo > 0.5) {
    riscos.push({
      codigo: 'gap_de_ritmo',
      severidade: p.gapRitmo > 1 ? 'alta' : 'media',
      descricao: `O ritmo precisa subir ${Math.round(p.gapRitmo * 100)}% para a meta ser alcançada.`,
      acao: `Fechar ${p.contratosNecessarios} contrato(s) nos ${p.diasUteisRestantes} dias úteis restantes.`,
    });
  }

  if (e.participadosNoPeriodo === 0 && p.restanteCent > 0) {
    riscos.push({
      codigo: 'sem_participacao',
      severidade: 'alta',
      descricao: 'Nenhuma proposta enviada no período.',
      acao: `A meta exige ${p.participacoesNecessarias} participação(ões) — sem propostas não há como convertê-las.`,
    });
  }

  if (p.diasUteisRestantes <= 3 && p.restanteCent > 0) {
    riscos.push({
      codigo: 'prazo_curto',
      severidade: 'alta',
      descricao: `Restam ${p.diasUteisRestantes} dia(s) útil(eis) e ainda faltam ${(p.restanteCent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      acao: 'Priorizar o faturamento de pedidos já contratados, que dependem só de emissão.',
    });
  }

  const m = e.motivoPerdaDominante;
  if (m && m.total >= 3 && m.quantidade / m.total >= 0.5) {
    riscos.push({
      codigo: 'motivo_perda_concentrado',
      severidade: 'media',
      descricao: `${m.quantidade} das ${m.total} perdas do período têm o mesmo motivo: ${m.label}.`,
      acao: 'Concentração num único motivo indica causa tratável, não azar.',
    });
  }

  if (p.premissas.confianca === 'baixa') {
    riscos.push({
      codigo: 'baixa_confianca',
      severidade: 'baixa',
      descricao: 'A projeção usa premissas conservadoras por falta de histórico.',
      acao: p.premissas.motivosBaixaConfianca.join(' '),
    });
  }

  return riscos;
}

// ─── Estrutura do relatório ───────────────────────────────────────────────────

export type LinhaIndicador = { rotulo: string; valor: string };

export type AtividadeResumo = { modulo: string; quantidade: number };

export type Relatorio = {
  tipo: TipoRelatorio;
  periodo: Periodo;
  parcial: boolean;
  colaborador: string;
  indicadores: LinhaIndicador[];
  sugestoes: LinhaIndicador[];
  riscos: Risco[];
  atividades: AtividadeResumo[];
  premissas: LinhaIndicador[];
};

const brl = (cent: number) =>
  (cent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const pct = (v: number) => `${Math.round(v * 100)}%`;

export type EntradaRelatorio = {
  tipo: TipoRelatorio;
  ano: number;
  mes: number;
  hoje: DataCivil;
  colaborador: string;
  projecao: Projecao;
  realizado: {
    participados: number;
    ganhos: number;
    perdidos: number;
    pedidos_faturados: number;
    nfe_quitadas: number;
  };
  motivosPerda: { label: string; quantidade: number }[];
  atividades: AtividadeResumo[];
};

export function montarRelatorio(e: EntradaRelatorio): Relatorio {
  const periodo = periodoDoRelatorio(e.tipo, e.ano, e.mes);
  const p = e.projecao;
  const r = e.realizado;

  const totalPerdas = e.motivosPerda.reduce((s, m) => s + m.quantidade, 0);
  const dominante = [...e.motivosPerda].sort((a, b) => b.quantidade - a.quantidade)[0];

  const indicadores: LinhaIndicador[] = [
    { rotulo: 'Meta do mês', valor: brl(p.metaCent) },
    { rotulo: 'Realizado', valor: brl(p.realizadoCent) },
    { rotulo: 'Percentual da meta', valor: pct(p.percentualRealizado) },
    { rotulo: 'Projeção de fechamento', valor: brl(p.projecaoFimMesCent) },
    { rotulo: 'Processos participados', valor: String(r.participados) },
    { rotulo: 'Contratos ganhos', valor: String(r.ganhos) },
    { rotulo: 'Processos perdidos', valor: String(r.perdidos) },
    { rotulo: 'Pedidos faturados', valor: String(r.pedidos_faturados) },
    { rotulo: 'NF-e quitadas', valor: String(r.nfe_quitadas) },
    {
      rotulo: 'Taxa de conversão do período',
      valor: r.participados > 0 ? pct(r.ganhos / r.participados) : '—',
    },
  ];

  const sugestoes: LinhaIndicador[] = p.restanteCent === 0
    ? [{ rotulo: 'Situação', valor: 'Meta alcançada — nenhuma ação pendente.' }]
    : [
        { rotulo: 'Processos a participar', valor: String(p.participacoesNecessarias) },
        { rotulo: 'Contratos a fechar', valor: String(p.contratosNecessarios) },
        { rotulo: 'Valor a faturar', valor: brl(p.valorAFaturarCent) },
        { rotulo: 'Ritmo atual', valor: `${brl(p.ritmoDiarioCent)} por dia útil` },
        { rotulo: 'Ritmo necessário', valor: `${brl(p.runRateNecessarioCent)} por dia útil` },
        { rotulo: 'Dias úteis restantes', valor: String(p.diasUteisRestantes) },
      ];

  const premissas: LinhaIndicador[] = [
    { rotulo: 'Conversão participado → ganho', valor: pct(p.premissas.txGanho) },
    { rotulo: 'Conversão ganho → faturado', valor: pct(p.premissas.txFaturamento) },
    { rotulo: 'Ticket médio ponderado', valor: brl(p.premissas.ticketPonderadoCent) },
    { rotulo: 'Índice de sazonalidade', valor: p.premissas.indiceSazonal.toFixed(2) },
    { rotulo: 'Confiança', valor: p.premissas.confianca === 'alta' ? 'Alta' : 'Baixa' },
  ];

  return {
    tipo: e.tipo,
    periodo,
    parcial: !periodoFechado(periodo, e.hoje),
    colaborador: e.colaborador,
    indicadores,
    sugestoes,
    riscos: levantarRiscos({
      projecao: p,
      perdidosNoPeriodo: r.perdidos,
      participadosNoPeriodo: r.participados,
      motivoPerdaDominante: dominante
        ? { label: dominante.label, quantidade: dominante.quantidade, total: totalPerdas }
        : undefined,
    }),
    atividades: e.atividades,
    premissas,
  };
}
