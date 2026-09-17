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

// ── O que fica no lugar do botão "Enviar ao robô" ──────────────────────────

/**
 * Depois do início da sessão o agendador ainda tenta entrar por este tempo (a
 * etapa aberta dura 10 minutos mais as prorrogações) — o mesmo número de
 * `MINUTOS_DE_TOLERANCIA_DEPOIS_DO_INICIO`, em `functions/_shared/robo-prontidao.ts`.
 */
export const MINUTOS_EM_QUE_O_AGENDADOR_AINDA_TENTA = 20;

export type AcaoPrincipalDaAgenda =
  /** Agendada, robô ligado: o destaque é a hora em que ele entra. */
  | { tipo: 'entra-sozinho'; texto: string }
  /** Agendada, mas o robô da empresa está desligado: não entra. */
  | { tipo: 'robo-desligado'; texto: string }
  /** Já passou a hora de entrar e a sessão ainda pode ser alcançada. */
  | { tipo: 'hora-de-entrar'; texto: string }
  /** Sem data e hora: o destaque leva a definir. */
  | { tipo: 'definir-data'; rotulo: string }
  /**
   * A sessão já passou. NÃO leva a "definir nova data" (Rafael, 17/09/2026):
   * pregão remarcado quase sempre volta com itens, quantidades e unidades
   * diferentes, e trocar só a data deixava o robô disputar com os pisos do
   * edital antigo. O destaque leva a conferir as alterações da licitação.
   */
  | { tipo: 'sessao-passou'; texto: string };

const diaCurto = (d: Date) => `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}`;

/**
 * A ação principal da página da disputa quando o robô não está na sala.
 *
 * Decisão de 17/09/2026 (Ian, sobre a D7 — "ligar/desligar, não enviar ao
 * robô", o modelo do ConLicitação): com data e hora, o robô entra sozinho, e o
 * destaque passa a ser QUANDO ele entra; o envio imediato vira "Entrar agora"
 * no menu Ações, para teste, disputa sem data ou nova tentativa.
 *
 * @param roboLigado o interruptor da empresa; leitura não confirmada conta como
 *        ligado — a tela não acusa o que não leu.
 */
/**
 * A sessão agendada já passou — além da janela em que o agendador ainda tenta
 * entrar. É a mesma régua do botão principal e da linha do cabeçalho.
 */
export function sessaoJaPassou(agenda: AgendamentoDaDisputa, agora: Date): boolean {
  return agenda.tipo === 'agendada' &&
    agora.getTime() > agenda.sessaoEm.getTime() + MINUTOS_EM_QUE_O_AGENDADOR_AINDA_TENTA * 60_000;
}

export function acaoPrincipalDaAgenda(agenda: AgendamentoDaDisputa, agora: Date, roboLigado: boolean): AcaoPrincipalDaAgenda {
  if (agenda.tipo !== 'agendada') return { tipo: 'definir-data', rotulo: 'Definir data da sessão' };
  const agoraMs = agora.getTime();
  if (sessaoJaPassou(agenda, agora)) {
    return { tipo: 'sessao-passou', texto: `A sessão de ${agenda.texto} já passou` };
  }
  const entrada = `${diaCurto(agenda.roboEntraEm)} às ${hora(agenda.roboEntraEm)}`;
  if (!roboLigado) return { tipo: 'robo-desligado', texto: `Robô da empresa desligado — não entra ${entrada}` };
  if (agoraMs >= agenda.roboEntraEm.getTime()) {
    return { tipo: 'hora-de-entrar', texto: `Entrada prevista ${entrada} — se o robô não entrou, use Ações › Entrar agora` };
  }
  return { tipo: 'entra-sozinho', texto: `Robô entra sozinho ${entrada}` };
}

// ── A sessão a partir do processo ──────────────────────────────────────────

const FUSO_DA_SESSAO = 'America/Sao_Paulo';
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const PARTES_EM_BRASILIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DA_SESSAO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Antes disto, o horário é incomum para sessão pública e a tela pede conferência. */
export const HORA_MINIMA_ESPERADA = 8;

export type SessaoDoProcesso = {
  /** `AAAA-MM-DD`, no formato do campo de data do formulário. */
  dataSessao: string;
  /** `HH:MM` em Brasília; nulo quando o processo só tem a data. */
  horario: string | null;
  /**
   * De qual coluna veio. Em processo importado do PNCP a `data_abertura`
   * costuma estar vazia e a data que existe é o fim do prazo de propostas —
   * no Compras.gov, praticamente a hora da sessão (7/2026: propostas até 08:59,
   * sessão às 09:00).
   */
  fonte: 'abertura' | 'encerramento';
  /** Horário antes das 8h: provável importação com o fuso errado (3 horas a menos). */
  horarioIncomum: boolean;
};

/**
 * Data e horário da sessão, lidos do processo (Fase 8, 16/09/2026).
 *
 * Antes, o cadastro da disputa puxava só a HORA do processo, e lia a hora em
 * UTC. Sem a data, o robô não entra sozinho; e ler em UTC atrasa em 3 horas
 * todo processo gravado com o fuso certo (pasta manual, crawler do PNCP) — o
 * robô chegaria depois de a sessão abrir.
 *
 * Aqui o instante gravado é lido em Brasília, como o resto do módulo lê
 * (`aberturaEmBrasilia`). Parte dos processos importados do PNCP está gravada
 * com o horário de Brasília como se fosse UTC e aparece 3 horas adiantada;
 * por isso o horário antes das 8h volta marcado, e a tela pede conferência.
 * Errar para antes deixa o robô esperando na sala; errar para depois perderia
 * o pregão.
 */
export function sessaoDoProcesso(processo: {
  data_abertura?: string | null;
  data_encerramento?: string | null;
}): SessaoDoProcesso | null {
  const fonte = processo.data_abertura ? 'abertura' : processo.data_encerramento ? 'encerramento' : null;
  if (!fonte) return null;
  const valor = String(fonte === 'abertura' ? processo.data_abertura : processo.data_encerramento).trim();

  // Coluna só com data não passa por `new Date`: seria meia-noite UTC, e em
  // Brasília viraria o dia anterior.
  if (SO_DATA.test(valor)) return { dataSessao: valor, horario: null, fonte, horarioIncomum: false };

  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return null;
  const partes = Object.fromEntries(PARTES_EM_BRASILIA.formatToParts(instante).map((p) => [p.type, p.value]));
  const horaDoDia = Number(partes.hour);
  return {
    dataSessao: `${partes.year}-${partes.month}-${partes.day}`,
    horario: `${partes.hour}:${partes.minute}`,
    fonte,
    horarioIncomum: horaDoDia < HORA_MINIMA_ESPERADA,
  };
}
