import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 6000;

const PORTAIS = [
  { id: "compras-gov", nome: "Compras.gov.br", url: "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras", tipo: "federal" },
  { id: "pncp", nome: "PNCP", url: "https://pncp.gov.br", tipo: "federal" },
  { id: "bll", nome: "BLL Compras", url: "https://bll.org.br", tipo: "privado" },
  { id: "licitacoes-e", nome: "Licitações-e (BB)", url: "https://www.licitacoes-e.com.br", tipo: "privado" },
  { id: "bnc", nome: "Bolsa Nacional de Compras", url: "https://bnc.org.br", tipo: "privado" },
  { id: "portal-compras", nome: "Portal de Compras Públicas", url: "https://www.portaldecompraspublicas.com.br", tipo: "privado" },
  { id: "licitanet", nome: "Licitanet", url: "https://www.licitanet.com.br", tipo: "privado" },
  { id: "bbmnet", nome: "BBMNet", url: "https://www.bbmnet.com.br", tipo: "privado" },
  { id: "comprasbr", nome: "ComprasBR", url: "https://www.comprasbr.com.br", tipo: "privado" },
  { id: "bec-sp", nome: "BEC/SP", url: "https://www.bec.sp.gov.br", tipo: "estadual" },
  { id: "banparanet", nome: "Banparanet (PA)", url: "https://www.banparanet.pa.gov.br", tipo: "estadual" },
  { id: "comprasnet-ba", nome: "ComprasNet BA", url: "https://www.comprasnet.ba.gov.br", tipo: "estadual" },
  { id: "comprasnet-go", nome: "ComprasNet GO", url: "https://www.comprasnet.go.gov.br", tipo: "estadual" },
  { id: "compras-mg", nome: "Compras MG", url: "https://www.compras.mg.gov.br", tipo: "estadual" },
  { id: "compras-pe", nome: "PE Integrado", url: "https://www.peintegrado.pe.gov.br", tipo: "estadual" },
];

type PortalResult = {
  portal_id: string;
  portal_nome: string;
  status: string;
  seletores_ok: boolean;
  seletores_falhos: string[];
  ultima_verificacao: string;
  detalhes: Record<string, unknown>;
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

async function requestPortal(url: string, method: "HEAD" | "GET") {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: BROWSER_HEADERS,
  });

  return {
    response,
    elapsedMs: Date.now() - startedAt,
  };
}

async function checkPortal(portal: typeof PORTAIS[number]): Promise<PortalResult> {
  const detalhes: Record<string, unknown> = { tipo: portal.tipo };
  let status = "ok";
  let seletoresOk = true;
  const seletoresFalhos: string[] = [];

  try {
    let probe = await requestPortal(portal.url, "HEAD");

    if (!probe.response.ok || [403, 405, 429].includes(probe.response.status)) {
      probe = await requestPortal(portal.url, "GET");
      await probe.response.text();
    }

    detalhes.status_code = probe.response.status;
    detalhes.response_time_ms = probe.elapsedMs;
    detalhes.metodo = probe.response.url !== portal.url ? "GET" : "HEAD/GET";
    detalhes.url_final = probe.response.url;

    if (!probe.response.ok) {
      status = probe.response.status >= 500 ? "falha" : "alerta";
      seletoresOk = false;
      seletoresFalhos.push(`HTTP ${probe.response.status} — portal respondeu com erro`);
    }
  } catch (e: any) {
    status = "falha";
    seletoresOk = false;
    seletoresFalhos.push(`Timeout ou erro de conexão: ${e.message}`);
    detalhes.error = e.message;
  }

  return {
    portal_id: portal.id,
    portal_nome: portal.nome,
    status,
    seletores_ok: seletoresOk,
    seletores_falhos: seletoresFalhos,
    ultima_verificacao: new Date().toISOString(),
    detalhes,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const results = await Promise.all(PORTAIS.map((portal) => checkPortal(portal)));

    const upsertPayload = results.map((result) => ({
      ...result,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("portal_healthcheck")
      .upsert(upsertPayload, { onConflict: "portal_id" });

    if (upsertError) {
      throw upsertError;
    }

    const okCount = results.filter((result) => result.seletores_ok).length;
    const failCount = results.filter((result) => !result.seletores_ok).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        ok: okCount,
        falhas: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("portal-healthcheck error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});