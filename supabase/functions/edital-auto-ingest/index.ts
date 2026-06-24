// Orquestrador de leitura automática de editais.
// Pipeline: resolve fonte → descobre anexos → tenta planilha (.xlsx) → cai pra PDF/IA → persiste itens.
// Notifica progresso em tempo real via tabela `processos_ingest_status`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/zip,application/octet-stream,text/html,*/*",
};

interface IngestRequest {
  licitacao_id: string;
  /** Se existir, pula confirmação de sobrescrita do client */
  replace?: boolean;
}

interface AnexoLink {
  nome: string;
  url: string;
  tipo: "xlsx" | "pdf" | "doc" | "zip" | "outro";
}

function classifyExt(url: string, name = ""): AnexoLink["tipo"] {
  const s = (name + " " + url).toLowerCase();
  if (/\.xlsx|\.xls\b|planilha/.test(s)) return "xlsx";
  if (/\.pdf\b/.test(s)) return "pdf";
  if (/\.docx?\b/.test(s)) return "doc";
  if (/\.zip\b/.test(s)) return "zip";
  return "outro";
}

function parsePNCPNumeroControle(nc: string | null | undefined) {
  if (!nc) return null;
  const clean = nc.replace(/\s/g, "");
  // Formato oficial: CNPJ(14)-1-SEQ/ANO
  let m = clean.match(/(\d{14})-(\d+)-(\d+)\/(\d{4})/);
  if (m) return { cnpj: m[1], seq: m[3], ano: m[4] };
  // Formato URL PNCP: /editais/{cnpj}/{ano}/{seq}
  m = clean.match(/editais\/(\d{14})\/(\d{4})\/(\d+)/i);
  if (m) return { cnpj: m[1], seq: m[3], ano: m[2] };
  // Formato URL PNCP API: /orgaos/{cnpj}/compras/{ano}/{seq}
  m = clean.match(/orgaos\/(\d{14})\/compras\/(\d{4})\/(\d+)/i);
  if (m) return { cnpj: m[1], seq: m[3], ano: m[2] };
  return null;
}

async function listPNCPArquivos(cnpj: string, ano: string, seq: string): Promise<AnexoLink[]> {
  const url = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos?pagina=1&tamanhoPagina=100`;
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; LicitAI/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const arr: any[] = Array.isArray(data) ? data : (data?.data ?? []);
    return arr.map((a, idx) => {
      const seqArq = a.sequencialDocumento ?? a.sequencialArquivo ?? idx + 1;
      const itemUrl = a.url ?? a.uri ?? `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${seqArq}`;
      const nome = a.titulo ?? a.nomeArquivo ?? `arquivo-${idx + 1}`;
      return { nome, url: itemUrl, tipo: classifyExt(itemUrl, nome) };
    });
  } catch {
    return [];
  }
}

async function firecrawlScrape(targetUrl: string): Promise<AnexoLink[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl, formats: ["links"], onlyMainContent: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    const links: string[] = data?.data?.links ?? data?.links ?? [];
    const filtered = links
      .filter((u) => /\.(xlsx?|pdf|docx?|zip)(\?|$)/i.test(u))
      .map((u) => ({ nome: u.split("/").pop() ?? u, url: u, tipo: classifyExt(u) as AnexoLink["tipo"] }));
    // dedupe
    const seen = new Set<string>();
    return filtered.filter((l) => (seen.has(l.url) ? false : seen.add(l.url)));
  } catch {
    return [];
  }
}

async function downloadBinary(url: string): Promise<{ buf: ArrayBuffer; ct: string } | null> {
  try {
    const r = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000), redirect: "follow" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "application/octet-stream";
    const buf = await r.arrayBuffer();
    return { buf, ct };
  } catch {
    return null;
  }
}

function num(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/R\$/gi, "").replace(/\s+/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(/,/g, ".").replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickHeader(row: any[], patterns: RegExp[]): number {
  for (let i = 0; i < row.length; i++) {
    const v = String(row[i] ?? "").toLowerCase().trim();
    if (patterns.some((p) => p.test(v))) return i;
  }
  return -1;
}

/** Extrai itens de uma planilha .xlsx com heurística de cabeçalhos brasileiros. */
function parseXlsxItens(buf: ArrayBuffer): any[] {
  try {
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const itens: any[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) as any[][];
      if (!rows.length) continue;

      // localizar linha de cabeçalho dentro das primeiras 15 linhas
      let headerIdx = -1;
      let cols = { item: -1, desc: -1, qtd: -1, un: -1, vu: -1, vt: -1, lote: -1 };
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const r = rows[i] || [];
        const c = {
          item: pickHeader(r, [/^item$/, /^n[ºo°]?$/, /n[uú]mero/]),
          desc: pickHeader(r, [/descri/, /especifica/, /objeto/]),
          qtd: pickHeader(r, [/qtd/, /quant/]),
          un: pickHeader(r, [/^un$/, /unidade/, /^um$/]),
          vu: pickHeader(r, [/valor.?un/, /pre[çc]o.?un/, /vlr.?un/]),
          vt: pickHeader(r, [/valor.?total/, /total\b/, /vlr.?total/]),
          lote: pickHeader(r, [/^lote$/, /grupo/]),
        };
        if (c.desc !== -1 && (c.qtd !== -1 || c.vu !== -1)) {
          headerIdx = i;
          cols = c;
          break;
        }
      }
      if (headerIdx === -1) continue;

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const desc = String(r[cols.desc] ?? "").trim();
        if (desc.length < 5) continue;
        const qtd = num(r[cols.qtd]) ?? 1;
        const vu = num(r[cols.vu]) ?? 0;
        const vt = num(r[cols.vt]) ?? qtd * vu;
        itens.push({
          item: r[cols.item] != null ? String(r[cols.item]) : String(itens.length + 1),
          descricao: desc,
          quantidade: qtd,
          unidade: String(r[cols.un] ?? "UN").trim() || "UN",
          valor_unitario: vu,
          valor_total: vt,
          lote: cols.lote !== -1 && r[cols.lote] != null ? String(r[cols.lote]) : "Único",
          marca: null,
          fabricante: null,
          modelo: null,
        });
      }
      if (itens.length > 0) break; // primeira aba útil resolve
    }
    return itens;
  } catch (e) {
    console.warn("[auto-ingest] xlsx parse err:", String(e));
    return [];
  }
}

async function callExtrairItensIA(supabaseUrl: string, anonKey: string, payload: Record<string, any>) {
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/extrair-itens-edital`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }
    if (!r.ok) {
      console.warn(`[auto-ingest] extrair-itens HTTP ${r.status}: ${text.slice(0, 200)}`);
      return parsed; // pode conter pdf_url/mensagem útil
    }
    return parsed;
  } catch (e) {
    console.warn(`[auto-ingest] extrair-itens erro: ${String(e)}`);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth do usuário
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: IngestRequest;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }
  if (!body.licitacao_id) return new Response(JSON.stringify({ error: "licitacao_id required" }), { status: 400, headers: corsHeaders });

  // Carrega licitação com coordenadas PNCP quando disponíveis
  const { data: lic } = await admin
    .from("licitacoes")
    .select("id, user_id, numero, orgao, objeto, observacoes, url_edital, valor_estimado, cnpj_orgao, ano_compra, sequencial_compra, numero_controle_pncp")
    .eq("id", body.licitacao_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!lic) return new Response(JSON.stringify({ error: "licitacao not found" }), { status: 404, headers: corsHeaders });

  // upsert status running
  const updateStatus = async (patch: Record<string, any>) => {
    await admin.from("processos_ingest_status").upsert({
      user_id: user.id,
      licitacao_id: lic.id,
      ...patch,
    }, { onConflict: "user_id,licitacao_id" });
  };

  await updateStatus({ status: "running", etapa: "resolve", iniciado_em: new Date().toISOString(), erro: null, mensagem: null });

  // Resolver fonte: tentar PNCP via coordenadas salvas, numero, url ou cache
  let anexos: AnexoLink[] = [];
  let fonte = "generic";
  let pncp: ReturnType<typeof parsePNCPNumeroControle> = null;

  // 0) Usar coordenadas PNCP salvas diretamente na licitação (caminho mais confiável)
  if (lic.cnpj_orgao && lic.ano_compra && lic.sequencial_compra) {
    pncp = { cnpj: lic.cnpj_orgao, seq: lic.sequencial_compra, ano: lic.ano_compra };
    console.log("[auto-ingest] PNCP coords from licitacoes:", pncp);
  }

  // 0b) Tentar via numero_controle_pncp salvo
  if (!pncp && lic.numero_controle_pncp) {
    pncp = parsePNCPNumeroControle(lic.numero_controle_pncp);
    if (pncp) console.log("[auto-ingest] PNCP from numero_controle_pncp:", pncp);
  }

  // 1) Tentar parsear do número do processo
  if (!pncp) pncp = parsePNCPNumeroControle(lic.numero || "");
  // 2) Tentar parsear da URL do edital
  if (!pncp) pncp = parsePNCPNumeroControle(lic.url_edital || "");

  // 2b) Tentar localizar no cache por numero_compra
  if (!pncp && lic.numero) {
    const { data: cacheByNumero } = await admin
      .from("pncp_editais_cache")
      .select("cnpj_orgao, ano_compra, sequencial_compra")
      .eq("numero_compra", lic.numero)
      .limit(1)
      .maybeSingle();
    if (cacheByNumero?.cnpj_orgao && cacheByNumero?.ano_compra && cacheByNumero?.sequencial_compra) {
      pncp = { cnpj: cacheByNumero.cnpj_orgao, seq: String(cacheByNumero.sequencial_compra), ano: String(cacheByNumero.ano_compra) };
      console.log("[auto-ingest] PNCP found via cache numero_compra:", pncp);
    }
  }

  // 3) Tentar localizar no cache PNCP por objeto + órgão
  if (!pncp && lic.objeto && lic.orgao) {
    const { data: cacheMatch } = await admin
      .from("pncp_editais_cache")
      .select("cnpj_orgao, ano_compra, sequencial_compra, numero_controle_pncp, link_sistema_origem, url_pncp, objeto")
      .ilike("orgao", `%${lic.orgao.slice(0, 30)}%`)
      .ilike("objeto", `%${lic.objeto.slice(0, 60)}%`)
      .limit(1)
      .maybeSingle();
    if (cacheMatch?.cnpj_orgao && cacheMatch?.ano_compra && cacheMatch?.sequencial_compra) {
      pncp = { cnpj: cacheMatch.cnpj_orgao, seq: String(cacheMatch.sequencial_compra), ano: String(cacheMatch.ano_compra) };
      console.log("[auto-ingest] PNCP encontrado via cache:", pncp);
    }
  }

  console.log("[auto-ingest] Estado inicial:", { lic_id: lic.id, numero: lic.numero, url_edital: lic.url_edital, pncp });

  if (pncp) {
    fonte = "pncp";
    await updateStatus({ fonte, etapa: "download" });
    anexos = await listPNCPArquivos(pncp.cnpj, pncp.ano, pncp.seq);
    console.log(`[auto-ingest] PNCP retornou ${anexos.length} anexos`);
  }

  if (anexos.length === 0 && lic.url_edital) {
    fonte = "generic";
    await updateStatus({ fonte, etapa: "download" });
    anexos = await firecrawlScrape(lic.url_edital);
    console.log(`[auto-ingest] Firecrawl retornou ${anexos.length} anexos`);
  }

  await updateStatus({ etapa: "classify", arquivos_baixados: anexos as any });

  // Estratégia: priorizar XLSX
  const xlsxFirst = anexos.find((a) => a.tipo === "xlsx");
  let itens: any[] = [];
  let fonteUsada = "";

  if (xlsxFirst) {
    await updateStatus({ etapa: "parse", mensagem: `Lendo planilha: ${xlsxFirst.nome}` });
    const dl = await downloadBinary(xlsxFirst.url);
    if (dl) {
      itens = parseXlsxItens(dl.buf);
      if (itens.length > 0) fonteUsada = "XLSX";
      console.log(`[auto-ingest] XLSX parseado: ${itens.length} itens`);
    }
  }

  // Fallback PDF/IA via extrair-itens-edital
  if (itens.length === 0) {
    await updateStatus({ etapa: "parse", mensagem: "Lendo edital com IA…" });
    const pdfFirst = anexos.find((a) => a.tipo === "pdf");
    const payload: Record<string, any> = {};
    if (pncp) {
      payload.numero_controle = `${pncp.cnpj}-1-${pncp.seq}/${pncp.ano}`;
      payload.orgao_cnpj = pncp.cnpj;
      payload.ano_compra = Number(pncp.ano);
      payload.sequencial = Number(pncp.seq);
    }
    if (pdfFirst) payload.pdf_url = pdfFirst.url;

    // Sempre passar texto bruto do objeto/observações como último recurso
    const textoFallback = [lic.objeto, lic.observacoes].filter(Boolean).join("\n\n");
    if (textoFallback.length >= 50) {
      payload.texto_edital = textoFallback;
      payload.skip_min_length = true;
    }

    if (Object.keys(payload).length > 0) {
      console.log("[auto-ingest] Chamando extrair-itens-edital com:", Object.keys(payload));
      const result = await callExtrairItensIA(SUPABASE_URL, SUPABASE_ANON_KEY, payload);
      console.log("[auto-ingest] Resultado IA:", { success: result?.success, count: result?.data?.length, error: result?.error });
      if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
        itens = result.data;
        fonteUsada = result.fonte || "IA";
      }
    }
  }

  if (itens.length === 0) {
    const motivo = anexos.length === 0
      ? "Não foi possível localizar anexos do edital automaticamente. Tente fazer upload manual do PDF/planilha."
      : "Anexos foram localizados mas não foi possível extrair itens estruturados. Tente upload manual.";
    await updateStatus({
      status: "failed",
      etapa: "done",
      finalizado_em: new Date().toISOString(),
      mensagem: motivo,
      erro: anexos.length === 0 ? "no_attachments_found" : "no_items_extracted",
    });
    return new Response(JSON.stringify({ success: false, reason: "no_items", motivo, anexos, pncp_detectado: !!pncp }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Persistir
  await updateStatus({ etapa: "persist" });

  if (body.replace) {
    await admin.from("licitacao_itens").delete().eq("licitacao_id", lic.id).eq("user_id", user.id);
  }

  const rows = itens.map((it: any, idx: number) => ({
    licitacao_id: lic.id,
    user_id: user.id,
    numero: Number(it.item) || idx + 1,
    descricao: String(it.descricao ?? "").slice(0, 4000),
    quantidade: Number(it.quantidade) || 1,
    unidade: String(it.unidade ?? "UN").slice(0, 20),
    valor_unitario: Number(it.valor_unitario) || 0,
    valor_total: Number(it.valor_total) || 0,
    lote: it.lote ? String(it.lote).slice(0, 80) : "Único",
    marca: it.marca ?? null,
    fabricante: it.fabricante ?? null,
    modelo: it.modelo ?? null,
    origem: `auto:${fonteUsada || fonte}`,
  }));

  const { error: insErr } = await admin.from("licitacao_itens").insert(rows);
  if (insErr) {
    await updateStatus({ status: "failed", etapa: "done", finalizado_em: new Date().toISOString(), erro: insErr.message });
    return new Response(JSON.stringify({ success: false, error: insErr.message }), { status: 500, headers: corsHeaders });
  }

  // Atualiza valor estimado da licitação se vier vazio
  const valorTotal = rows.reduce((s, r) => s + (r.valor_total || 0), 0);
  if (!lic.valor_estimado && valorTotal > 0) {
    await admin.from("licitacoes").update({ valor_estimado: valorTotal }).eq("id", lic.id);
  }

  await updateStatus({
    status: "success",
    etapa: "done",
    total_itens: rows.length,
    fonte: fonteUsada || fonte,
    mensagem: `${rows.length} itens importados (${fonteUsada || fonte}).`,
    finalizado_em: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ success: true, total: rows.length, fonte: fonteUsada || fonte }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
