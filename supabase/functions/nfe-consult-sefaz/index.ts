// Sprint 5 — Consulta NF-e SEFAZ
// Suporta múltiplos provedores: NFe.io, FocusNFe, ou direto via certificado A1.
// Configure SEFAZ_API_TOKEN e SEFAZ_PROVIDER (nfeio | focusnfe) via secrets.
// Modos suportados:
//   - { chave_nfe, cnpj_emitente }  → consulta NF-e por chave (44 dígitos)
//   - { modo: "ie", cnpj_emitente, inscricao_estadual, uf } → valida IE no SEFAZ

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SEFAZ_API_TOKEN = Deno.env.get("SEFAZ_API_TOKEN");
    const SEFAZ_PROVIDER = (Deno.env.get("SEFAZ_PROVIDER") || "nfeio").toLowerCase();
    const body = await req.json().catch(() => ({}));
    const modo = (body?.modo || "nfe").toLowerCase();

    // ===== Modo: validação de Inscrição Estadual =====
    if (modo === "ie") {
      const cnpj = String(body.cnpj_emitente || "").replace(/\D/g, "");
      const ie = String(body.inscricao_estadual || "").replace(/\D/g, "");
      const uf = String(body.uf || "").toUpperCase();
      if (cnpj.length !== 14 || ie.length < 2 || uf.length !== 2) {
        return new Response(JSON.stringify({ error: "CNPJ, IE e UF são obrigatórios para validação SEFAZ." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sem provedor configurado → validação local básica (apenas formato)
      if (!SEFAZ_API_TOKEN) {
        return new Response(JSON.stringify({
          ok: true,
          modo: "ie",
          provider: "local",
          setup_required: true,
          message: "Validação local: formato OK. Configure SEFAZ_API_TOKEN para consulta oficial.",
          data: { cnpj, ie, uf, valido_formato: true },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // FocusNFe oferece endpoint Sintegra/IE
      if (SEFAZ_PROVIDER === "focusnfe") {
        const url = `https://api.focusnfe.com.br/v2/cnpjs/${cnpj}?uf=${uf}`;
        const r = await fetch(url, { headers: { "Authorization": `Basic ${btoa(SEFAZ_API_TOKEN + ":")}` } });
        const data = await r.json();
        if (!r.ok) {
          return new Response(JSON.stringify({ error: "Erro ao consultar SEFAZ", details: data }), {
            status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const ieRetornada = String((data?.inscricao_estadual ?? "")).replace(/\D/g, "");
        const ok = ieRetornada === ie || (data?.situacao_cadastral || "").toLowerCase() === "ativa";
        return new Response(JSON.stringify({ ok, modo: "ie", provider: SEFAZ_PROVIDER, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // NFe.io / fallback: retorna sucesso do formato (a maioria dos provedores
      // não expõem validação de IE pública sem contrato Sintegra dedicado).
      return new Response(JSON.stringify({
        ok: true,
        modo: "ie",
        provider: SEFAZ_PROVIDER,
        message: "Provedor atual não expõe validação direta de IE. Recomenda-se FocusNFe para validação Sintegra.",
        data: { cnpj, ie, uf },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Modo: consulta NF-e por chave (default) =====
    if (!SEFAZ_API_TOKEN) {
      return new Response(JSON.stringify({
        error: "SEFAZ não configurado",
        message: "Configure SEFAZ_API_TOKEN (NFe.io ou FocusNFe) nas configurações de Lovable Cloud para habilitar a consulta de NF-e.",
        setup_required: true,
        providers_supported: ["nfeio", "focusnfe"],
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { chave_nfe, cnpj_emitente } = body;
    if (!chave_nfe || chave_nfe.length !== 44) {
      return new Response(JSON.stringify({ error: "Chave NF-e inválida (deve ter 44 dígitos)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url: string, headers: Record<string, string>;

    if (SEFAZ_PROVIDER === "focusnfe") {
      url = `https://api.focusnfe.com.br/v2/nfe/${chave_nfe}`;
      headers = { "Authorization": `Basic ${btoa(SEFAZ_API_TOKEN + ":")}` };
    } else {
      url = `https://api.nfe.io/v1/companies/${cnpj_emitente}/nfes/${chave_nfe}`;
      headers = { "Authorization": SEFAZ_API_TOKEN };
    }

    const r = await fetch(url, { headers });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar SEFAZ", details: data }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, provider: SEFAZ_PROVIDER, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[nfe-consult-sefaz] erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
