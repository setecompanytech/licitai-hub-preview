import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getIEFromCNPJA(cnpjLimpo: string, ufTarget: string): Promise<string> {
  try {
    const resp = await fetch(`https://open.cnpja.com/office/${cnpjLimpo}`, {
      headers: { "Accept": "application/json" },
    });
    if (!resp.ok) {
      await resp.text();
      return "";
    }
    const data = await resp.json();
    console.log("CNPJA keys:", Object.keys(data));
    
    // Check registrations array
    if (data.registrations?.length > 0) {
      console.log("CNPJA registrations:", JSON.stringify(data.registrations));
      const stateReg = data.registrations.find(
        (r: any) => (r.state || r.uf || "").toUpperCase() === ufTarget.toUpperCase() && r.enabled !== false
      );
      if (stateReg?.number) return stateReg.number;
      const anyActive = data.registrations.find((r: any) => r.enabled !== false);
      if (anyActive?.number) return anyActive.number;
    }

    // Check spidering/taxRegistration or similar fields
    if (data.spipiRegistrations?.length > 0) {
      const reg = data.spipiRegistrations.find((r: any) => r.state === ufTarget);
      if (reg?.number) return reg.number;
    }
    
    return "";
  } catch (e) {
    console.log("CNPJA error:", e);
    return "";
  }
}

async function getIEFromSpeedio(cnpjLimpo: string): Promise<{ ie: string; email: string }> {
  try {
    const resp = await fetch(`https://api-publica.speedio.com.br/buscarcnpj?cnpj=${cnpjLimpo}`);
    if (!resp.ok) {
      await resp.text();
      return { ie: "", email: "" };
    }
    const data = await resp.json();
    console.log("Speedio IE field:", data["INSCRICAO ESTADUAL"] || data.inscricao_estadual || "N/A");
    
    const ie = data["INSCRICAO ESTADUAL"] || data.inscricao_estadual || "";
    const email = data["EMAIL"] || data.email || "";
    
    // Filter out placeholder values
    if (ie && ie !== "ISENTO" && ie !== "0" && ie.length > 3) {
      return { ie, email };
    }
    return { ie: "", email };
  } catch (e) {
    console.log("Speedio error:", e);
    return { ie: "", email: "" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { cnpj } = await req.json();
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // ── Fetch from all sources in parallel ──
    const [brasilResp, cnpjaIE, speedioData] = await Promise.all([
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`),
      getIEFromCNPJA(cnpjLimpo, ""), // We'll refine with UF after BrasilAPI
      getIEFromSpeedio(cnpjLimpo),
    ]);

    if (!brasilResp.ok) {
      const status = brasilResp.status;
      await brasilResp.text();
      if (status === 404 || status === 400) {
        return new Response(JSON.stringify({ error: "CNPJ não encontrado na base da Receita Federal." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Muitas consultas simultâneas. Aguarde e tente novamente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro ao consultar CNPJ (código ${status}).`);
    }

    const data = await brasilResp.json();

    // ── Build full address ──
    const enderecoPartes = [data.logradouro, data.numero].filter(Boolean).join(", ");

    // ── Format phone ──
    let telefoneFormatado = "";
    if (data.ddd_telefone_1) {
      const tel = data.ddd_telefone_1.replace(/\D/g, "");
      if (tel.length >= 10) {
        const ddd = tel.slice(0, 2);
        const num = tel.slice(2);
        if (num.length === 9) {
          telefoneFormatado = `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
        } else if (num.length === 8) {
          telefoneFormatado = `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
        } else {
          telefoneFormatado = `(${ddd}) ${num}`;
        }
      } else {
        telefoneFormatado = data.ddd_telefone_1;
      }
    }

    // ── Format CNPJ ──
    const cnpjFormatado = cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

    // ── Format CEP ──
    let cepFormatado = "";
    if (data.cep) {
      const cepLimpo = String(data.cep).replace(/\D/g, "");
      if (cepLimpo.length === 8) {
        cepFormatado = `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
      } else {
        cepFormatado = data.cep;
      }
    }

    // ── Best email: BrasilAPI > Speedio ──
    let finalEmail = "";
    if (data.email && data.email.trim()) {
      finalEmail = data.email.trim().toLowerCase();
    } else if (speedioData.email && speedioData.email.trim()) {
      finalEmail = speedioData.email.trim().toLowerCase();
    }

    // ── Best IE: CNPJA > Speedio ──
    const inscricaoEstadual = cnpjaIE || speedioData.ie || "";

    // If CNPJA didn't have IE with empty UF, try again with the actual UF
    let finalIE = inscricaoEstadual;
    if (!finalIE && data.uf) {
      const retryIE = await getIEFromCNPJA(cnpjLimpo, data.uf);
      if (retryIE) finalIE = retryIE;
    }

    const result = {
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      cnpj: cnpjFormatado,
      situacao: data.descricao_situacao_cadastral || "",
      dataAbertura: data.data_inicio_atividade || "",
      naturezaJuridica: `${data.codigo_natureza_juridica || ""} - ${data.natureza_juridica || ""}`,
      cnaePrincipal: `${data.cnae_fiscal || ""} - ${data.cnae_fiscal_descricao || ""}`,
      cnaesSecundarios: (data.cnaes_secundarios || []).map(
        (c: any) => `${c.codigo} - ${c.descricao}`
      ),
      endereco: enderecoPartes,
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      cep: cepFormatado,
      municipio: data.municipio || "",
      uf: data.uf || "",
      porte: data.porte || "",
      capitalSocial: (data.capital_social || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      email: finalEmail,
      telefone: telefoneFormatado,
      inscricaoEstadual: finalIE,
      simples: data.opcao_pelo_simples || false,
    };

    console.log("FINAL RESULT:", JSON.stringify({ 
      cnpj: cnpjFormatado, email: finalEmail, ie: finalIE,
      sources: { brasilapi: true, cnpja: !!cnpjaIE, speedio: !!speedioData.ie }
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("CNPJ lookup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na consulta" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
