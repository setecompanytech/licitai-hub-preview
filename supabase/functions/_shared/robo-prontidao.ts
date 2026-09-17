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

/**
 * ENTRADA ANTECIPADA (16/09/2026) — o "login antecipado" da Fase 4.
 *
 * A sessão do gov.br guardada no perfil valeu quase 4 horas sem clique (13:31 →
 * 17:26 em 16/09), mas não se sabe se atravessa a noite. Vencida, o captcha
 * aparece na entrada do robô — 15 minutos antes do pregão —, e o pedido espera
 * 10: se ninguém estiver olhando naquele quarto de hora, o pregão vai sem robô.
 *
 * Quando o vigia JÁ SABE que a sessão venceu, o robô entra 1 hora antes: o
 * pedido do clique chega com uma hora de folga, e se expirar sem resposta o
 * agendador pede de novo (`tentaEntrarDeNovo`). Com a sessão logada, ou sem
 * conferência, segue entrando 15 minutos antes — entrar cedo ocupa uma vaga do
 * servidor à toa.
 */
export const MINUTOS_DA_ENTRADA_ANTECIPADA = 60;

export function minutosDeAntecedencia(sessaoGovBr?: SessaoGovBr | null): number {
  return sessaoGovBr === "vencida" ? MINUTOS_DA_ENTRADA_ANTECIPADA : MINUTOS_DO_DESPACHO;
}

export function horaDaEntrada(inicioSessao: Date, sessaoGovBr?: SessaoGovBr | null): Date {
  return new Date(inicioSessao.getTime() - minutosDeAntecedencia(sessaoGovBr) * 60_000);
}

export function deveDespacharAgora(inicioSessao: Date, agora: Date, sessaoGovBr?: SessaoGovBr | null): boolean {
  return agora.getTime() >= horaDaEntrada(inicioSessao, sessaoGovBr).getTime();
}

/**
 * Depois do início da sessão ainda vale tentar entrar: a etapa aberta dura 10
 * minutos mais as prorrogações. Passado isso, o agendador não abre Chrome
 * (a janela dele também para em 30 minutos depois do início).
 */
export const MINUTOS_DE_TOLERANCIA_DEPOIS_DO_INICIO = 20;

/** O erro que o agente manda quando a espera do clique no captcha acaba sem ninguém. */
export function entradaFalhouPorFaltaDeClique(mensagem: unknown): boolean {
  return /login do gov\.?br n[aã]o foi conclu[ií]do/i.test(String(mensagem ?? ""));
}

/**
 * A entrada que falhou por falta de clique volta para a agenda?
 *
 * Só a do AGENDADOR (a disputa tem `enviada_em`; o botão não marca), só se a
 * sessão ainda estava entrando (`enviando` — nunca chegou à sala) e só enquanto
 * o pregão ainda pode ser alcançado. O limite de vezes é o das outras falhas
 * passageiras (`tentativas_envio`).
 */
export function tentaEntrarDeNovo(e: {
  mensagem: unknown;
  statusDaSessao: string | null | undefined;
  disputaEnviadaEm: string | null | undefined;
  inicioSessao: Date | null;
  agora: Date;
}): boolean {
  if (!entradaFalhouPorFaltaDeClique(e.mensagem)) return false;
  if (e.statusDaSessao !== "enviando" || !e.disputaEnviadaEm || !e.inicioSessao) return false;
  return e.inicioSessao.getTime() > e.agora.getTime() - MINUTOS_DE_TOLERANCIA_DEPOIS_DO_INICIO * 60_000;
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
  /** Quem cadastrou a disputa saiu da empresa (confirmado): o agendador não despacha. */
  donoForaDaEmpresa?: boolean;
  /** Interruptor "Modo Automático" da disputa: desligado, o robô entra e só acompanha. */
  modoAutomatico?: boolean | null;
  /**
   * Documentos da empresa (certidões) vencidos ou que vencem até o dia da sessão
   * — a habilitação vem logo depois dos lances (16/09/2026). Nulo = não lido.
   */
  documentosVencendo?: ReadonlyArray<{ nome: string; validade: string }> | null;
  /**
   * O robô ainda não lê o tempo restante da etapa neste portal (Compras.gov:
   * só a sala logada mostra, e ela não foi mapeada). Sem ele, "Iminência" só
   * acompanha — achado na auditoria de 16/09/2026.
   */
  portalSemTempoRestante?: boolean;
};

/**
 * Os documentos da empresa que não chegam válidos ao dia da sessão: validade
 * (data, sem hora) antes do dia da sessão em Brasília. A habilitação pode ser
 * pedida na mesma sessão, logo depois dos lances.
 */
export function documentosQueVencemAteASessao(
  documentos: ReadonlyArray<{ nome: string; validade: string | null }>,
  inicioSessao: Date,
): Array<{ nome: string; validade: string }> {
  const diaDaSessao = DIA.format(inicioSessao);
  return documentos
    .filter((d): d is { nome: string; validade: string } => !!d.validade && d.validade.slice(0, 10) < diaDaSessao)
    .sort((a, b) => a.validade.localeCompare(b.validade));
}

const positivo = (v: unknown) => Number(v) > 0;

/** O que está pendente, das coisas que impedem o robô de entrar às que só limitam o que ele faz. */
export function pendenciasDaDisputa(e: EntradaDaProntidao): Pendencia[] {
  const p: Pendencia[] = [];
  const add = (chave: string, grave: boolean, texto: string) => p.push({ chave, grave, texto });

  if (e.donoForaDaEmpresa) add("dono-fora-da-empresa", true, "quem cadastrou a disputa não é mais membro da empresa — um membro precisa reabrir e enviar a disputa, senão o robô não entra");
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
      `a sessão do gov.br venceu${e.sessaoConferidaAs ? ` (conferida às ${e.sessaoConferidaAs})` : ""} — o robô entra 1 hora antes, e a equipe Praefectus confirma o acesso quando ele pedir`,
    );
  }
  if (e.sessaoGovBr === "robo-sem-resposta") add("robo-sem-resposta", true, "o robô não respondeu à conferência agora — a equipe Praefectus foi avisada");

  const pisoGeral = positivo(e.valorMinimoGeral);
  const semPiso = pisoGeral ? 0 : e.itens.filter((i) => !positivo(i.valorMinimo)).length;
  if (semPiso) add("itens-sem-piso", false, `${semPiso} ${semPiso === 1 ? "item está" : "itens estão"} sem piso — o robô não disputa item sem valor mínimo`);
  const semMargem = e.itens.filter((i) => i.estrategia === "desempatar_1o" && !positivo(i.margemDesempate)).length;
  if (semMargem) add("desempate-sem-margem", false, `${semMargem} ${semMargem === 1 ? "item" : "itens"} em "Desempatar no 1º lugar" sem margem`);
  // Com lance travado ou modo automático desligado o robô já só acompanha — o
  // aviso da iminência seria repetição.
  const iminencia = e.itens.filter((i) => i.estrategia === "iminencia").length;
  if (iminencia && e.portalSemTempoRestante && e.lanceLiberado !== false && e.modoAutomatico !== false) {
    add(
      "iminencia-sem-tempo",
      false,
      `${iminencia} ${iminencia === 1 ? "item" : "itens"} em "Iminência": neste portal o robô ainda não lê o tempo restante da sala, então nesses itens ele só acompanha — para disputar, use "Melhor preço"`,
    );
  }
  if (e.roboDaEmpresa === "indeterminado") add("ligado-indeterminado", false, "não foi possível confirmar se o robô da empresa está ligado");
  if (e.sessaoGovBr === "sem-conferencia") add("gov-br-sem-conferencia", false, "a sessão do gov.br ainda não foi conferida pelo robô");
  if (e.lanceLiberado === false) add("lance-travado", false, "o envio de lances ainda não foi liberado para este portal: o robô entra e só acompanha");
  else if (e.modoAutomatico === false) add("modo-automatico-desligado", false, "o modo automático está desligado nesta disputa: o robô entra e só acompanha, sem dar lance");
  if (e.documentosVencendo && e.documentosVencendo.length) {
    const lista = e.documentosVencendo.slice(0, 3).map((d) => `${d.nome} (${d.validade.slice(8, 10)}/${d.validade.slice(5, 7)})`).join(", ");
    const mais = e.documentosVencendo.length > 3 ? ` e mais ${e.documentosVencendo.length - 3}` : "";
    add(
      "documentos-vencidos",
      false,
      `${e.documentosVencendo.length === 1 ? "1 documento da empresa não estará válido" : `${e.documentosVencendo.length} documentos da empresa não estarão válidos`} no dia da sessão, e a habilitação vem logo depois dos lances: ${lista}${mais}`,
    );
  }
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
  /** Para o "Conferido" dizer que a sessão do gov.br está ativa, quando o vigia confirmou. */
  sessaoGovBr?: SessaoGovBr;
  sessaoConferidaAs?: string | null;
}): { titulo: string; mensagem: string; tipo: "alerta" | "lembrete" } {
  const quando = quandoEmBrasilia(entrada.inicioSessao, entrada.agora);
  const hora = horaEmBrasilia(entrada.inicioSessao);
  const entra = horaEmBrasilia(horaDaEntrada(entrada.inicioSessao, entrada.sessaoGovBr));
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
  else {
    const govBr = entrada.sessaoGovBr === "logado"
      ? `, sessão do gov.br ativa${entrada.sessaoConferidaAs ? ` (conferida às ${entrada.sessaoConferidaAs})` : ""}`
      : "";
    partes.push(`Conferido: robô ligado, credencial do portal cadastrada${govBr} e itens prontos.`);
  }
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

/**
 * Sessões do gov.br que o vigia achou vencidas e ainda não viraram aviso
 * (Fase 8, 16/09/2026).
 *
 * O vigia confere cada perfil a cada 20 minutos, mas só registrava no log: a
 * equipe descobria a sessão vencida quando o robô pedia o captcha, na hora do
 * pregão. A chave do aviso é perfil + instante da conferência: o vigia guarda o
 * PRIMEIRO "vencida" e não bate de novo no gov.br até um login novo, então a
 * mesma sessão vencida gera um aviso só, e uma que vença de novo depois de
 * renovada gera outro.
 */
export function sessoesVencidasParaAvisar(
  vigia: { perfis?: ReadonlyArray<{ perfil?: string; ultimo?: string; em?: string }> } | null | undefined,
  jaAvisadas: ReadonlySet<string>,
): Array<{ perfil: string; em: string; chave: string }> {
  return (vigia?.perfis || [])
    .filter((p) => p.perfil && p.em && (p.ultimo === "vencida" || p.ultimo === "vencida-sem-novo-login"))
    .map((p) => ({ perfil: String(p.perfil), em: String(p.em), chave: `${p.perfil}@${p.em}` }))
    .filter((p) => !jaAvisadas.has(p.chave));
}

export function textoDaSessaoVencida(entrada: {
  conferidaEm: Date;
  agora: Date;
  proxima?: { edital: string; inicioSessao: Date } | null;
}): { titulo: string; mensagem: string } {
  const partes = [
    `O vigia do robô encontrou a sessão do gov.br vencida na conferência das ${horaEmBrasilia(entrada.conferidaEm)}.`,
    "Na próxima entrada, o robô vai pedir a confirmação do acesso pela tela remota (clique em \"Seu certificado digital\").",
  ];
  if (entrada.proxima) {
    const inicio = entrada.proxima.inicioSessao;
    const entra = horaDaEntrada(inicio, "vencida");
    partes.push(
      `Próxima disputa: ${entrada.proxima.edital}, ${quandoEmBrasilia(inicio, entrada.agora)} às ${horaEmBrasilia(inicio)} — o robô entra às ${horaEmBrasilia(entra)}, 1 hora antes, para dar tempo ao clique. Fique de olho nesse horário.`,
    );
  } else {
    partes.push("Nenhuma disputa agendada nos próximos 7 dias para esta conta.");
  }
  return { titulo: "🔐 Sessão do gov.br venceu — Compras.gov.br", mensagem: partes.join(" ") };
}
