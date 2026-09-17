/**
 * O histórico do robô para a plataforma — Admin › Configurações do Robô de
 * Lances › "Histórico do robô" (17/09/2026, pedido do Ian).
 *
 * A tabela `robo_historico` (migration `20260917000004`) junta o que antes só se
 * via conta por conta: os avisos do sininho sobre o robô (origem `aviso`) e a
 * linha do tempo das sessões (origem `evento`). O sininho guarda o aviso do robô
 * por 24 horas e apaga; o histórico guarda 12 meses. Só admin da plataforma lê.
 *
 * Aqui mora o que a tela decide, em texto testável: o período, a busca que vai
 * ao banco, o rótulo e o tom de cada linha.
 */
import type { TomSituacao } from '@/components/gestao/SeloSituacao';

export const HORAS_DO_AVISO_NO_SININHO = 24;
export const MESES_DO_HISTORICO = 12;
export const LINHAS_POR_PAGINA = 50;

export type OrigemDoHistorico = 'aviso' | 'evento';

export interface LinhaDoHistorico {
  id: string;
  origem: OrigemDoHistorico;
  tipo: string | null;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  empresa_id: string | null;
  disputa_id: string | null;
  sessao_id: string | null;
  edital: string | null;
  portal: string | null;
  destinatarios: number;
  dados: Record<string, unknown> | null;
  ocorreu_em: string;
}

export type PeriodoDoHistorico = '24h' | '7d' | '30d' | '12m';

export const PERIODOS_DO_HISTORICO: ReadonlyArray<{ valor: PeriodoDoHistorico; rotulo: string }> = [
  { valor: '24h', rotulo: 'Últimas 24 horas' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: '12m', rotulo: 'Últimos 12 meses' },
];

/** Início do período, em ISO, para o `gte` da consulta. */
export function inicioDoPeriodo(periodo: PeriodoDoHistorico, agora: Date): string {
  const d = new Date(agora.getTime());
  if (periodo === '24h') d.setTime(d.getTime() - 24 * 3_600_000);
  else if (periodo === '7d') d.setTime(d.getTime() - 7 * 86_400_000);
  else if (periodo === '30d') d.setTime(d.getTime() - 30 * 86_400_000);
  else d.setMonth(d.getMonth() - MESES_DO_HISTORICO);
  return d.toISOString();
}

/**
 * O filtro `or` do PostgREST para a busca (edital, título ou mensagem). Vírgula,
 * parêntese e asterisco quebram a sintaxe do filtro: saem do termo. Termo vazio
 * depois da limpeza = sem busca.
 */
export function filtroDaBusca(termo: string): string | null {
  const limpo = termo.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo) return null;
  return ['edital', 'titulo', 'mensagem'].map((c) => `${c}.ilike.%${limpo}%`).join(',');
}

const ROTULO_DO_EVENTO: Record<string, string> = {
  entrou: 'Robô entrou na sala',
  encerrou: 'Robô saiu da sala',
  'lance-enviado': 'Lance enviado',
  'lance-recusado': 'Lance recusado',
  recusado: 'Recusado',
  verificacao: 'Aguardando verificação',
  concorrente: 'Lance de concorrente',
  lider: 'Empresa em 1º lugar',
  aguardando: 'Aguardando',
  erro: 'Erro',
};

/** O título da linha: o do aviso como chegou; o do evento, em palavras. */
export function tituloDaLinha(l: Pick<LinhaDoHistorico, 'origem' | 'tipo' | 'titulo'>): string {
  if (l.origem === 'evento' && l.tipo && ROTULO_DO_EVENTO[l.tipo]) return ROTULO_DO_EVENTO[l.tipo];
  return l.titulo;
}

/** O selo da linha: o que chama atenção (urgente, erro, recusa) em destaque. */
export function seloDaLinha(l: Pick<LinhaDoHistorico, 'origem' | 'tipo'>): { rotulo: string; tom: TomSituacao } {
  const tipo = String(l.tipo ?? '');
  if (l.origem === 'aviso') {
    if (tipo === 'urgente' || tipo === 'erro') return { rotulo: 'Aviso urgente', tom: 'critico' };
    if (tipo === 'alerta') return { rotulo: 'Alerta', tom: 'atencao' };
    return { rotulo: 'Aviso', tom: 'neutro' };
  }
  if (tipo === 'erro' || tipo.includes('recusad')) return { rotulo: 'Evento', tom: 'critico' };
  if (tipo === 'lance-enviado') return { rotulo: 'Lance', tom: 'ativo' };
  return { rotulo: 'Evento', tom: 'neutro' };
}

const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** "17/09/2026 13:53:47" em Brasília. */
export function quandoEmBrasilia(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : QUANDO.format(d).replace(',', '');
}
