/**
 * Robô de Lances — o que é da EMPRESA e o que é da OPERAÇÃO PRAEFECTUS.
 * Decisões puras do `robo-lances-webhook`: sem Deno, sem esm.sh.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * Até 14/09/2026 o cliente via, na tela do próprio robô, endereço e versão do
 * agente, RAM, slots, o teste do freio e o erro técnico cru do portal — e só
 * tinha robô quem cadastrasse, pela própria tela, uma linha em
 * `agente_externo_config`. Nada disso é decisão dele. O limite certo é: o
 * cliente liga e desliga o robô da empresa, cuida do próprio acesso aos portais
 * e lê avisos escritos por gente. O resto é da operação da plataforma
 * (`user_roles.role = 'admin'`).
 *
 * Três consequências no servidor, todas decididas aqui:
 *
 *   1. AGENTE GERENCIADO SEM LINHA — quem não tem agente próprio usa o agente
 *      da plataforma, lido do segredo `AGENTE_URL_BASE`. Sem isso, tirar o
 *      "Configurar agente" da tela deixaria toda empresa nova sem robô.
 *   2. SAÚDE REDUZIDA — o `/health` do agente compartilhado traz as sessões e
 *      os pedidos de código de TODAS as empresas da VPS. O cliente recebe só
 *      as sessões que ele pode ver, sem nada de infraestrutura.
 *   3. FRASE DE NEGÓCIO — erro cru do agente ("fetch failed", "HTTP 502",
 *      endereço do host) não vai para o cliente. Vai para o `webhook_log`, e o
 *      administrador da plataforma o recebe em `detalhe_tecnico`.
 *
 * Sem import de Deno de propósito: o vitest importa este arquivo pelo caminho
 * relativo (`src/test/robo-plataforma.test.ts`).
 */

import { ehAgenteGerenciado, URL_AGENTE_GERENCIADO } from "./robo-acao.ts";

export const NOME_AGENTE_GERENCIADO = "Agente Praefectus";

// ─── Frases ao cliente ──────────────────────────────────────────────────────
//
// Num lugar só para que duas ações não descrevam o mesmo estado com palavras
// diferentes. Nenhuma cita agente, host, HTTP ou banco: dizem o que aconteceu
// com o trabalho da pessoa e o que ela pode fazer a seguir.
export const FRASES_AO_CLIENTE = {
  semRobo: "O robô não está disponível para a sua empresa no momento. Fale com o suporte.",
  roboDesligado:
    "O robô da sua empresa está desligado. Ligue-o no topo da tela do robô para iniciar sessões.",
  ligadoIncerto:
    "Não foi possível confirmar se o robô da sua empresa está ligado. Nada foi iniciado — " +
    "tente novamente em instantes.",
  roboForaDoAr:
    "O robô não respondeu agora. Tente novamente em alguns minutos; se persistir, fale com o suporte.",
  semRespostaATempo:
    "O robô não respondeu a tempo. A sessão pode ter começado mesmo assim — confira a lista de " +
    "sessões antes de enviar de novo.",
  sessaoNaoIniciada:
    "O robô não conseguiu iniciar a sessão no portal. Tente novamente em alguns minutos; se " +
    "persistir, fale com o suporte.",
  acessoRecusado:
    "O portal recusou o acesso com o login e a senha cadastrados. Confira a credencial em " +
    "Robô de Lances → Portais e tente novamente.",
  certificadoRecusado:
    "O portal exigiu o certificado digital e o robô não conseguiu apresentá-lo. Confira o " +
    "certificado no checklist de ativação.",
  capacidadeOcupada:
    "O robô está com a capacidade ocupada no momento. Tente novamente quando uma sessão terminar.",
  portalNaoOperado: "O robô ainda não opera este portal.",
  falhaInterna:
    "Não foi possível concluir o pedido agora. Tente novamente em instantes; se persistir, " +
    "fale com o suporte.",
  credencialIlegivel:
    "Não foi possível ler a credencial do portal agora. Tente novamente; se persistir, fale " +
    "com o suporte.",
  focoNaoAconteceu:
    "Não foi possível trazer a janela desta sessão para a frente agora. A sessão continua " +
    "rodando normalmente.",
  semPedidoEmAberto:
    "O robô não tinha pedido em aberto para esta sessão — a tela pode ter seguido sozinha, ou " +
    "a sessão já terminou.",
  paradaSemConfirmacao: "O robô ainda não confirmou o encerramento.",
  freioSemConfirmacao: "O robô não confirmou a parada.",
  freioNaoVerificado: "A parada de emergência ainda não foi confirmada pela operação Praefectus.",
  certificadoNaoInstalado:
    "Não foi possível instalar o certificado no robô agora. Tente novamente em alguns minutos; " +
    "se persistir, fale com o suporte.",
  certificadoSenha:
    "O robô não conseguiu abrir o certificado com a senha informada. Envie o certificado " +
    "novamente, conferindo a senha.",
  certificadoAusenteNoRobo:
    "O certificado da sua empresa ainda não está pronto no robô. Use \"Instalar no robô\"; se " +
    "persistir, fale com o suporte.",
  sessaoNaoEncontrada: "Sessão não encontrada.",
  exclusivoDaPlataforma: "Configuração do agente é exclusiva da operação Praefectus.",
  foraDaEmpresa: "Você não faz parte desta empresa.",
  // `situacao-do-robo` — frases de ESTADO, não de ação recusada.
  situacaoDesligado: "O robô da sua empresa está desligado.",
  situacaoForaDoAr:
    "O robô está temporariamente fora do ar. Tente novamente em alguns minutos; se persistir, " +
    "fale com o suporte.",
  situacaoIlegivel: "Não foi possível consultar a situação do robô agora. Tente novamente em instantes.",
} as const;

/**
 * Corpo de erro para uma ação que o cliente chama.
 *
 * `error` é sempre a frase de negócio. O detalhe técnico só atravessa para o
 * administrador da plataforma — para os demais ele fica no `webhook_log`.
 */
export function corpoDeErro(
  frase: string,
  opcoes: { ehAdmin?: boolean; detalhe?: unknown; extra?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const corpo: Record<string, unknown> = { ...(opcoes.extra || {}), error: frase };
  if (opcoes.ehAdmin && opcoes.detalhe !== undefined && opcoes.detalhe !== null && opcoes.detalhe !== "") {
    corpo.detalhe_tecnico = opcoes.detalhe;
  }
  return corpo;
}

/** O texto de um erro qualquer, para ir ao log — nunca ao cliente. */
export function textoDoErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return typeof e === "string" ? e : "sem detalhe";
}

/** A falha foi de tempo (abortada pelo nosso timeout), e não de recusa? */
export function ehEstouroDeTempo(e: unknown): boolean {
  const nome = e && typeof e === "object" ? (e as { name?: unknown }).name : undefined;
  if (nome === "TimeoutError" || nome === "AbortError") return true;
  return /timed? ?out|aborted|signal timed out/i.test(textoDoErro(e));
}

/**
 * A recusa crua do agente, traduzida para o que a pessoa pode fazer.
 *
 * Categorias conservadoras: só vira frase específica o que tem conserto do lado
 * do cliente (credencial, certificado) ou que ele precisa saber para decidir
 * (capacidade, portal não operado). O resto cai no `padrao` — é melhor uma
 * frase genérica e verdadeira do que uma específica e errada.
 *
 * Certificado vem antes de login: "login com certificado falhou" é problema
 * de certificado, e a ordem inversa mandaria a pessoa trocar a senha.
 */
export function motivoDeNegocio(
  textoCru: unknown,
  padrao: string = FRASES_AO_CLIENTE.sessaoNaoIniciada,
): string {
  const t = typeof textoCru === "string" ? textoCru : "";
  if (!t.trim()) return padrao;
  if (/certificad/i.test(t)) return FRASES_AO_CLIENTE.certificadoRecusado;
  if (/credencia|senha|password|login|usu[aá]rio .*inv[aá]lid|autentica/i.test(t)) {
    return FRASES_AO_CLIENTE.acessoRecusado;
  }
  if (/sem slots|slots? (livres|dispon)|capacidade/i.test(t)) return FRASES_AO_CLIENTE.capacidadeOcupada;
  if (/n[aã]o suportad|not supported|n[aã]o (tem|possui) o m[oó]dulo/i.test(t)) {
    return FRASES_AO_CLIENTE.portalNaoOperado;
  }
  if (/timed? ?out|aborted/i.test(t)) return FRASES_AO_CLIENTE.semRespostaATempo;
  if (/fetch failed|econn|network|sending request|dns|getaddrinfo|connection|unreachable|http 5\d\d/i.test(t)) {
    return FRASES_AO_CLIENTE.roboForaDoAr;
  }
  return padrao;
}

// ─── Administrador da plataforma ────────────────────────────────────────────

type ClienteSupabaseMinimo = { from: (tabela: string) => any };

const cacheDeAdmin = new WeakMap<object, Map<string, Promise<boolean>>>();

/**
 * O usuário é administrador da PLATAFORMA (`user_roles.role = 'admin'`)?
 *
 * Não confundir com o admin da EMPRESA (`empresa_membros.papel = 'admin'`),
 * que manda na própria empresa e em nada da operação.
 *
 * Cache por cliente: a edge function cria um cliente por requisição, então o
 * cache vive exatamente uma requisição — uma ação que pergunta duas vezes não
 * consulta duas vezes, e uma troca de papel vale na chamada seguinte.
 *
 * Falha de leitura responde `false`: na dúvida, o usuário recebe a visão do
 * cliente, que é a que não expõe nada.
 */
export function ehAdminDaPlataforma(cliente: ClienteSupabaseMinimo, userId: string | null | undefined): Promise<boolean> {
  if (!cliente || !userId) return Promise.resolve(false);
  let porUsuario = cacheDeAdmin.get(cliente);
  if (!porUsuario) {
    porUsuario = new Map();
    cacheDeAdmin.set(cliente, porUsuario);
  }
  const emCache = porUsuario.get(userId);
  if (emCache) return emCache;

  const consulta = Promise.resolve()
    .then(() =>
      cliente.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").limit(1)
    )
    .then((r: { data?: unknown; error?: unknown }) => {
      if (r?.error) {
        console.error("robo-plataforma: não foi possível ler user_roles:", textoDoErro(r.error));
        return false;
      }
      return Array.isArray(r?.data) && r.data.length > 0;
    })
    .catch((e: unknown) => {
      console.error("robo-plataforma: não foi possível ler user_roles:", textoDoErro(e));
      return false;
    });
  porUsuario.set(userId, consulta);
  return consulta;
}

// ─── Tabelas novas que podem ainda não existir ──────────────────────────────

/**
 * O erro do banco é "essa TABELA não existe"?
 *
 * `robo_empresa_config` e `robo_avisos_portal` vêm da migration
 * 20260914000004, que pode não ter sido colada no SQL Editor quando a função
 * for publicada. Nesse caso vale o comportamento anterior: robô ligado.
 *
 * `42P01` é o Postgres (undefined_table); `PGRST205` é o PostgREST quando a
 * tabela não está no cache de schema.
 */
export function erroDeTabelaAusente(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (code === "42P01" || code === "PGRST205") return true;
  const texto = typeof message === "string" ? message : "";
  return /does not exist|could not find the table/i.test(texto);
}

export type EstadoDoLigado = {
  estado: "ligado" | "desligado" | "indeterminado";
  /** De onde veio a resposta — para o log, não para a tela. */
  origem: "linha" | "sem-linha" | "tabela-ausente" | "erro";
  detalhe: string | null;
};

/**
 * O robô da empresa está ligado, a partir da leitura de `robo_empresa_config`.
 *
 * Sem linha ou sem tabela = LIGADO (CLAUDE.md, princípio 7: quem ainda não
 * escolheu não pode ser bloqueado por uma escolha que ninguém fez).
 *
 * Erro de outro tipo é `indeterminado`, e não "ligado": desligar é a decisão
 * de alguém de NÃO operar, e uma falha de leitura não pode atropelá-la.
 */
export function estadoDoLigado(leitura: { data?: unknown; error?: unknown } | null | undefined): EstadoDoLigado {
  const erro = leitura?.error;
  if (erro) {
    if (erroDeTabelaAusente(erro)) return { estado: "ligado", origem: "tabela-ausente", detalhe: null };
    return { estado: "indeterminado", origem: "erro", detalhe: textoDoErro(erro) };
  }
  const linha = leitura?.data as { ligado?: unknown } | null | undefined;
  if (!linha) return { estado: "ligado", origem: "sem-linha", detalhe: null };
  return linha.ligado === false
    ? { estado: "desligado", origem: "linha", detalhe: null }
    : { estado: "ligado", origem: "linha", detalhe: null };
}

// ─── Agentes: o próprio ou o da plataforma ──────────────────────────────────

export type AgenteChamavel = {
  /** `null` no agente gerenciado — ele não tem linha em `agente_externo_config`. */
  id: string | null;
  nome: string;
  url_base: string;
  api_key_hash?: string | null;
  /** `true` só no agente que veio do segredo `AGENTE_URL_BASE`. */
  gerenciado: boolean;
  [coluna: string]: unknown;
};

/** Endereço utilizável (http/https), sem barra no fim — ou `null`. */
export function normalizarUrlBase(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null;
  const limpa = url.trim().replace(/\/+$/, "");
  try {
    const u = new URL(limpa);
    return u.protocol === "http:" || u.protocol === "https:" ? limpa : null;
  } catch {
    return null;
  }
}

/** O agente da plataforma, a partir do segredo — ou `null` sem segredo válido. */
export function agenteGerenciadoDoAmbiente(urlBase: unknown): AgenteChamavel | null {
  const url = normalizarUrlBase(urlBase);
  if (!url) return null;
  return { id: null, nome: NOME_AGENTE_GERENCIADO, url_base: url, api_key_hash: null, gerenciado: true };
}

/**
 * Os agentes que atendem este usuário.
 *
 * Tem linha própria (com os filtros que cada ação já aplica — `enviar-sessao`,
 * por exemplo, só as `ativo`)? Usa as próprias, como antes. Não tem? O agente
 * da plataforma, se o segredo `AGENTE_URL_BASE` existir. Nenhum dos dois:
 * lista vazia, e a ação responde que o robô não está disponível.
 *
 * A chave do gerenciado nunca é a da linha: `chaveParaOAgente` (robo-acao.ts)
 * devolve `AGENTE_API_KEY` para ele.
 */
export function agentesParaUsuario(
  proprios: ReadonlyArray<Record<string, unknown>> | null | undefined,
  env: { AGENTE_URL_BASE?: string | null } | null | undefined,
): AgenteChamavel[] {
  const linhas = (proprios || []).filter((a) => a && typeof a === "object");
  if (linhas.length) {
    return linhas.map((a) => ({
      ...a,
      id: typeof a.id === "string" ? a.id : null,
      nome: typeof a.nome === "string" ? a.nome : "Agente",
      url_base: typeof a.url_base === "string" ? a.url_base : "",
      gerenciado: false,
    }));
  }
  const gerenciado = agenteGerenciadoDoAmbiente(env?.AGENTE_URL_BASE);
  return gerenciado ? [gerenciado] : [];
}

/**
 * Soma o agente gerenciado DEPOIS dos que já foram escolhidos.
 *
 * Para as ações que agem sobre uma sessão já aberta (parar, freio): a sessão
 * pode viver nas linhas do dono OU no gerenciado (`agente_id` nulo), e só
 * perguntando aos dois se sabe. `deduplicar` pula o gerenciado quando alguma
 * linha já aponta para o mesmo endereço — o freio passa `false`, porque roteia
 * sessão por sessão e precisa do gerenciado para as de `agente_id` nulo.
 */
export function comAgenteGerenciado(
  agentes: ReadonlyArray<Record<string, unknown>> | null | undefined,
  env: { AGENTE_URL_BASE?: string | null } | null | undefined,
  opcoes: { primeiro?: boolean; deduplicar?: boolean } = {},
): AgenteChamavel[] {
  const proprios = agentesParaUsuario(agentes, null);
  const gerenciado = agenteGerenciadoDoAmbiente(env?.AGENTE_URL_BASE);
  if (!gerenciado) return proprios;
  const repetido = (opcoes.deduplicar ?? true) &&
    proprios.some((a) => normalizarUrlBase(a.url_base) === gerenciado.url_base);
  if (repetido) return proprios;
  return opcoes.primeiro ? [gerenciado, ...proprios] : [...proprios, gerenciado];
}

/**
 * O agente atende mais de uma empresa?
 *
 * O gerenciado sempre; e toda linha que aponte para o host da plataforma —
 * até 14/09/2026 cada empresa cadastrava a própria linha para o MESMO Agente
 * Cloud. Num agente assim, a rota `/kill-switch` derruba as sessões de todas
 * as empresas: o freio de uma não pode ser o apagão das outras.
 */
export function agenteCompartilhado(
  agente: { id?: unknown; url_base?: unknown; gerenciado?: unknown } | null | undefined,
  urlGerenciadaDoAmbiente?: string | null,
): boolean {
  if (!agente) return false;
  if (agente.gerenciado === true || agente.id === null || agente.id === undefined) return true;
  if (ehAgenteGerenciado(agente.url_base, URL_AGENTE_GERENCIADO)) return true;
  const doAmbiente = normalizarUrlBase(urlGerenciadaDoAmbiente);
  return doAmbiente ? ehAgenteGerenciado(agente.url_base, doAmbiente) : false;
}

/**
 * Em qual agente vive cada sessão, para o freio.
 *
 * `agente_id` que casa com uma linha → aquela linha. `agente_id` nulo (ou de
 * linha que não veio na leitura) → o gerenciado, se estiver na lista. Sem
 * gerenciado, a sessão fica em `semAgente` e vale a regra antiga: só conta
 * como parada se TODOS os agentes avisados confirmarem.
 */
export function rotearSessoes(
  sessoes: ReadonlyArray<{ id: string; agente_id?: string | null }>,
  agentes: ReadonlyArray<{ id: string | null; gerenciado?: boolean }>,
): { porAgente: Map<number, string[]>; semAgente: string[] } {
  const porAgente = new Map<number, string[]>();
  const semAgente: string[] = [];
  const idxGerenciado = agentes.findIndex((a) => a.gerenciado === true);
  for (const s of sessoes) {
    const alvo = s.agente_id ? agentes.findIndex((a) => a.id === s.agente_id) : -1;
    const idx = alvo >= 0 ? alvo : idxGerenciado;
    if (idx < 0) {
      semAgente.push(s.id);
      continue;
    }
    porAgente.set(idx, [...(porAgente.get(idx) || []), s.id]);
  }
  return { porAgente, semAgente };
}

// ─── Saúde para o cliente ───────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VIVOS = new Set(["ativo", "enviando", "pausado"]);

/** Tem forma de id do banco (UUID)? Consultar com outra coisa dá erro 22P02. */
export function ehUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/**
 * Quantas sessões estão de pé NO AGENTE, pela saúde crua dele.
 *
 * O maior entre a capacidade (que conta navegador aberto, pausadas inclusive)
 * e a lista de sessões vivas: é a pergunta "testar o freio agora derrubaria
 * alguém?", e na dúvida a resposta tem que ser sim.
 */
export function contarSessoesVivasNaSaude(saude: unknown): number {
  if (!saude || typeof saude !== "object") return 0;
  const s = saude as { capacidade?: { sessoes_ativas?: unknown }; sessoes_ativas?: unknown; sessoes?: unknown };
  const pelaCapacidade = Number(s.capacidade?.sessoes_ativas ?? s.sessoes_ativas ?? 0) || 0;
  const pelaLista = lista(s.sessoes).filter((x) => STATUS_VIVOS.has(String(x.status))).length;
  return Math.max(pelaCapacidade, pelaLista);
}

/**
 * O retrato da saúde que pode ser GUARDADO em `agente_externo_config.capacidades`.
 *
 * A linha é legível pelo dono dela. Num agente compartilhado, guardar o
 * `/health` inteiro punha na linha de uma empresa as sessões, os pedidos de
 * código e os titulares de certificado de todas as outras. Esses campos são
 * lidos ao vivo, nunca da linha — então não há o que perder.
 */
export function saudeParaGuardar(saude: unknown): Record<string, unknown> | null {
  if (!saude || typeof saude !== "object") return null;
  const { sessoes: _s, aguardando_humano: _a, desfechos_humano: _d, certificado: _c, ...resto } =
    saude as Record<string, unknown>;
  return resto;
}

function lista(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}

function escolher(obj: Record<string, unknown>, campos: readonly string[]): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const c of campos) if (c in obj) saida[c] = obj[c];
  return saida;
}

/**
 * Os ids de sessão que aparecem na saúde (sessões, pedidos, desfechos), só os
 * que têm forma de UUID — o resto não é sessão do Praefectus e derrubaria o
 * `.in("id", …)` do PostgREST com erro de tipo.
 */
export function idsDeSessaoNaSaude(saudeCompleta: { agentes?: unknown } | null | undefined): string[] {
  const ids = new Set<string>();
  for (const a of lista(saudeCompleta?.agentes)) {
    for (const campo of ["sessoes", "aguardando_humano", "desfechos_humano"]) {
      for (const item of lista(a[campo])) {
        const id = item.sessao_id;
        if (typeof id === "string" && UUID.test(id)) ids.add(id);
      }
    }
  }
  return [...ids];
}

const CAMPOS_SESSAO = [
  "sessao_id", "status", "portal_id", "portal_nome", "edital", "rodada",
  "valor_atual", "itens_recebidos", "itens_sem_piso", "conferencia",
] as const;
const CAMPOS_CONFERENCIA = ["leu", "ok", "resumo", "faltando", "sobrando_qtd", "divergencias"] as const;
const CAMPOS_PEDIDO = ["sessao_id", "tipo", "mensagem", "tela", "criado_em", "expira_em"] as const;
const CAMPOS_DESFECHO = ["sessao_id", "tipo", "desfecho", "em"] as const;

/**
 * O certificado, como o cliente pode vê-lo.
 *
 * Num agente compartilhado o Chrome guarda os certificados de várias
 * empresas, e `titulares` listaria a razão social e o CNPJ de todas. Passa só
 * o titular cujo nome contém um CNPJ das empresas do usuário (o apelido
 * ICP-Brasil de e-CNPJ é "RAZÃO SOCIAL:CNPJ").
 *
 * E `carregado` só é verdade para ELE quando um desses titulares está lá: um
 * verde apoiado no certificado de outra empresa seria a mentira que o
 * Checklist já contou por meses. Apelido sem CNPJ vira falso negativo — o
 * lado seguro do erro.
 */
export function certificadoParaCliente(
  certificado: unknown,
  cnpjsVisiveis: ReadonlyArray<string> | null | undefined,
): { carregado: boolean; motivo: string | null; titulares: string[] } | null {
  if (!certificado || typeof certificado !== "object") return null;
  const c = certificado as { carregado?: unknown; titulares?: unknown };
  const cnpjs = (cnpjsVisiveis || [])
    .map((x) => String(x || "").replace(/\D/g, ""))
    .filter((x) => x.length === 14);
  const titulares = (Array.isArray(c.titulares) ? c.titulares : [])
    .filter((t): t is string => typeof t === "string")
    .filter((t) => {
      const digitos = t.replace(/\D/g, "");
      return cnpjs.some((cnpj) => digitos.includes(cnpj));
    });
  const carregado = c.carregado === true && titulares.length > 0;
  return {
    carregado,
    motivo: carregado ? null : FRASES_AO_CLIENTE.certificadoAusenteNoRobo,
    titulares,
  };
}

/** O freio, como o cliente pode vê-lo: se está confirmado e quando. */
export function freioParaCliente(
  killSwitch: unknown,
): { ok: boolean; detalhe: string | null; testado_em: string | null } | null {
  if (!killSwitch || typeof killSwitch !== "object") return null;
  const k = killSwitch as { ok?: unknown; testado_em?: unknown };
  const ok = k.ok === true;
  return {
    ok,
    detalhe: ok ? null : FRASES_AO_CLIENTE.freioNaoVerificado,
    testado_em: typeof k.testado_em === "string" ? k.testado_em : null,
  };
}

/**
 * A saúde do robô reduzida para o CLIENTE.
 *
 * ── Contrato (o que sai, campo a campo) ─────────────────────────────────────
 *
 *   configurado        boolean — há robô para o usuário (próprio ou da plataforma)
 *   online             boolean — algum respondeu agora
 *   agentes[]          um item por agente, SEM id, nome, url_base, versao,
 *                      capacidade (RAM, slots), rotas, uptime nem erro cru:
 *     online           boolean
 *     erro             frase de negócio quando offline; null quando online
 *     sessoes_ativas   nº de sessões VISÍVEIS vivas (ativo/enviando/pausado);
 *                      null quando offline — "não deu para saber" ≠ zero
 *     sessoes[]        só as visíveis: sessao_id, status, portal_id,
 *                      portal_nome, edital, rodada, valor_atual,
 *                      itens_recebidos, itens_sem_piso, conferencia
 *                      (leu, ok, resumo, faltando, sobrando_qtd, divergencias)
 *     aguardando_humano[] só das visíveis: sessao_id, tipo, mensagem, tela,
 *                      criado_em, expira_em
 *     desfechos_humano[]  só das visíveis: sessao_id, tipo, desfecho, em
 *     portais_suportados  string[] | null
 *     certificado      { carregado, motivo, titulares } | null — ver
 *                      `certificadoParaCliente`
 *     kill_switch      { ok, detalhe, testado_em } | null — ver `freioParaCliente`
 *
 * "Visível" é decidido FORA daqui (sessões do usuário ou das empresas dele em
 * `sessoes_lance_real`) e chega pronto em `idsDeSessaoVisiveis`. Id que não
 * está no conjunto não sai — inclusive o código de verificação que outra
 * empresa está esperando digitar.
 */
export function reduzirSaudeParaCliente(
  saudeCompleta: { configurado?: unknown; online?: unknown; agentes?: unknown } | null | undefined,
  idsDeSessaoVisiveis: Iterable<string> | null | undefined,
  opcoes: { cnpjsVisiveis?: ReadonlyArray<string> | null } = {},
) {
  const visiveis = new Set(idsDeSessaoVisiveis || []);
  const ehVisivel = (item: Record<string, unknown>) =>
    typeof item.sessao_id === "string" && visiveis.has(item.sessao_id);

  const agentes = lista(saudeCompleta?.agentes).map((a) => {
    const online = a.online === true;
    const sessoes = lista(a.sessoes).filter(ehVisivel).map((s) => {
      const reduzida = escolher(s, CAMPOS_SESSAO);
      if (s.conferencia && typeof s.conferencia === "object") {
        reduzida.conferencia = escolher(s.conferencia as Record<string, unknown>, CAMPOS_CONFERENCIA);
      } else if ("conferencia" in reduzida) {
        reduzida.conferencia = null;
      }
      return reduzida;
    });
    const portais = Array.isArray(a.portais_suportados)
      ? a.portais_suportados.filter((p): p is string => typeof p === "string")
      : null;
    return {
      online,
      erro: online ? null : FRASES_AO_CLIENTE.roboForaDoAr,
      sessoes_ativas: online
        ? sessoes.filter((s) => STATUS_VIVOS.has(String(s.status))).length
        : null,
      sessoes,
      aguardando_humano: lista(a.aguardando_humano).filter(ehVisivel).map((p) => escolher(p, CAMPOS_PEDIDO)),
      desfechos_humano: lista(a.desfechos_humano).filter(ehVisivel).map((d) => escolher(d, CAMPOS_DESFECHO)),
      portais_suportados: portais,
      certificado: certificadoParaCliente(a.certificado, opcoes.cnpjsVisiveis),
      kill_switch: freioParaCliente(a.kill_switch),
    };
  });

  return {
    configurado: saudeCompleta?.configurado === true,
    online: agentes.some((a) => a.online),
    agentes,
  };
}

// ─── Respostas de ações, para o cliente ─────────────────────────────────────

/**
 * As tentativas de parar uma sessão, sem nome de agente nem erro cru.
 *
 * O front (`resumirTentativas`, src/lib/robo/comandos.ts) junta
 * `agente: motivo` — sem `agente`, sai só a frase.
 */
export function tentativasParaCliente(
  tentativas: ReadonlyArray<Record<string, unknown>> | null | undefined,
): Array<{ motivo: string }> {
  const lidas = tentativas || [];
  if (lidas.some((t) => t?.confirmou === true)) return [];
  const semAgente = lidas.length === 0 || lidas.every((t) => !t?.agente);
  return [{ motivo: semAgente ? FRASES_AO_CLIENTE.semRobo : FRASES_AO_CLIENTE.paradaSemConfirmacao }];
}

/**
 * O motivo da instalação do certificado, para o cliente.
 *
 * `instalarCertificadoNoAgente` já escreve em português, mas mistura frases de
 * negócio com erro de Storage, de decifragem e a resposta crua do agente
 * (caminho de arquivo, base NSS). Passam as duas frases que dizem à pessoa o
 * que fazer; senha errada vira instrução; o resto, a frase genérica.
 */
export function motivoDoCertificadoParaCliente(motivo: unknown): string | null {
  if (motivo === null || motivo === undefined || motivo === "") return null;
  const t = String(motivo);
  if (t.startsWith("Nenhum certificado enviado ainda.")) return t;
  if (t.startsWith("O certificado foi enviado antes de o sistema passar a guardar a senha.")) return t;
  if (/senha|password|mac verif|pkcs ?#?12/i.test(t)) return FRASES_AO_CLIENTE.certificadoSenha;
  return FRASES_AO_CLIENTE.certificadoNaoInstalado;
}
