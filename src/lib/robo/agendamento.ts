/**
 * Quando o robô entra sozinho numa disputa — em texto, para a tela dizer.
 *
 * O agendador (`robo-lances-webhook`, ação `disparar-agendadas`) despacha a
 * disputa que tem DATA E HORÁRIO da sessão, 15 minutos antes. Até 16/09/2026 a
 * tela mostrava só o horário ("Sessão: 09:00"), em três lugares, e nenhum
 * avisava quando faltava a data — quem preenchesse só o horário achava que
 * tinha agendado, e o robô não entrava. Com disputa cadastrada com meses de
 * antecedência, a data é o que mais importa ler.
 */

/** Quantos minutos antes da sessão o agendador despacha o robô. */
export const MINUTOS_DE_ANTECEDENCIA = 15;

export type AgendamentoDaDisputa =
  | { tipo: 'agendada'; sessaoEm: Date; roboEntraEm: Date; texto: string; textoEntrada: string }
  | { tipo: 'so-horario'; texto: string }
  | { tipo: 'so-data'; texto: string }
  | { tipo: 'sem-agenda' };

const doisDigitos = (n: number) => String(n).padStart(2, '0');
const hora = (d: Date) => `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
const dia = (d: Date) => `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * @param entrada o instante gravado (`inicio_sessao`, do banco) ou a data e o
 *        horário do formulário. O horário sozinho não agenda: sem data, o
 *        agendador não tem o que ler.
 */
export function agendamentoDaDisputa(entrada: {
  inicioSessao?: string | null;
  dataSessao?: string | null;
  horario?: string | null;
}): AgendamentoDaDisputa {
  const horario = (entrada.horario ?? '').trim().slice(0, 5);
  const temHorario = /^\d{2}:\d{2}$/.test(horario);

  let sessaoEm: Date | null = null;
  if (entrada.inicioSessao) {
    const d = new Date(entrada.inicioSessao);
    if (!Number.isNaN(d.getTime())) sessaoEm = d;
  } else if (entrada.dataSessao && temHorario) {
    const d = new Date(`${entrada.dataSessao}T${horario}:00`);
    if (!Number.isNaN(d.getTime())) sessaoEm = d;
  }

  if (sessaoEm) {
    const roboEntraEm = new Date(sessaoEm.getTime() - MINUTOS_DE_ANTECEDENCIA * 60_000);
    return {
      tipo: 'agendada',
      sessaoEm,
      roboEntraEm,
      texto: `${dia(sessaoEm)} às ${hora(sessaoEm)}`,
      textoEntrada: mesmoDia(sessaoEm, roboEntraEm)
        ? `às ${hora(roboEntraEm)}`
        : `em ${dia(roboEntraEm)} às ${hora(roboEntraEm)}`,
    };
  }
  if (entrada.dataSessao) {
    const d = new Date(`${entrada.dataSessao}T12:00:00`);
    return { tipo: 'so-data', texto: Number.isNaN(d.getTime()) ? entrada.dataSessao : dia(d) };
  }
  if (temHorario) return { tipo: 'so-horario', texto: horario };
  return { tipo: 'sem-agenda' };
}
