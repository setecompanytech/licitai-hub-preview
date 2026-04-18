// dou-diarios-sync — Sincronização de Diários Oficiais
// DOU via API oficial in.gov.br + DOEs via Firecrawl search.
// Chama-se 1x por dia às 04h05 BRT. Idempotente via UNIQUE(fonte, fonte_id).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 25_000;

// Termos padrão que indicam matérias relevantes a licitações
const TERMOS_LICITACAO = [
  "aviso de licitação", "aviso de pregão", "aviso de dispensa",
  "extrato de contrato", "homologação", "resultado de licitação",
  "ata de registro de preços", "credenciamento",
];

async function fetchTimeout(url: string, init?: RequestInit, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally { clearTimeout(t); }
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function classificarTipo(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("aviso de licita") || t.includes("aviso de pregão")) return "aviso_licitacao";
  if (t.includes("aviso de dispensa")) return "aviso_dispensa";
  if (t.includes("extrato de contrato")) return "extrato_contrato";
  if (t.includes("homologação")) return "homologacao";
  if (t.includes("ata de registro")) return "ata_registro_precos";
  if (t.includes("credenciamento")) return "credenciamento";
  if (t.includes("resultado")) return "resultado_licitacao";
  return "outro";
}

// ────────── DOU via API in.gov.br ──────────
async function syncDOU(supabase: any, dataISO: string): Promise<{ ok: number; err: number }> {
  let ok = 0, err = 0;
  // Endpoint público da Imprensa Nacional (sem chave) — Seção 3 (licitações federais)
  for (const termo of TERMOS_LICITACAO) {
    const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(termo)}` +
      `&s=do3&publishFrom=${dataISO}&publishTo=${dataISO}&delta=50`;
    try {
      const res = await fetchTimeout(url, {
        headers: { "User-Agent": "Praefectus-DOU-Sync/1.0", Accept: "text/html,application/json" },
      });
      if (!res.ok) { err++; continue; }
      const html = await res.text();
      // Extrai os links de matéria do HTML (padrão: /web/dou/-/<slug>-<id>)
      const regex = /<a[^>]+href="(\/web\/dou\/-\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
      const items: { url: string; titulo: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(html)) !== null) {
        items.push({ url: `https://www.in.gov.br${m[1]}`, titulo: m[2].trim() });
        if (items.length >= 50) break;
      }
      for (const item of items) {
        const fonteId = item.url.split("/").pop() || await sha256(item.url);
        const tipo = classificarTipo(item.titulo);
        const { error } = await supabase.from("diarios_oficiais_cache").upsert({
          fonte: "DOU",
          fonte_id: fonteId,
          data_publicacao: dataISO,
          secao: "3",
          uf: null,
          orgao: null,
          tipo_publicacao: tipo,
          objeto: item.titulo.slice(0, 1000),
          link_html: item.url,
          texto_completo: item.titulo,
          hash_conteudo: await sha256(item.titulo),
          metadata: { termo_busca: termo },
        }, { onConflict: "fonte,fonte_id", ignoreDuplicates: false });
        if (error) err++; else ok++;
      }
    } catch (_) { err++; }
  }
  return { ok, err };
}

// ────────── DOEs via Firecrawl Search ──────────
async function syncDOEFirecrawl(
  supabase: any, fonte: string, uf: string, urlBase: string, dataISO: string,
): Promise<{ ok: number; err: number }> {
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!fcKey) return { ok: 0, err: 1 };

  let ok = 0, err = 0;
  const dataLegivel = new Date(dataISO).toLocaleDateString("pt-BR");

  for (const termo of TERMOS_LICITACAO.slice(0, 3)) { // limite para custo
    const query = `site:${new URL(urlBase).hostname} "${termo}" ${dataLegivel}`;
    try {
      const res = await fetchTimeout("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fcKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, limit: 10 }),
      }, 30_000);
      if (!res.ok) { err++; continue; }
      const json = await res.json().catch(() => null);
      const results = json?.data?.web || json?.data || [];
      for (const r of results) {
        const link: string = r.url || r.link;
        const titulo: string = r.title || r.snippet || "";
        if (!link) continue;
        const fonteId = await sha256(link);
        const tipo = classificarTipo(titulo);
        const { error } = await supabase.from("diarios_oficiais_cache").upsert({
          fonte,
          fonte_id: fonteId,
          data_publicacao: dataISO,
          uf,
          tipo_publicacao: tipo,
          objeto: titulo.slice(0, 1000),
          link_html: link,
          texto_completo: r.description || r.snippet || titulo,
          hash_conteudo: await sha256(titulo + link),
          metadata: { termo_busca: termo, search_engine: "firecrawl" },
        }, { onConflict: "fonte,fonte_id", ignoreDuplicates: false });
        if (error) err++; else ok++;
      }
    } catch (_) { err++; }
  }
  return { ok, err };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();
  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch (_) { body = {}; }

  // Data de referência: ontem (publicações do dia anterior)
  const data = body.data_referencia
    ? new Date(body.data_referencia)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dataISO = data.toISOString().slice(0, 10);

  // Lista de fontes ativas
  const { data: portais } = await supabase
    .from("diarios_portais_config")
    .select("fonte, uf, url_base, metodo")
    .eq("ativo", true);

  const resultados: Record<string, { ok: number; err: number }> = {};
  let totalOk = 0, totalErr = 0;

  for (const p of (portais || [])) {
    let r: { ok: number; err: number };
    try {
      if (p.metodo === "api_in_gov") {
        r = await syncDOU(supabase, dataISO);
      } else if (p.metodo === "firecrawl_search") {
        r = await syncDOEFirecrawl(supabase, p.fonte, p.uf, p.url_base, dataISO);
      } else {
        r = { ok: 0, err: 0 };
      }
      resultados[p.fonte] = r;
      totalOk += r.ok; totalErr += r.err;

      // marca última sync
      await supabase.from("diarios_portais_config")
        .update({ ultima_sync: new Date().toISOString() })
        .eq("fonte", p.fonte);
    } catch (e: any) {
      resultados[p.fonte] = { ok: 0, err: 1 };
      totalErr++;
    }
  }

  return new Response(JSON.stringify({
    status: totalErr > 0 && totalOk === 0 ? "erro" : "sucesso",
    data_referencia: dataISO,
    total_inseridos: totalOk,
    total_erros: totalErr,
    por_fonte: resultados,
    duracao_ms: Date.now() - t0,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
