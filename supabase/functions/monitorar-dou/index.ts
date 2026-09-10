// Monitoramento dos Diários Oficiais pelo NOME da empresa (10/09).
//
// A função nasceu buscando só o Querido Diário (diários municipais) e ficou
// DORMENTE — sem cron e sem o DOU de verdade. Agora:
//   1) DOU via busca do in.gov.br: a página embute os resultados num JSON
//      (<script id="..._params" type="application/json">{"jsonArray":[...]})
//      — parse determinístico, sem raspar HTML;
//   2) termos vêm DO SISTEMA: CNPJ (formatado, como sai nas publicações),
//      razão social e nome fantasia das empresas do usuário — mais o que a
//      preferência declarar;
//   3) classificação com as categorias que importam a quem FORNECE:
//      aviso de licitação, extrato de contrato, ata de registro de preços e
//      termo aditivo — além de suspensão/cancelamento/homologação/alteração.
//      Menção à empresa é sempre relevante: os tipos novos não são gateados
//      pelas flags receber_*;
//   4) cron a cada 4h (24/7) com CRON_SECRET — deploy --no-verify-jwt;
//   5) IOEPA (DOE-PA): a edição diária tem URL previsível
//      https://www.ioepa.com.br/pages/{AAAA}/{AAAA.MM.DD}.DOE.pdf. Extrair
//      as ~200 páginas de uma vez estoura o orçamento de CPU do isolate
//      (WORKER_RESOURCE_LIMIT, medido em 10/09) — então a edição é varrida
//      em LOTES auto-encadeados: cada invocação extrai um punhado de
//      páginas, procura todos os termos e chama a si mesma para o lote
//      seguinte. Edição 100% varrida ganha marcador e não é relida.
//
// Saída inalterada de propósito: alertas_gerados (o Editais já exibe) e
// dedupe em publicacoes_dou_processadas.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getDocumentProxy } from "npm:unpdf@1.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ItemDou = {
  title: string; urlTitle: string; pubDate: string; pubName: string;
  hierarchyStr: string; content: string;
};

const limparHtml = (s: string) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const formatarCnpj = (d: string) =>
  d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;

/** As categorias de quem fornece vêm ANTES das genéricas: um "extrato de
 *  termo aditivo" é aditivo, não "alteração". */
function classificar(texto: string): { tipo: string; urgente: boolean } {
  const t = texto.toLowerCase();
  if (/termo\s+aditivo|apostilamento|extrato\s+de\s+aditivo/.test(t)) return { tipo: "aditivo", urgente: false };
  if (/ata\s+de\s+registro\s+de\s+pre[cç]os|extrato\s+de\s+ata/.test(t)) return { tipo: "ata_registro", urgente: false };
  if (/extrato\s+de\s+contrato|termo\s+de\s+contrato|contrato\s+administrativo/.test(t)) return { tipo: "extrato_contrato", urgente: false };
  if (/aviso\s+de\s+licita[cç][aã]o|preg[aã]o\s+eletr[oô]nico|edital\s+de\s+licita/.test(t)) return { tipo: "aviso_licitacao", urgente: false };
  if (/suspens|suspende/.test(t)) return { tipo: "suspensao", urgente: true };
  if (/cancel|revoga|anula/.test(t)) return { tipo: "cancelamento", urgente: true };
  if (/homologa|adjudica/.test(t)) return { tipo: "homologacao", urgente: false };
  return { tipo: "alteracao", urgente: false };
}

/** Tipos que existem porque a EMPRESA foi mencionada — sempre entregues. */
const TIPOS_SEMPRE = new Set(["aviso_licitacao", "extrato_contrato", "ata_registro", "aditivo"]);

// ────────────────────────────────────────────────────────────────────────────
// IOEPA / DOE-PA
// ────────────────────────────────────────────────────────────────────────────

/** Páginas por invocação: ~6ms/página no hardware local; a margem cabe com
 *  folga no orçamento de CPU do isolate mesmo em hardware bem mais lento. */
const PAGINAS_POR_LOTE = 25;
/** Trava de segurança da cadeia (25 págs × 12 lotes = 300 páginas). */
const MAX_LOTES = 12;
/** Sobreposição entre lotes: um nome partido na fronteira ainda casa. */
const CARRY = 400;

/** Dobra acento e caixa preservando o comprimento (posição a posição), para
 *  que o índice achado no texto dobrado aponte o MESMO ponto no original —
 *  "ESTRATÉGIA" impresso no diário casa com "ESTRATEGIA" do cadastro. */
function dobrar(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch.length === 2) { out += ch; continue; }
    let f = ch;
    if (ch.charCodeAt(0) >= 128) {
      const base = ch.normalize("NFD");
      const c = base.charCodeAt(0);
      f = c >= 0x300 && c <= 0x36f ? ch : base[0];
    }
    const u = f.toUpperCase();
    out += u.length === 1 ? u : f;
  }
  return out;
}

/** O PDF do DOE-PA extrai títulos em versalete com espaço DENTRO das palavras
 *  ("s hopping c enter i guatemi"). A busca ignora todo espaçamento: haystack
 *  compactado + mapa de posições de volta ao texto original. */
function indexar(texto: string): Indice {
  const dobrado = dobrar(texto);
  const mapa = new Int32Array(dobrado.length);
  const partes: string[] = [];
  let n = 0;
  for (let i = 0; i < dobrado.length; i++) {
    const c = dobrado.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 0xa0) continue;
    if (c >= 0x300 && c <= 0x36f) continue; // acento decomposto solto
    mapa[n++] = i;
    partes.push(dobrado[i]);
  }
  return { texto, compacto: partes.join(""), mapa: mapa.subarray(0, n) };
}

type Indice = { texto: string; compacto: string; mapa: Int32Array };

/** Todas as ocorrências (até `max`) do termo no índice — insensível a caixa,
 *  acento E espaçamento — com trecho de ±300 caracteres do texto original. */
function ocorrencias(ind: Indice, termo: string, max = 5): { pos: number; trecho: string }[] {
  const alvo = dobrar(termo).replace(/\s+/g, "");
  if (alvo.length < 6) return [];
  const hits: { pos: number; trecho: string }[] = [];
  let i = ind.compacto.indexOf(alvo);
  while (i >= 0 && hits.length < max) {
    const posIni = ind.mapa[i];
    const posFim = ind.mapa[i + alvo.length - 1] + 1;
    const ini = Math.max(0, posIni - 300);
    const fim = Math.min(ind.texto.length, posFim + 300);
    hits.push({ pos: posIni, trecho: ind.texto.slice(ini, fim).replace(/\s+/g, " ").trim() });
    i = ind.compacto.indexOf(alvo, i + alvo.length);
  }
  return hits;
}

const urlIoepa = (dataISO: string) => {
  const [yyyy, mm, dd] = dataISO.split("-");
  return `https://www.ioepa.com.br/pages/${yyyy}/${yyyy}.${mm}.${dd}.DOE.pdf`;
};

/** Baixa a edição do dia. 404 = sem edição (fim de semana, feriado ou ainda
 *  não publicada) → null; outros erros sobem. */
async function baixarPdfIoepa(dataISO: string): Promise<Uint8Array | null> {
  const res = await fetch(urlIoepa(dataISO), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PraefectusMonitor/1.0)" },
    signal: AbortSignal.timeout(45000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`IOEPA ${dataISO}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Extrai só a faixa pedida — o parse do pdf.js é preguiçoso, então o custo
 *  de CPU é proporcional às páginas extraídas, não ao tamanho do arquivo. */
async function extrairFaixa(bytes: Uint8Array, pagIni: number, pagFim: number) {
  const pdf = await getDocumentProxy(bytes);
  const total = pdf.numPages;
  const ate = Math.min(pagFim, total);
  let texto = "";
  for (let p = pagIni; p <= ate; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    texto += (tc.items as any[]).map((x) => x.str ?? "").join(" ") + "\n";
  }
  return { texto, totalPaginas: total, extraiuAte: ate };
}

type LoteIoepa = {
  dataISO: string;
  pagIni: number;
  offset: number;  // posição global (na edição inteira) do início deste lote
  carry: string;   // cauda do lote anterior, para casar nome partido na fronteira
  ciclo: number;
};

type Registrador = (opts: {
  userId: string; tipo: string; urgente: boolean; titulo: string; descricao: string;
  orgao: string | null; uf: string | null; url: string | null; fonte: string;
  idUnico: string; dataPub: string | null; cnpj?: string | null;
}) => Promise<boolean>;

// deno-lint-ignore no-explicit-any
function criarRegistrador(supabase: any, prefs: any[]) {
  let criados = 0;
  const prefDe = (userId: string) => prefs.find((p) => p.user_id === userId);

  const registrar: Registrador = async (opts) => {
    const { data: existing } = await supabase
      .from("publicacoes_dou_processadas")
      .select("id").eq("identificador", opts.idUnico).maybeSingle();
    if (existing) return false;

    const pref = prefDe(opts.userId);
    if (!pref) return false;
    if (!TIPOS_SEMPRE.has(opts.tipo)) {
      if (opts.tipo === "alteracao" && !pref.receber_alteracoes) return false;
      if (opts.tipo === "suspensao" && !pref.receber_suspensoes) return false;
      if (opts.tipo === "cancelamento" && !pref.receber_cancelamentos) return false;
      if (opts.tipo === "homologacao" && !pref.receber_homologacoes) return false;
    }

    const processMatch = opts.descricao.toLowerCase()
      .match(/(?:pregão|pregao|processo|contrato)\s*(?:eletrônico|eletronico)?\s*(?:n[ºo°.]?\s*)?(\d+[\/\-]\d+)/i);

    await supabase.from("alertas_gerados").insert({
      user_id: opts.userId,
      tipo: opts.tipo,
      titulo: opts.titulo.slice(0, 200),
      descricao: opts.descricao.slice(0, 500),
      orgao: opts.orgao,
      uf: opts.uf,
      numero_processo: processMatch?.[1] || null,
      url_publicacao: opts.url,
      fonte: opts.fonte,
      urgente: opts.urgente,
    });
    await supabase.from("publicacoes_dou_processadas").insert({
      identificador: opts.idUnico,
      tipo_publicacao: opts.tipo,
      data_publicacao: opts.dataPub,
      orgao: opts.orgao,
      cnpj_mencionado: opts.cnpj ?? null,
      conteudo_resumo: opts.titulo.slice(0, 200),
    });
    criados++;
    return true;
  };

  return { registrar, criados: () => criados };
}

/** Termos por usuário: preferência declarada + TODAS as empresas dele
 *  (CNPJ formatado como sai impresso, razão social e fantasia). */
// deno-lint-ignore no-explicit-any
async function coletarTermos(supabase: any, prefs: any[]) {
  const searchTerms: { userId: string; termo: string }[] = [];
  const visto = new Set<string>();
  const add = (userId: string, termo?: string | null) => {
    const t = (termo || "").trim();
    if (t.length < 6) return;
    const k = `${userId}|${t.toLowerCase()}`;
    if (visto.has(k)) return;
    visto.add(k);
    searchTerms.push({ userId, termo: t });
  };

  for (const pref of prefs) {
    const cnpjPref = (pref.cnpj || "").replace(/\D/g, "");
    if (cnpjPref.length === 14) add(pref.user_id, formatarCnpj(cnpjPref));
    add(pref.user_id, pref.razao_social);

    const { data: vinculos } = await supabase
      .from("empresa_membros")
      .select("empresa_id")
      .eq("user_id", pref.user_id);
    const empresaIds = [...new Set((vinculos ?? []).map((v: { empresa_id: string }) => v.empresa_id))];
    if (empresaIds.length) {
      const { data: empresas } = await supabase
        .from("empresas")
        .select("cnpj, razao_social, nome_fantasia")
        .in("id", empresaIds);
      for (const e of empresas ?? []) {
        const d = (e.cnpj || "").replace(/\D/g, "");
        if (d.length === 14) add(pref.user_id, formatarCnpj(d));
        add(pref.user_id, e.razao_social);
        if (e.nome_fantasia && e.nome_fantasia !== e.razao_social) add(pref.user_id, e.nome_fantasia);
      }
    }
  }
  return searchTerms;
}

/** Dispara (sem esperar o fim) a varredura de um lote — a própria função,
 *  autenticada pelo CRON_SECRET que ela mesma guarda. */
function chamarProximoLote(lote: LoteIoepa): Promise<unknown> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/monitorar-dou`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("CRON_SECRET")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ioepa: lote }),
  }).then((r) => r.text());
}

/** Um lote da edição: baixa o PDF (rede, não CPU), extrai SÓ a faixa deste
 *  lote, procura todos os termos e encadeia o lote seguinte. No último lote,
 *  grava o marcador de edição varrida. */
// deno-lint-ignore no-explicit-any
async function processarLoteIoepa(supabase: any, lote: LoteIoepa) {
  const bytes = await baixarPdfIoepa(lote.dataISO);
  if (!bytes) return { edicao: lote.dataISO, message: "sem edição" };

  const { texto, totalPaginas, extraiuAte } = await extrairFaixa(
    bytes, lote.pagIni, lote.pagIni + PAGINAS_POR_LOTE - 1,
  );

  const { data: prefs } = await supabase
    .from("preferencias_alertas").select("*").eq("ativo", true);
  if (!prefs || prefs.length === 0) return { edicao: lote.dataISO, message: "sem preferências ativas" };

  const termos = await coletarTermos(supabase, prefs);
  const { registrar, criados } = criarRegistrador(supabase, prefs);

  // O carry entra ANTES do texto do lote: posições globais = offset − carry + pos.
  const ind = indexar(lote.carry + texto);
  const baseGlobal = lote.offset - lote.carry.length;
  const dataBr = lote.dataISO.split("-").reverse().join("/");

  for (const term of termos) {
    // CNPJ é buscado nas DUAS grafias (pontuada e só dígitos) — o diário
    // imprime das duas formas. Dedupe por posição global na edição.
    const variantes = [term.termo];
    const digitos = term.termo.replace(/\D/g, "");
    if (digitos.length === 14 && digitos !== term.termo) variantes.push(digitos);

    const posVistas = new Set<number>();
    for (const variante of variantes) {
      for (const hit of ocorrencias(ind, variante)) {
        const posGlobal = baseGlobal + hit.pos;
        if (posVistas.has(posGlobal)) continue;
        posVistas.add(posGlobal);
        const { tipo, urgente } = classificar(hit.trecho);
        await registrar({
          userId: term.userId, tipo, urgente,
          titulo: `DOE-PA ${dataBr} — menção a "${term.termo}"`,
          descricao: hit.trecho.slice(0, 500),
          orgao: "Imprensa Oficial do Estado do Pará",
          uf: "PA",
          url: urlIoepa(lote.dataISO),
          fonte: "DOE-PA",
          idUnico: `ioepa-${lote.dataISO}-${term.termo.slice(0, 14)}-${posGlobal}-${term.userId}`,
          dataPub: lote.dataISO,
        });
      }
    }
  }

  const resultado = {
    edicao: lote.dataISO, lote: lote.ciclo + 1,
    paginas: `${lote.pagIni}-${extraiuAte}/${totalPaginas}`,
    alertas: criados(),
  };

  if (extraiuAte < totalPaginas && lote.ciclo + 1 < MAX_LOTES) {
    await chamarProximoLote({
      dataISO: lote.dataISO,
      pagIni: extraiuAte + 1,
      offset: lote.offset + texto.length,
      carry: (lote.carry + texto).slice(-CARRY),
      ciclo: lote.ciclo + 1,
    });
  } else {
    // Edição varrida por inteiro: o marcador impede releitura nos próximos crons.
    await supabase.from("publicacoes_dou_processadas").insert({
      identificador: `ioepa-varrida-${lote.dataISO}`,
      tipo_publicacao: "varredura",
      data_publicacao: lote.dataISO,
      orgao: "IOEPA",
      conteudo_resumo: `Edição ${dataBr} varrida (${totalPaginas} páginas)`,
    });
  }

  return resultado;
}

// ────────────────────────────────────────────────────────────────────────────
// DOU (in.gov.br)
// ────────────────────────────────────────────────────────────────────────────

async function buscarNoDou(termo: string): Promise<ItemDou[]> {
  // Janela de uma SEMANA com dedupe por urlTitle: um dia de cron fora do ar
  // não perde publicação — a varredura seguinte recolhe o atrasado.
  const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(`"${termo}"`)}&s=todos&exactDate=semana&sortType=0&delta=20`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PraefectusMonitor/1.0)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const m = html.match(/type="application\/json">\s*(\{"jsonArray".*?\})\s*<\/script>/s);
  if (!m) return [];
  try {
    return (JSON.parse(m[1]).jsonArray ?? []) as ItemDou[];
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Cron-only: a varredura roda pelo relógio, não por clique.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!cronSecret || token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => null);

    // Elo da cadeia IOEPA: processa UM lote de páginas e encadeia o próximo.
    if (body?.ioepa && typeof body.ioepa.dataISO === "string") {
      const lote: LoteIoepa = {
        dataISO: body.ioepa.dataISO,
        pagIni: Math.max(1, Number(body.ioepa.pagIni) || 1),
        offset: Math.max(0, Number(body.ioepa.offset) || 0),
        carry: typeof body.ioepa.carry === "string" ? body.ioepa.carry.slice(-CARRY) : "",
        ciclo: Math.max(0, Number(body.ioepa.ciclo) || 0),
      };
      const trabalho = processarLoteIoepa(supabase, lote).then(
        (r) => console.log("ioepa lote concluído:", JSON.stringify(r)),
        (e) => console.error("ioepa lote falhou:", e),
      );
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(trabalho);
      return new Response(JSON.stringify({ started: true, lote: lote.ciclo, edicao: lote.dataISO }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Diagnóstico: {"teste_ioepa": ["TERMO ADITIVO"], "pag_ini": 1, "pag_fim": 25}
    // extrai SÓ a faixa pedida da edição mais recente e responde na hora, sem
    // gravar nada — controle positivo do extrator e sonda do orçamento de CPU.
    if (Array.isArray(body?.teste_ioepa)) {
      const pagIni = Math.max(1, Number(body.pag_ini) || 1);
      const pagFim = Number(body.pag_fim) || pagIni + PAGINAS_POR_LOTE - 1;
      for (let atras = 0; atras <= 2; atras++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - atras);
        const dataISO = d.toISOString().slice(0, 10);
        const bytes = await baixarPdfIoepa(dataISO);
        if (!bytes) continue;
        const t0 = Date.now();
        const { texto, totalPaginas, extraiuAte } = await extrairFaixa(bytes, pagIni, pagFim);
        const ind = indexar(texto);
        const resultado = body.teste_ioepa.map((t: unknown) => ({
          termo: String(t),
          hits: ocorrencias(ind, String(t)).map((h) => ({ pos: h.pos, trecho: h.trecho.slice(0, 160) })),
        }));
        return new Response(
          JSON.stringify({
            edicao: dataISO, paginas: `${pagIni}-${extraiuAte}/${totalPaginas}`,
            caracteres: texto.length, ms_extracao: Date.now() - t0, resultado,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ edicao: null, message: "Sem edição do DOE-PA nos últimos 3 dias" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: prefs } = await supabase
      .from("preferencias_alertas")
      .select("*")
      .eq("ativo", true);

    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No active preferences", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // A varredura leva minutos (N termos × 3 fontes); o pg_net do cron espera
    // segundos. Responde JÁ e trabalha em background — waitUntil segura a
    // instância viva até o fim, e o resultado fica nos logs da função.
    const trabalho = varrer(supabase, prefs).then(
      (r) => console.log("monitorar-dou concluído:", JSON.stringify(r)),
      (e) => console.error("monitorar-dou falhou:", e),
    );
    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil?.(trabalho);

    return new Response(
      JSON.stringify({ started: true, prefs: prefs.length }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// deno-lint-ignore no-explicit-any
async function varrer(supabase: any, prefs: any[]) {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const publishedSince = ontem.toISOString().split("T")[0];
  const publishedUntil = hoje.toISOString().split("T")[0];

  let totalProcessed = 0;
  const erros: string[] = [];

  const searchTerms = await coletarTermos(supabase, prefs);
  const { registrar: registrarAlerta, criados } = criarRegistrador(supabase, prefs);

  // ── Fonte 3: IOEPA / DOE-PA ──────────────────────────────────────────
  // Cada edição ainda não varrida dispara sua cadeia de lotes (hoje + 2
  // dias: feriado emendado e cron fora do ar). A cadeia corre em paralelo
  // com as fontes 1 e 2, em invocações próprias — cada uma com o seu
  // orçamento de CPU. 404 (edição ainda não publicada) NÃO marca: o cron
  // seguinte tenta de novo.
  const edicoesIniciadas: string[] = [];
  for (let atras = 0; atras <= 2; atras++) {
    const d = new Date(hoje);
    d.setUTCDate(d.getUTCDate() - atras);
    const dataISO = d.toISOString().slice(0, 10);
    try {
      const { data: varrida } = await supabase
        .from("publicacoes_dou_processadas")
        .select("id").eq("identificador", `ioepa-varrida-${dataISO}`).maybeSingle();
      if (varrida) continue;
      await chamarProximoLote({ dataISO, pagIni: 1, offset: 0, carry: "", ciclo: 0 });
      edicoesIniciadas.push(dataISO);
    } catch (err) {
      erros.push(`IOEPA ${dataISO}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const term of searchTerms) {
    // ── Fonte 1: DOU (in.gov.br) ─────────────────────────────────────
    try {
      const itens = await buscarNoDou(term.termo);
      for (const item of itens) {
        const titulo = limparHtml(item.title) || "Publicação no DOU";
        const trecho = limparHtml(item.content);
        const { tipo, urgente } = classificar(`${titulo} ${trecho} ${item.hierarchyStr || ""}`);
        const dataBr = (item.pubDate || "").split("/").reverse().join("-") || null;
        await registrarAlerta({
          userId: term.userId, tipo, urgente,
          titulo,
          descricao: `${item.hierarchyStr ? item.hierarchyStr + " — " : ""}${trecho}`,
          orgao: (item.hierarchyStr || "").split("/")[0] || null,
          uf: null,
          url: item.urlTitle ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}` : null,
          fonte: "DOU",
          idUnico: `douin-${item.urlTitle}-${term.userId}`,
          dataPub: dataBr,
        });
        totalProcessed++;
      }
    } catch (err) {
      erros.push(`DOU ${term.termo}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Fonte 2: Querido Diário (diários municipais) ─────────────────
    try {
      const url = `https://queridodiario.ok.org.br/api/gazettes?querystring=${encodeURIComponent(`"${term.termo}"`)}&published_since=${publishedSince}&published_until=${publishedUntil}&size=20`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) {
        const data = await res.json();
        for (const gazette of data?.gazettes ?? []) {
          const excerpts = (gazette.excerpts || []).join(" ");
          const { tipo, urgente } = classificar(excerpts);
          const titulo = limparHtml(excerpts.slice(0, 200)) || `Publicação no DO — ${gazette.territory_name || ""}`;
          await registrarAlerta({
            userId: term.userId, tipo, urgente,
            titulo,
            descricao: limparHtml(excerpts).slice(0, 500) || "Publicação encontrada no Diário Oficial",
            orgao: gazette.territory_name || null,
            uf: gazette.state_code || null,
            url: gazette.url || null,
            fonte: "DOE",
            idUnico: `dou-${gazette.territory_id}-${gazette.date}-${term.termo.slice(0, 14)}`,
            dataPub: gazette.date ?? null,
          });
          totalProcessed++;
        }
      }
    } catch (err) {
      // Querido Diário oscila — a varredura seguinte recupera.
      erros.push(`QD ${term.termo}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    processed: totalProcessed, alerts_created: criados(), termos: searchTerms.length,
    ioepa_iniciadas: edicoesIniciadas, erros,
  };
}
