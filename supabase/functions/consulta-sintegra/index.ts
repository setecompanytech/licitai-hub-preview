import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj, uf } = await req.json();
    if (!cnpj || !uf) {
      return new Response(JSON.stringify({ error: "CNPJ e UF são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const ufUpper = uf.toUpperCase();
    let inscricaoEstadual = "";
    let statusIE = "";
    let fonte = "";

    // ── Source 1: CNPJA Open API (Cadastro de Contribuintes) ──
    try {
      const cnpjaResp = await fetch(`https://open.cnpja.com/office/${cnpjLimpo}`, {
        headers: { "Accept": "application/json" },
      });
      if (cnpjaResp.ok) {
        const cnpjaData = await cnpjaResp.json();
        console.log("CNPJA response keys:", Object.keys(cnpjaData));
        
        if (cnpjaData.registrations?.length > 0) {
          console.log("CNPJA registrations found:", JSON.stringify(cnpjaData.registrations));
          const stateReg = cnpjaData.registrations.find(
            (r: any) => (r.state || "").toUpperCase() === ufUpper
          );
          if (stateReg) {
            inscricaoEstadual = stateReg.number || "";
            statusIE = stateReg.enabled ? "ATIVA" : "INATIVA";
            fonte = "CNPJA/Cadastro Contribuintes";
          } else {
            const anyActive = cnpjaData.registrations.find((r: any) => r.enabled !== false);
            if (anyActive?.number) {
              inscricaoEstadual = anyActive.number;
              statusIE = "ATIVA";
              fonte = "CNPJA/Cadastro Contribuintes";
            }
          }
        } else {
          console.log("CNPJA: no registrations array or empty");
        }
      } else {
        const body = await cnpjaResp.text();
        console.log("CNPJA error:", cnpjaResp.status, body);
      }
    } catch (e) {
      console.error("CNPJA API error:", e);
    }

    // ── Source 2: Speedio Public API ──
    if (!inscricaoEstadual) {
      try {
        const speedioResp = await fetch(`https://api-publica.speedio.com.br/buscarcnpj?cnpj=${cnpjLimpo}`);
        if (speedioResp.ok) {
          const speedioData = await speedioResp.json();
          const ie = speedioData["INSCRICAO ESTADUAL"] || speedioData.inscricao_estadual || "";
          console.log("Speedio IE:", ie);
          
          if (ie && ie !== "ISENTO" && ie !== "0" && ie !== "*" && ie.length > 3) {
            inscricaoEstadual = ie;
            statusIE = speedioData["STATUS"] || "ENCONTRADA";
            fonte = "Speedio/Receita Federal";
          }
        } else {
          await speedioResp.text();
        }
      } catch (e) {
        console.log("Speedio error:", e);
      }
    }

    // ── Fallback: BrasilAPI for company name ──
    let razaoSocial = "";
    let nomeFantasia = "";
    let municipio = "";
    try {
      const brasilResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (brasilResp.ok) {
        const brasilData = await brasilResp.json();
        razaoSocial = brasilData.razao_social || "";
        nomeFantasia = brasilData.nome_fantasia || "";
        municipio = brasilData.municipio || "";
      } else {
        await brasilResp.text();
      }
    } catch { /* silent */ }

    const cnpjFormatado = cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

    console.log("SINTEGRA FINAL:", JSON.stringify({ 
      cnpj: cnpjFormatado, uf: ufUpper, ie: inscricaoEstadual, status: statusIE, fonte
    }));

    const resultado = {
      cnpj: cnpjFormatado,
      inscricaoEstadual,
      statusInscricao: statusIE,
      fonte,
      razaoSocial,
      nomeFantasia,
      uf: ufUpper,
      municipio,
      dataConsulta: new Date().toISOString(),
    };

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro SINTEGRA:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
