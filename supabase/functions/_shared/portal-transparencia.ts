/**
 * Portal da Transparência — a API REST do Governo Federal por uma porta só
 * (22/09/2026). Especificação lida em api.portaldatransparencia.gov.br/v3/api-docs.
 *
 * O que este módulo garante e as funções de borda não garantiam:
 *  · o NOME do parâmetro de cada cadastro é o da especificação atual —
 *    /ceis e /cnep filtram por `codigoSancionado`; /cepim e /acordos-leniencia
 *    por `cnpjSancionado`. O nome antigo vai junto: parâmetro desconhecido é
 *    ignorado pela API, o conhecido filtra, e a consulta não depende de qual
 *    versão está no ar;
 *  · a CONFERÊNCIA do filtro: cada registro devolvido é lido e só fica o que
 *    cita o CNPJ consultado. Se a API devolver registros de outros CNPJs e
 *    nenhum deste, o filtro não foi aplicado, e o resultado é ERRO — nunca
 *    "encontrado". Foi o risco de 22/09: com o parâmetro errado, a primeira
 *    página do cadastro inteiro acusava toda empresa;
 *  · a ficha da pessoa jurídica (/pessoa-juridica) cruzada com os cadastros:
 *    divergência entre a bandeira e o cadastro vira aviso, não silêncio.
 *
 * Sem `Deno.*` de propósito: a chave e o `fetch` entram por parâmetro, e o
 * módulo é testado pelo vitest do front (src/lib/concorrentes/__tests__).
 */
export const PORTAL_BASE = "https://api.portaldatransparencia.gov.br/api-de-dados";
export const URL_CADASTRO_CHAVE = "https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email";

export type Cadastro = "ceis" | "cnep" | "cepim" | "leniencia";

export const NOME_DO_CADASTRO: Record<Cadastro, string> = {
  ceis: "CEIS",
  cnep: "CNEP",
  cepim: "CEPIM",
  leniencia: "Leniência",
};

export const DESCRICAO_DO_CADASTRO: Record<Cadastro, string> = {
  ceis: "Cadastro de Empresas Inidôneas e Suspensas",
  cnep: "Cadastro Nacional de Empresas Punidas (Lei 12.846/2013)",
  cepim: "Entidades Privadas sem Fins Lucrativos Impedidas",
  leniencia: "Acordos de Leniência (Lei 12.846/2013)",
};

export const PAGINA_DO_PORTAL: Record<Cadastro, string> = {
  ceis: "https://portaldatransparencia.gov.br/sancoes/ceis",
  cnep: "https://portaldatransparencia.gov.br/sancoes/cnep",
  cepim: "https://portaldatransparencia.gov.br/sancoes/cepim",
  leniencia: "https://portaldatransparencia.gov.br/sancoes/acordos-leniencia",
};

const ROTA_DO_CADASTRO: Record<Cadastro, string> = {
  ceis: "ceis",
  cnep: "cnep",
  cepim: "cepim",
  leniencia: "acordos-leniencia",
};

export type Registro = Record<string, unknown>;

export interface ResultadoCadastro {
  nome: string;
  cadastro: Cadastro;
  status: "limpo" | "encontrado" | "erro";
  registros: Registro[];
  total: number;
  erro?: string;
  /** A API devolveu registros de outros CNPJs e nenhum deste: o filtro não foi aplicado. */
  filtroIgnorado?: boolean;
  url: string;
}

/** Bandeiras de /pessoa-juridica: a presença do CNPJ no governo federal numa chamada. */
export interface FichaFederal {
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  favorecidoDespesas?: boolean;
  possuiContratacao?: boolean;
  convenios?: boolean;
  favorecidoTransferencias?: boolean;
  sancionadoCEPIM?: boolean;
  sancionadoCEIS?: boolean;
  sancionadoCNEP?: boolean;
  sancionadoCEAF?: boolean;
  participanteLicitacao?: boolean;
  emitiuNFe?: boolean;
  beneficiadoRenunciaFiscal?: boolean;
  isentoImuneRenunciaFiscal?: boolean;
  habilitadoRenunciaFiscal?: boolean;
}

export interface Idoneidade {
  cnpj: string;
  ceis: ResultadoCadastro;
  cnep: ResultadoCadastro;
  cepim: ResultadoCadastro;
  leniencia: ResultadoCadastro;
  ficha: FichaFederal | null;
  fichaErro?: string;
  divergencias: string[];
  /** Os quatro cadastros limpos e conferidos. */
  idonea: boolean;
  /** Algum cadastro não respondeu ou não filtrou: não se afirma nem idônea nem impedida. */
  inconclusiva: boolean;
  consultadoEm: string;
  fonte: "api";
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const digitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

export function cabecalhos(chave: string): Record<string, string> {
  return { Accept: "application/json", "chave-api-dados": chave };
}

/** A URL do cadastro para um CNPJ, com o parâmetro da especificação e o antigo lado a lado. */
export function urlDoCadastro(cadastro: Cadastro, cnpj: string, pagina = 1): string {
  const c = digitos(cnpj);
  const p = new URLSearchParams();
  if (cadastro === "ceis" || cadastro === "cnep") {
    p.set("codigoSancionado", c);
    p.set("cnpjSancionado", c);
  } else {
    p.set("cnpjSancionado", c);
  }
  p.set("pagina", String(pagina));
  return `${PORTAL_BASE}/${ROTA_DO_CADASTRO[cadastro]}?${p.toString()}`;
}

/** Os CNPJs que um registro cita, em dígitos — em qualquer campo cujo nome fale de CNPJ ou código. */
export function cnpjsDoRegistro(registro: Registro): string[] {
  const achados = new Set<string>();
  const visitar = (valor: unknown, chave: string) => {
    if (valor == null) return;
    if (typeof valor === "string" || typeof valor === "number") {
      if (/cnpj|codigo/i.test(chave)) {
        const d = digitos(valor);
        if (d.length === 14) achados.add(d);
      }
      return;
    }
    if (Array.isArray(valor)) {
      for (const item of valor) visitar(item, chave);
      return;
    }
    if (typeof valor === "object") {
      for (const [k, v] of Object.entries(valor as Registro)) visitar(v, k);
    }
  };
  visitar(registro, "");
  return [...achados];
}

/**
 * Só os registros que citam o CNPJ consultado. Registro sem CNPJ legível fica
 * (não dá para provar que é de outro); registro de outro CNPJ sai e é contado.
 */
export function registrosDoCnpj<T extends Registro>(registros: T[], cnpj: string): { proprios: T[]; alheios: number } {
  const alvo = digitos(cnpj);
  let alheios = 0;
  const proprios = registros.filter((r) => {
    const citados = cnpjsDoRegistro(r);
    if (citados.length === 0 || citados.includes(alvo)) return true;
    alheios += 1;
    return false;
  });
  return { proprios, alheios };
}

/** A mensagem que a API manda no corpo de um erro, sem o embrulho. */
export function mensagemDaApi(texto: string): string {
  const cru = texto.slice(0, 200);
  try {
    const j = JSON.parse(texto);
    const primeiro = j && typeof j === "object" ? Object.values(j)[0] : undefined;
    return primeiro == null ? cru : String(primeiro);
  } catch {
    return cru;
  }
}

export async function consultarCadastro(
  cadastro: Cadastro,
  cnpj: string,
  chave: string,
  fetcher: Fetcher = fetch,
): Promise<ResultadoCadastro> {
  const nome = NOME_DO_CADASTRO[cadastro];
  const url = PAGINA_DO_PORTAL[cadastro];
  const base = { nome, cadastro, url };
  try {
    const r = await fetcher(urlDoCadastro(cadastro, cnpj), { headers: cabecalhos(chave) });
    if (!r.ok) {
      const t = await r.text();
      return { ...base, status: "erro", registros: [], total: 0, erro: `HTTP ${r.status}: ${mensagemDaApi(t)}` };
    }
    const data = await r.json();
    const lista = Array.isArray(data) ? (data as Registro[]) : [];
    const { proprios, alheios } = registrosDoCnpj(lista, cnpj);
    if (alheios > 0 && proprios.length === 0) {
      return {
        ...base, status: "erro", registros: [], total: 0, filtroIgnorado: true,
        erro: `A API devolveu ${alheios} registro(s) de outros CNPJs e nenhum deste: o filtro por CNPJ não foi aplicado. Confira no portal.`,
      };
    }
    return {
      ...base,
      status: proprios.length > 0 ? "encontrado" : "limpo",
      registros: proprios,
      total: proprios.length,
      ...(alheios > 0 ? { erro: `${alheios} registro(s) de outros CNPJs vieram junto e foram descartados.` } : {}),
    };
  } catch (e) {
    return { ...base, status: "erro", registros: [], total: 0, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function fichaDaPessoaJuridica(
  cnpj: string,
  chave: string,
  fetcher: Fetcher = fetch,
): Promise<{ ficha: FichaFederal | null; erro?: string }> {
  try {
    const r = await fetcher(`${PORTAL_BASE}/pessoa-juridica?cnpj=${digitos(cnpj)}`, { headers: cabecalhos(chave) });
    if (r.status === 404) return { ficha: null };
    if (!r.ok) return { ficha: null, erro: `HTTP ${r.status}: ${mensagemDaApi(await r.text())}` };
    const j = await r.json();
    const lista = (Array.isArray(j) ? j : j && typeof j === "object" ? [j] : [])
      .filter((f: unknown): f is Registro => !!f && typeof f === "object");
    // A ficha só vale se for DESTE CNPJ — a mesma regra dos cadastros: uma
    // ficha de outro CNPJ acusaria sanção alheia (o selo "Sanção no CEIS" da
    // Consulta CNPJ nasce daqui). Sem o campo cnpj não há como conferir, e a
    // ficha passa; com o campo e outro número, é erro, nunca ficha.
    const pedido = digitos(cnpj);
    const propria = lista.find((f) => f.cnpj == null || digitos(f.cnpj) === pedido) ?? null;
    if (!propria && lista.length > 0) {
      return { ficha: null, erro: `A API devolveu a ficha de outro CNPJ (${String(lista[0].cnpj ?? "")}); confira no portal.` };
    }
    return { ficha: propria as FichaFederal | null };
  } catch (e) {
    return { ficha: null, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** O veredito: só é idônea quem está limpa nos quatro cadastros, todos respondidos e conferidos. */
export function avaliarIdoneidade(partes: {
  ceis: ResultadoCadastro; cnep: ResultadoCadastro; cepim: ResultadoCadastro; leniencia: ResultadoCadastro;
  ficha: FichaFederal | null;
}): { idonea: boolean; inconclusiva: boolean; divergencias: string[] } {
  const cadastros = [partes.ceis, partes.cnep, partes.cepim, partes.leniencia];
  const inconclusiva = cadastros.some((c) => c.status === "erro");
  const idonea = !inconclusiva && cadastros.every((c) => c.status === "limpo");
  const divergencias: string[] = [];
  if (partes.ficha) {
    const pares: Array<[keyof FichaFederal, ResultadoCadastro]> = [
      ["sancionadoCEIS", partes.ceis],
      ["sancionadoCNEP", partes.cnep],
      ["sancionadoCEPIM", partes.cepim],
    ];
    for (const [bandeira, cadastro] of pares) {
      if (cadastro.status === "erro") continue;
      const marcada = partes.ficha[bandeira] === true;
      if (marcada && cadastro.status === "limpo") {
        divergencias.push(`A ficha da pessoa jurídica marca sanção no ${cadastro.nome}, mas o cadastro não trouxe registro deste CNPJ. Confira no portal.`);
      }
      if (!marcada && cadastro.status === "encontrado") {
        divergencias.push(`O cadastro ${cadastro.nome} trouxe registro deste CNPJ, mas a ficha da pessoa jurídica não marca a sanção.`);
      }
    }
  }
  return { idonea, inconclusiva, divergencias };
}

export async function verificarIdoneidade(cnpj: string, chave: string, fetcher: Fetcher = fetch): Promise<Idoneidade> {
  const c = digitos(cnpj);
  const [ceis, cnep, cepim, leniencia, fichaResp] = await Promise.all([
    consultarCadastro("ceis", c, chave, fetcher),
    consultarCadastro("cnep", c, chave, fetcher),
    consultarCadastro("cepim", c, chave, fetcher),
    consultarCadastro("leniencia", c, chave, fetcher),
    fichaDaPessoaJuridica(c, chave, fetcher),
  ]);
  const veredito = avaliarIdoneidade({ ceis, cnep, cepim, leniencia, ficha: fichaResp.ficha });
  return {
    cnpj: c, ceis, cnep, cepim, leniencia,
    ficha: fichaResp.ficha,
    ...(fichaResp.erro ? { fichaErro: fichaResp.erro } : {}),
    ...veredito,
    consultadoEm: new Date().toISOString(),
    fonte: "api",
  };
}

// ── Datas no formato da API ─────────────────────────────────────────────────

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function paraData(br: string): Date | null {
  const m = br.trim().match(DATA_BR);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dataBr(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** DD/MM/AAAA → MM/AAAA, o formato das rotas mensais; inválido vira null. */
export function mesAnoDe(br: string | undefined | null): string | null {
  const d = br ? paraData(br) : null;
  return d ? `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : null;
}

/**
 * Janelas de no máximo um mês entre duas datas DD/MM/AAAA — a régua de
 * /licitacoes. Cada janela vai do dia até o mesmo dia do mês seguinte menos
 * um, fechada no fim pedido. Inválida ou invertida: uma janela só, do fim.
 */
export function janelasMensais(dataInicial: string, dataFinal: string, maxJanelas = 12): Array<{ de: string; ate: string }> {
  const fim = paraData(dataFinal) ?? new Date();
  let inicio = paraData(dataInicial) ?? fim;
  if (inicio > fim) inicio = fim;
  const janelas: Array<{ de: string; ate: string }> = [];
  let cursor = inicio;
  while (cursor <= fim && janelas.length < maxJanelas) {
    const proximo = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    const ate = new Date(proximo.getTime() - 24 * 3600 * 1000);
    janelas.push({ de: dataBr(cursor), ate: dataBr(ate < fim ? ate : fim) });
    cursor = proximo;
  }
  return janelas;
}
