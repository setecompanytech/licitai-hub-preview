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
    // Auth + rate limit: 20 requests per 5 minutes
    try {
      await requireAuth(req, { functionName: "consulta-cnpj", maxRequests: 60, windowMinutes: 5 });
    } catch (authResp) {
      if (authResp instanceof Response) return authResp;
      throw authResp;
    }
    const { cnpj } = await req.json();
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // ── Helper: normaliza payload de provedores alternativos para o formato BrasilAPI ──
    const normalizeFromCnpjWs = (d: any) => ({
      razao_social: d.razao_social,
      nome_fantasia: d.estabelecimento?.nome_fantasia,
      descricao_situacao_cadastral: d.estabelecimento?.situacao_cadastral,
      data_inicio_atividade: d.estabelecimento?.data_inicio_atividade,
      codigo_natureza_juridica: d.natureza_juridica?.id,
      natureza_juridica: d.natureza_juridica?.descricao,
      cnae_fiscal: d.estabelecimento?.atividade_principal?.id,
      cnae_fiscal_descricao: d.estabelecimento?.atividade_principal?.descricao,
      cnaes_secundarios: (d.estabelecimento?.atividades_secundarias || []).map((a: any) => ({ codigo: a.id, descricao: a.descricao })),
      logradouro: d.estabelecimento?.logradouro,
      numero: d.estabelecimento?.numero,
      complemento: d.estabelecimento?.complemento,
      bairro: d.estabelecimento?.bairro,
      cep: d.estabelecimento?.cep,
      municipio: d.estabelecimento?.cidade?.nome,
      uf: d.estabelecimento?.estado?.sigla,
      porte: d.porte?.descricao,
      capital_social: Number(d.capital_social || 0),
      email: d.estabelecimento?.email,
      ddd_telefone_1: d.estabelecimento?.ddd1 && d.estabelecimento?.telefone1
        ? `${d.estabelecimento.ddd1}${d.estabelecimento.telefone1}` : "",
      opcao_pelo_simples: !!d.simples?.simples,
    });

    const normalizeFromCnpja = (d: any) => ({
      razao_social: d.company?.name || d.alias,
      nome_fantasia: d.alias,
      descricao_situacao_cadastral: d.status?.text,
      data_inicio_atividade: d.founded,
      codigo_natureza_juridica: d.company?.nature?.id,
      natureza_juridica: d.company?.nature?.text,
      cnae_fiscal: d.mainActivity?.id,
      cnae_fiscal_descricao: d.mainActivity?.text,
      cnaes_secundarios: (d.sideActivities || []).map((a: any) => ({ codigo: a.id, descricao: a.text })),
      logradouro: [d.address?.street].filter(Boolean).join(" "),
      numero: d.address?.number,
      complemento: d.address?.details,
      bairro: d.address?.district,
      cep: d.address?.zip,
      municipio: d.address?.city,
      uf: d.address?.state,
      porte: d.company?.size?.text,
      capital_social: Number(d.company?.equity || 0),
      email: d.emails?.[0]?.address,
      ddd_telefone_1: d.phones?.[0] ? `${d.phones[0].area}${d.phones[0].number}` : "",
      opcao_pelo_simples: !!d.company?.simples?.optant,
    });

    // ── Cadeia de provedores: BrasilAPI → CNPJ.ws → CNPJA → Receitaws ──
    let data: any = null;
    let providerUsed = "";

    // Disparamos BrasilAPI + IE complementares em paralelo, mas tratamos fallback se 429/500
    const [brasilResp, cnpjaIE, speedioData] = await Promise.all([
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`).catch(() => null),
      getIEFromCNPJA(cnpjLimpo, ""),
      getIEFromSpeedio(cnpjLimpo),
    ]);

    if (brasilResp && brasilResp.ok) {
      data = await brasilResp.json();
      providerUsed = "brasilapi";
    } else {
      const status = brasilResp?.status ?? 0;
      console.warn(`BrasilAPI falhou (status=${status}), tentando CNPJ.ws…`);
      if (status === 404 || status === 400) {
        return new Response(JSON.stringify({ error: "CNPJ não encontrado na base da Receita Federal." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback 1: CNPJ.ws (público, sem chave)
      try {
        const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
        if (r.ok) {
          const j = await r.json();
          data = normalizeFromCnpjWs(j);
          providerUsed = "cnpj.ws";
        } else {
          console.warn(`CNPJ.ws falhou (status=${r.status})`);
        }
      } catch (e) {
        console.warn("CNPJ.ws erro:", e);
      }

      // Fallback 2: CNPJA Open
      if (!data) {
        try {
          const r = await fetch(`https://open.cnpja.com/office/${cnpjLimpo}`, { headers: { Accept: "application/json" } });
          if (r.ok) {
            const j = await r.json();
            data = normalizeFromCnpja(j);
            providerUsed = "cnpja";
          } else {
            console.warn(`CNPJA falhou (status=${r.status})`);
          }
        } catch (e) {
          console.warn("CNPJA erro:", e);
        }
      }

      // Fallback 3: ReceitaWS
      if (!data) {
        try {
          const r = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`);
          if (r.ok) {
            const j = await r.json();
            if (j.status !== "ERROR") {
              data = {
                razao_social: j.nome,
                nome_fantasia: j.fantasia,
                descricao_situacao_cadastral: j.situacao,
                data_inicio_atividade: j.abertura,
                codigo_natureza_juridica: "",
                natureza_juridica: j.natureza_juridica,
                cnae_fiscal: j.atividade_principal?.[0]?.code,
                cnae_fiscal_descricao: j.atividade_principal?.[0]?.text,
                cnaes_secundarios: (j.atividades_secundarias || []).map((a: any) => ({ codigo: a.code, descricao: a.text })),
                logradouro: j.logradouro,
                numero: j.numero,
                complemento: j.complemento,
                bairro: j.bairro,
                cep: j.cep,
                municipio: j.municipio,
                uf: j.uf,
                porte: j.porte,
                capital_social: Number(String(j.capital_social || "0").replace(/\D/g, "")) / 100,
                email: j.email,
                ddd_telefone_1: j.telefone,
                opcao_pelo_simples: !!j.simples?.optante,
              };
              providerUsed = "receitaws";
            }
          }
        } catch (e) {
          console.warn("ReceitaWS erro:", e);
        }
      }

      if (!data) {
        return new Response(JSON.stringify({
          error: "Os provedores públicos da Receita Federal estão temporariamente indisponíveis. Tente novamente em alguns minutos.",
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    console.log(`Provedor usado: ${providerUsed}`);

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
