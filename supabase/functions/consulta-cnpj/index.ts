import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Try BrasilAPI first
    let data: any = null;
    const brasilResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    
    if (brasilResp.ok) {
      data = await brasilResp.json();
    } else {
      if (brasilResp.status === 404 || brasilResp.status === 400) {
        return new Response(JSON.stringify({ error: "CNPJ não encontrado na base da Receita Federal." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (brasilResp.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas consultas simultâneas. Aguarde e tente novamente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro ao consultar CNPJ (código ${brasilResp.status}).`);
    }

    // Also try ReceitaWS for email (BrasilAPI sometimes returns empty email)
    let emailExtra = "";
    try {
      const receitaResp = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
        headers: { "Accept": "application/json" }
      });
      if (receitaResp.ok) {
        const receitaData = await receitaResp.json();
        if (receitaData.email && receitaData.email.trim()) {
          emailExtra = receitaData.email.trim().toLowerCase();
        }
      }
    } catch {
      // Silent - use BrasilAPI email
    }

    // Build full address
    const enderecoPartes = [data.logradouro, data.numero].filter(Boolean).join(", ");

    // Format phone
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

    // Format CNPJ
    const cnpjFormatado = cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

    // Format CEP
    let cepFormatado = "";
    if (data.cep) {
      const cepLimpo = String(data.cep).replace(/\D/g, "");
      if (cepLimpo.length === 8) {
        cepFormatado = `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
      } else {
        cepFormatado = data.cep;
      }
    }

    // Use the best available email: prefer non-empty
    const finalEmail = (data.email && data.email.trim()) ? data.email.trim().toLowerCase() : emailExtra;

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
      inscricaoEstadual: "",
      simples: data.opcao_pelo_simples || false,
    };

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
