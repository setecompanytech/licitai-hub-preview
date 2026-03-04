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

    // Try BrasilAPI CNPJ endpoint to get company data
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Erro ao consultar dados. Verifique o CNPJ informado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Try to get real IE from ReceitaWS as fallback
    let inscricaoEstadual = "";
    
    try {
      const receitaResp = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
        headers: { "Accept": "application/json" }
      });
      if (receitaResp.ok) {
        const receitaData = await receitaResp.json();
        // ReceitaWS doesn't directly provide IE, but some alternative APIs do
        // Check if there's an inscricao_estadual field
        if (receitaData.inscricao_estadual) {
          inscricaoEstadual = receitaData.inscricao_estadual;
        }
      }
    } catch {
      // Silent fallback
    }

    // If still no IE, try CasadosDados API
    if (!inscricaoEstadual) {
      try {
        const casaResp = await fetch(`https://api.casadosdados.com.br/v2/public/cnpj/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: { termo: [cnpjLimpo] } }),
        });
        if (casaResp.ok) {
          const casaData = await casaResp.json();
          if (casaData?.data?.cnpj?.[0]?.inscricao_estadual) {
            inscricaoEstadual = casaData.data.cnpj[0].inscricao_estadual;
          }
        }
      } catch {
        // Silent fallback
      }
    }

    const cnpjFormatado = cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

    const resultado = {
      cnpj: cnpjFormatado,
      inscricaoEstadual: inscricaoEstadual || "",
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      situacaoCadastral: data.descricao_situacao_cadastral || "",
      dataSituacao: data.data_situacao_cadastral || "",
      regimeApuracao: data.opcao_pelo_simples ? "Simples Nacional" : "Regime Normal",
      uf: uf.toUpperCase(),
      municipio: data.municipio || "",
      endereco: [data.logradouro, data.numero, data.complemento, data.bairro].filter(Boolean).join(", "),
      cep: data.cep || "",
      atividadePrincipal: data.cnae_fiscal_descricao || "",
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
