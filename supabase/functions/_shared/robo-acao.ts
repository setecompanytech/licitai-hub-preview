/**
 * Decisões puras do `robo-lances-webhook` — sem Deno, sem esm.sh.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * Até 14/09/2026 a função lia a ação SÓ no último segmento da URL
 * (`/robo-lances-webhook/parar-sessao`). Três telas mandavam a ação no corpo
 * (`invoke('robo-lances-webhook', { body: { action: 'parar-sessao' } })`) e a
 * resposta era 404 "Ação desconhecida". O freio de uma sessão nunca chegava ao
 * agente — e nada na tela denunciava isso, porque o erro era tratado como
 * "a sessão já não estava rodando".
 *
 * Sem nenhum import de propósito: o vitest importa este arquivo pelo caminho
 * relativo (`src/test/robo-acao.test.ts`) e prende o comportamento em teste,
 * coisa que o `index.ts` da função — cheio de URLs do Deno — não permite.
 */

export const NOME_DA_FUNCAO = "robo-lances-webhook";

/**
 * A ação pedida. O segmento da URL vence; o corpo só é lido quando a URL
 * termina no nome da própria função (ou não tem segmento nenhum).
 *
 * A URL vence porque é a forma que os chamadores corretos (kill-switch,
 * healthcheck, callback do agente) sempre usaram — e o callback do agente
 * manda um corpo próprio que não pode, por acidente, redirecionar a ação.
 */
export function resolverAcao(pathname: string, body: unknown): string {
  const partes = String(pathname ?? "").split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1] ?? "";
  if (ultimo && ultimo !== NOME_DA_FUNCAO) return ultimo;

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const acao = (body as Record<string, unknown>).action;
    if (typeof acao === "string") return acao.trim();
  }
  return "";
}

/**
 * O erro do banco é "essa coluna não existe"?
 *
 * As colunas da parada em dois tempos vêm da migration 20260914000002, que
 * pode ainda não ter sido colada no SQL Editor quando a função for publicada.
 * Nesse caso a função precisa cair para o comportamento anterior e DIZER isso
 * — nunca derrubar o freio por causa de uma coluna.
 *
 * `42703` é o código do Postgres (undefined_column); `PGRST204` é o do
 * PostgREST quando a coluna não está no cache de schema.
 */
export function erroDeColunaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (code === "42703" || code === "PGRST204") return true;
  const texto = typeof message === "string" ? message : "";
  return /column .* does not exist|could not find the .* column/i.test(texto);
}

/** Endereço do agente que a plataforma opera (o "Agente Cloud"). */
export const URL_AGENTE_GERENCIADO = "https://agente.praefectus.com.br";

/**
 * O agente configurado é o gerenciado pela plataforma?
 *
 * Compara o HOSTNAME, não a string: barra no fim, porta ou caminho diferentes
 * não podem transformar o agente gerenciado num "agente próprio" cuja chave o
 * navegador escolhe.
 */
export function ehAgenteGerenciado(
  urlBase: unknown,
  urlGerenciada: string = URL_AGENTE_GERENCIADO,
): boolean {
  if (typeof urlBase !== "string" || !urlBase.trim()) return false;
  try {
    return new URL(urlBase.trim()).hostname.toLowerCase() ===
      new URL(urlGerenciada).hostname.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * A chave que vai em `X-Agent-Key` — e a que o callback exige de volta.
 *
 * Para o agente gerenciado, a chave é o segredo da edge function
 * (`AGENTE_API_KEY`), não o que está gravado na linha: assim a rotação da
 * chave é trocar o segredo e o `.env` da VPS, sem caçar linhas no banco. Sem o
 * segredo configurado, vale a linha — o comportamento anterior.
 *
 * Agente próprio (outro endereço) continua usando a chave que o dono cadastrou.
 */
export function chaveParaOAgente(
  agente: { url_base?: unknown; api_key_hash?: unknown } | null | undefined,
  chaveGerenciada: string | null | undefined,
): string {
  if (!agente) return "";
  if (chaveGerenciada && ehAgenteGerenciado(agente.url_base)) return chaveGerenciada;
  return typeof agente.api_key_hash === "string" ? agente.api_key_hash : "";
}
