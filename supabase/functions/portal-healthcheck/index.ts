import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known portals with their expected URLs for basic health checking
const PORTAIS = [
  { id: "compras-gov", nome: "Compras.gov.br", url: "https://cnetmobile.estaleiro.serpro.gov.br", tipo: "federal" },
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const results: Array<{
      portal_id: string;
      portal_nome: string;
      status: string;
      seletores_ok: boolean;
      seletores_falhos: string[];
      ultima_verificacao: string;
      detalhes: Record<string, unknown>;
    }> = [];

    // Check each portal's accessibility
    for (const portal of PORTAIS) {
      let status = "ok";
      let seletoresOk = true;
      const seletoresFalhos: string[] = [];
      const detalhes: Record<string, unknown> = { tipo: portal.tipo };

      try {
        const resp = await fetch(portal.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "PRAEFECTUS-Healthcheck/1.0" },
        });

        detalhes.status_code = resp.status;
        detalhes.response_time_ms = Date.now();

        if (!resp.ok) {
          status = "alerta";
          seletoresOk = false;
          seletoresFalhos.push(`HTTP ${resp.status} — Portal pode estar indisponível`);
        }
      } catch (e: any) {
        status = "falha";
        seletoresOk = false;
        seletoresFalhos.push(`Timeout ou erro de conexão: ${e.message}`);
        detalhes.error = e.message;
      }

      results.push({
        portal_id: portal.id,
        portal_nome: portal.nome,
        status,
        seletores_ok: seletoresOk,
        seletores_falhos: seletoresFalhos,
        ultima_verificacao: new Date().toISOString(),
        detalhes,
      });
    }

    // Upsert results
    for (const r of results) {
      // Check if exists
      const { data: existing } = await supabase
        .from("portal_healthcheck")
        .select("id")
        .eq("portal_id", r.portal_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("portal_healthcheck")
          .update({
            status: r.status,
            seletores_ok: r.seletores_ok,
            seletores_falhos: r.seletores_falhos,
            ultima_verificacao: r.ultima_verificacao,
            detalhes: r.detalhes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("portal_healthcheck").insert(r);
      }
    }

    const okCount = results.filter((r) => r.seletores_ok).length;
    const failCount = results.filter((r) => !r.seletores_ok).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        ok: okCount,
        falhas: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("portal-healthcheck error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
