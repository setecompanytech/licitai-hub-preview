import { MINUTOS_DE_ANTECEDENCIA } from '@/lib/robo/agendamento';

/**
 * O robô agendado no calendário (Fase 8, 16/09/2026).
 *
 * O calendário mostrava os processos pela data, e nada dizia que o robô ia
 * entrar num deles. Aqui fica a leitura das disputas agendadas: por processo
 * (o selo "Robô entra às 08:45" no card do processo) e por dia (o marcador no
 * calendário e as disputas que não estão ligadas a processo nenhum).
 */

export type DisputaNoCalendario = {
  id: string;
  edital: string | null;
  inicio_sessao: string | null;
  licitacao_id: string | null;
};

const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** A hora (Brasília) em que o robô entra: 15 minutos antes da sessão. */
export function horaDeEntradaDoRobo(inicioSessao: string): string | null {
  const d = new Date(inicioSessao);
  if (Number.isNaN(d.getTime())) return null;
  return HORA.format(new Date(d.getTime() - MINUTOS_DE_ANTECEDENCIA * 60_000));
}

/**
 * Agrupa as disputas agendadas por processo e por dia.
 *
 * @param chaveDoDia a mesma função que o calendário usa para o dia dos
 *        processos — assim o robô cai no mesmo quadradinho que o processo.
 */
export function agendaDoRobo(
  disputas: ReadonlyArray<DisputaNoCalendario>,
  chaveDoDia: (d: Date) => string,
): { porProcesso: Map<string, DisputaNoCalendario[]>; porDia: Map<string, DisputaNoCalendario[]> } {
  const porProcesso = new Map<string, DisputaNoCalendario[]>();
  const porDia = new Map<string, DisputaNoCalendario[]>();
  const ordenadas = [...disputas]
    .filter((d) => d.inicio_sessao && !Number.isNaN(new Date(d.inicio_sessao).getTime()))
    .sort((a, b) => new Date(a.inicio_sessao as string).getTime() - new Date(b.inicio_sessao as string).getTime());
  for (const d of ordenadas) {
    const dia = chaveDoDia(new Date(d.inicio_sessao as string));
    porDia.set(dia, [...(porDia.get(dia) ?? []), d]);
    if (d.licitacao_id) porProcesso.set(d.licitacao_id, [...(porProcesso.get(d.licitacao_id) ?? []), d]);
  }
  return { porProcesso, porDia };
}
