// Sprint 5 — Consulta NF-e SEFAZ
// Suporta múltiplos provedores: NFe.io, FocusNFe, ou direto via certificado A1.
// Configure SEFAZ_API_TOKEN e SEFAZ_PROVIDER (nfeio | focusnfe) via secrets.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SEFAZ_API_TOKEN = Deno.env.get("SEFAZ_API_TOKEN");
    const SEFAZ_PROVIDER = (Deno.env.get("SEFAZ_PROVIDER") || "nfeio").toLowerCase();

    if (!SEFAZ_API_TOKEN) {
      return new Response(JSON.stringify({
        error: "SEFAZ não configurado",
        message: "Configure SEFAZ_API_TOKEN (NFe.io ou FocusNFe) nas configurações de Lovable Cloud para habilitar a consulta de NF-e.",
        setup_required: true,
        providers_supported: ["nfeio", "focusnfe"],
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { chave_nfe, cnpj_emitente } = await req.json();
    if (!chave_nfe || chave_nfe.length !== 44) {
      return new Response(JSON.stringify({ error: "Chave NF-e inválida (deve ter 44 dígitos)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let url: string, headers: Record<string, string>;

    if (SEFAZ_PROVIDER === "focusnfe") {
      url = `https://api.focusnfe.com.br/v2/nfe/${chave_nfe}`;
      headers = { "Authorization": `Basic ${btoa(SEFAZ_API_TOKEN + ":")}` };
    } else {
      // NFe.io (default)
      url = `https://api.nfe.io/v1/companies/${cnpj_emitente}/nfes/${chave_nfe}`;
      headers = { "Authorization": SEFAZ_API_TOKEN };
    }

    const r = await fetch(url, { headers });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar SEFAZ", details: data }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, provider: SEFAZ_PROVIDER, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[nfe-consult-sefaz] erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
