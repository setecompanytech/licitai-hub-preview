/**
 * As notificações da central do fornecedor no Compras.gov, como avisos do
 * Praefectus (17/09/2026).
 *
 * O robô lê a central junto com o vigia da sessão (`src/central-notificacoes.js`
 * no agente) e as guarda; o agendador busca em `GET /notificacoes-portal` a cada
 * 5 minutos. Aqui mora a regra do que vira aviso, e com que urgência:
 * convocação, prazo de anexo, proposta ajustada, habilitação e recurso são o
 * que faz a empresa perder prazo se ninguém estiver com a tela aberta
 * (requisito do Giovanny, visto na tela do ConLicitação).
 */
import { instanteDeBrasilia, lerNumeroEAno } from "./compra-comprasgov.ts";

export type NotificacaoDoPortal = {
  id: string | null;
  lida?: boolean;
  texto: string;
  publicada_em: string | null;
  categoria?: string | null;
  contexto?: string | null;
  uasg: string | null;
  numero_compra: string | null;
  modalidade?: string | null;
  id_compra: string | null;
  item: number | null;
};

export type LeituraDoPerfil = {
  perfil: string;
  em?: string;
  ok?: boolean;
  etapa?: string | null;
  motivo?: string | null;
  total_nao_lidas?: number | null;
  itens?: NotificacaoDoPortal[];
};

export type Gravidade = "urgente" | "info";

/**
 * Só avisa o que foi publicado nas últimas 48 horas. A primeira leitura de uma
 * conta traz o acumulado de não lidas — semanas de avisos antigos virando
 * alerta de uma vez esconderiam o que importa agora.
 */
export const HORAS_PARA_AVISAR = 48;

const URGENTE =
  /convoca|anexo|proposta ajustada|readequ|dilig[eê]ncia|habilita|prazo|negocia|contraproposta|recurso|aceita[cç][aã]o|recusad|desclassific|inabilit|suspens|reabert|retorno de fase|amostra/i;

export function gravidadeDaNotificacaoDoPortal(texto: string | null | undefined): Gravidade {
  return URGENTE.test(String(texto ?? "")) ? "urgente" : "info";
}

/** A chave de deduplicação: o mesmo aviso nunca sai duas vezes para a mesma conta. */
export function chaveDaNotificacao(perfil: string, id: string): string {
  return `${perfil}:${id}`;
}

/**
 * O que ainda não virou aviso: leitura ok, com id, não lida, ainda não avisada e
 * publicada nas últimas `HORAS_PARA_AVISAR`. Sem data de publicação não avisa —
 * não há como saber se é de hoje ou do ano passado.
 */
export function notificacoesParaAvisar(
  perfis: ReadonlyArray<LeituraDoPerfil> | null | undefined,
  jaAvisadas: ReadonlySet<string>,
  agora: Date,
): Array<{ chave: string; perfil: string; notificacao: NotificacaoDoPortal; gravidade: Gravidade }> {
  const desde = agora.getTime() - HORAS_PARA_AVISAR * 3_600_000;
  const saida: Array<{ chave: string; perfil: string; notificacao: NotificacaoDoPortal; gravidade: Gravidade }> = [];
  for (const leitura of perfis ?? []) {
    if (!leitura?.ok || !leitura.perfil) continue;
    for (const n of leitura.itens ?? []) {
      if (!n?.id || n.lida === true) continue;
      const chave = chaveDaNotificacao(leitura.perfil, n.id);
      if (jaAvisadas.has(chave)) continue;
      const iso = instanteDeBrasilia(n.publicada_em);
      const publicada = iso ? Date.parse(iso) : NaN;
      if (!Number.isFinite(publicada) || publicada < desde) continue;
      saida.push({ chave, perfil: leitura.perfil, notificacao: n, gravidade: gravidadeDaNotificacaoDoPortal(n.texto) });
    }
  }
  return saida;
}

/** O aviso no sininho: a compra e o item no título, o texto do portal na mensagem. */
export function avisoDaNotificacaoDoPortal(
  n: NotificacaoDoPortal,
  gravidade: Gravidade,
): { titulo: string; mensagem: string; tipo: "urgente" | "info" } {
  const compra = n.numero_compra
    ? `compra ${n.numero_compra}${n.uasg ? ` (UASG ${n.uasg})` : ""}${n.item ? ` · item ${n.item}` : ""}`
    : "notificação do portal";
  const texto = String(n.texto || "").trim() || "O Compras.gov publicou uma notificação para a empresa.";
  return {
    tipo: gravidade,
    titulo: `${gravidade === "urgente" ? "📣" : "🔔"} Compras.gov — ${compra}`,
    mensagem: gravidade === "urgente"
      ? `${texto.slice(0, 400)} — confira o prazo no Compras.gov.`
      : texto.slice(0, 400),
  };
}

/** A disputa da mesma compra (UASG + número/ano), para o aviso levar até ela. */
export function disputaDaNotificacao<T extends { uasg?: string | null; edital?: string | null }>(
  n: NotificacaoDoPortal,
  disputas: ReadonlyArray<T>,
): T | null {
  const alvo = lerNumeroEAno(n.numero_compra);
  if (!alvo || !n.uasg) return null;
  const casam = disputas.filter((d) => {
    const doEdital = lerNumeroEAno(d.edital ?? null);
    return String(d.uasg ?? "").replace(/\D/g, "") === n.uasg && !!doEdital && doEdital.numero === alvo.numero && doEdital.ano === alvo.ano;
  });
  return casam.length === 1 ? casam[0] : null;
}
