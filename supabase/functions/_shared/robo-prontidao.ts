/**
 * Lembrete de prontidão da disputa agendada (Fase 8, 16/09/2026).
 *
 * A disputa pode ser cadastrada com meses de antecedência, e nada lembrava
 * ninguém de que o robô ia entrar num pregão — nem conferia, antes da hora, o
 * que faria o robô não entrar ou entrar sem disputar. O agendador
 * (`robo-lances-webhook`, ação `disparar-agendadas`) passa a mandar dois
 * lembretes: na véspera (24 horas antes) e 1 hora antes, cada um com a
 * checagem junto.
 *
 * Tudo aqui é puro e testado (`src/components/robo-lances/test/prontidao.test.ts`):
 * quando lembrar, o que está pendente e o texto. Buscar os dados e gravar a
 * notificação fica no webhook.
 */

export type QualLembrete = "vespera" | "uma-hora";

/** Antecedência de cada lembrete, em minutos. */
export const MINUTOS_DA_VESPERA = 24 * 60;
export const MINUTOS_DO_ULTIMO_AVISO = 60;
/** O agendador despacha 15 minutos antes; daí em diante quem avisa é o robô entrando. */
export const MINUTOS_DO_DESPACHO = 15;

/**
 * Qual lembrete cabe agora, ou nenhum.
 *
 * Disputa cadastrada em cima da hora recebe só o que ainda faz sentido: a 40
 * minutos da sessão, o da véspera já não vale — vai o de 1 hora. Cada um sai
 * uma vez só (a coluna `lembrete_*_em` da disputa é a marca).
 */
export function qualLembrete(
  inicioSessao: Date,
  agora: Date,
  enviados: { vespera: string | null | undefined; umaHora: string | null | undefined },
): QualLembrete | null {
  const minutos = (inicioSessao.getTime() - agora.getTime()) / 60_000;
  if (!Number.isFinite(minutos) || minutos <= MINUTOS_DO_DESPACHO) return null;
  if (minutos <= MINUTOS_DO_ULTIMO_AVISO) return enviados.umaHora ? null : "uma-hora";
  if (minutos <= MINUTOS_DA_VESPERA) return enviados.vespera ? null : "vespera";
  return null;
}

export type Pendencia = {
  chave: string;
  /** Grave: o robô não entra, ou entra e alguém da equipe vai precisar agir. */
  grave: boolean;
  texto: string;
};

export type SessaoGovBr = "logado" | "vencida" | "sem-conferencia" | "robo-sem-resposta" | "nao-se-aplica";

export type EntradaDaProntidao = {
  itens: ReadonlyArray<{ valorMinimo?: number | string | null; estrategia?: string | null; margemDesempate?: number | string | null }>;
  /** Piso geral da disputa: vale para o item que não tem o seu. */
  valorMinimoGeral?: number | string | null;
  roboDaEmpresa: "ligado" | "desligado" | "indeterminado";
  temAgente: boolean;
  temCredencial: boolean;
  portalConhecido: boolean;
  /** Compras.gov: sem UASG, o número da compra se repete entre órgãos. */
  precisaUasg: boolean;
  uasg?: string | null;
  sessaoGovBr: SessaoGovBr;
  /** Hora (HH:MM, Brasília) da última conferência do vigia, quando houver. */
  sessaoConferidaAs?: string | null;
  /** `portais_com_lance_liberado` do robô inclui este portal? Nulo = não se sabe. */
  lanceLiberado: boolean | null;
};

const positivo = (v: unknown) => Number(v) > 0;

/** O que está pendente, das coisas que impedem o robô de entrar às que só limitam o que ele faz. */
export function pendenciasDaDisputa(e: EntradaDaProntidao): Pendencia[] {
  const p: Pendencia[] = [];
  const add = (chave: string, grave: boolean, texto: string) => p.push({ chave, grave, texto });

  if (e.roboDaEmpresa === "desligado") add("robo-desligado", true, "o robô da empresa está desligado — sem religar, ele não entra");
  if (!e.temAgente) add("sem-agente", true, "não há robô ativo configurado para quem cadastrou a disputa");
  if (!e.portalConhecido) add("portal-desconhecido", true, "o portal da disputa não é um que o robô conhece — reabra a disputa e escolha o portal");
  else if (!e.temCredencial) add("sem-credencial", true, "falta a credencial do portal (Robô de Lances → Portais)");
  if (e.precisaUasg && !String(e.uasg || "").trim()) add("sem-uasg", true, "falta a UASG: sem ela o robô pode abrir a compra de outro órgão");
  if (e.itens.length === 0) add("sem-itens", true, "a disputa não tem item cadastrado");
  if (e.sessaoGovBr === "vencida") {
    add(
      "gov-br-vencida",
      true,
      `a sessão do gov.br venceu${e.sessaoConferidaAs ? ` (conferida às ${e.sessaoConferidaAs})` : ""} — a equipe Praefectus vai confirmar o acesso quando o robô entrar`,
    );
  }
  if (e.sessaoGovBr === "robo-sem-resposta") add("robo-sem-resposta", true, "o robô não respondeu à conferência agora — a equipe Praefectus foi avisada");

  const pisoGeral = positivo(e.valorMinimoGeral);
  const semPiso = pisoGeral ? 0 : e.itens.filter((i) => !positivo(i.valorMinimo)).length;
  if (semPiso) add("itens-sem-piso", false, `${semPiso} ${semPiso === 1 ? "item está" : "itens estão"} sem piso — o robô não disputa item sem valor mínimo`);
  const semMargem = e.itens.filter((i) => i.estrategia === "desempatar_1o" && !positivo(i.margemDesempate)).length;
  if (semMargem) add("desempate-sem-margem", false, `${semMargem} ${semMargem === 1 ? "item" : "itens"} em "Desempatar no 1º lugar" sem margem`);
  if (e.roboDaEmpresa === "indeterminado") add("ligado-indeterminado", false, "não foi possível confirmar se o robô da empresa está ligado");
  if (e.sessaoGovBr === "sem-conferencia") add("gov-br-sem-conferencia", false, "a sessão do gov.br ainda não foi conferida pelo robô");
  if (e.lanceLiberado === false) add("lance-travado", false, "o envio de lances ainda não foi liberado para este portal: o robô entra e só acompanha");
  return p;
}

const FUSO = "America/Sao_Paulo";
const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const horaEmBrasilia = (d: Date) => HORA.format(d);

/** "hoje", "amanhã" ou "em 23/10", pelo calendário de Brasília. */
export function quandoEmBrasilia(inicio: Date, agora: Date): string {
  const [a, b] = [DIA.format(inicio), DIA.format(agora)];
  const dias = Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  const [, mes, dia] = a.split("-");
  return `em ${dia}/${mes}`;
}

export function textoDoLembrete(entrada: {
  qual: QualLembrete;
  edital: string;
  portalNome?: string | null;
  inicioSessao: Date;
  agora: Date;
  pendencias: Pendencia[];
}): { titulo: string; mensagem: string; tipo: "alerta" | "lembrete" } {
  const quando = quandoEmBrasilia(entrada.inicioSessao, entrada.agora);
  const hora = horaEmBrasilia(entrada.inicioSessao);
  const entra = horaEmBrasilia(new Date(entrada.inicioSessao.getTime() - MINUTOS_DO_DESPACHO * 60_000));
  const graves = entrada.pendencias.filter((p) => p.grave);
  const avisos = entrada.pendencias.filter((p) => !p.grave);

  const Quando = quando.charAt(0).toUpperCase() + quando.slice(1);
  const titulo = graves.length
    ? `⚠️ Pregão ${quando} às ${hora} com pendência — ${entrada.edital}`
    : entrada.qual === "uma-hora"
      ? `⏰ Pregão em 1 hora — ${entrada.edital}`
      : `🗓️ Pregão ${quando} às ${hora} — ${entrada.edital}`;

  const partes = [
    `${Quando} às ${hora} é a sessão do pregão ${entrada.edital}${entrada.portalNome ? ` (${entrada.portalNome})` : ""}. O robô entra sozinho às ${entra}.`,
  ];
  if (graves.length) partes.push(`Antes, resolva: ${graves.map((p) => p.texto).join("; ")}.`);
  else partes.push("Conferido: robô ligado, credencial do portal cadastrada e itens prontos.");
  if (avisos.length) partes.push(`Atenção: ${avisos.map((p) => p.texto).join("; ")}.`);

  return { titulo, mensagem: partes.join(" "), tipo: graves.length ? "alerta" : "lembrete" };
}

/**
 * A pasta do perfil do Chrome que o robô usa para esta credencial — o mesmo
 * cálculo do `perfilDaSessao` do agente (`comprasgov-` + 16 primeiros
 * caracteres do sha256 de "comprasgov:<login>"). É por ela que o `/health` do
 * robô diz se a sessão do gov.br daquela conta está logada.
 */
export async function perfilDoComprasGov(login: string): Promise<string> {
  const bytes = new TextEncoder().encode(`comprasgov:${login}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return "comprasgov-" + Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** O que o vigia disse sobre um perfil, a partir do `vigia_sessao` do `/health`. */
export function sessaoDoPerfil(
  vigia: { perfis?: ReadonlyArray<{ perfil?: string; ultimo?: string; em?: string }> } | null | undefined,
  perfil: string,
): { estado: SessaoGovBr; em: Date | null } {
  const achado = (vigia?.perfis || []).find((p) => p.perfil === perfil);
  if (!achado) return { estado: "sem-conferencia", em: null };
  const em = achado.em ? new Date(achado.em) : null;
  const estado: SessaoGovBr =
    achado.ultimo === "logado" ? "logado"
    : achado.ultimo === "vencida" || achado.ultimo === "vencida-sem-novo-login" ? "vencida"
    : "sem-conferencia";
  return { estado, em: em && !Number.isNaN(em.getTime()) ? em : null };
}
