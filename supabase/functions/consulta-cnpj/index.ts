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

    // BrasilAPI - free, no auth required
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        return new Response(JSON.stringify({ error: "CNPJ não encontrado na base da Receita Federal. Verifique o número e tente novamente, ou preencha os dados manualmente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas consultas simultâneas. Aguarde alguns segundos e tente novamente." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro ao consultar CNPJ (código ${response.status}). Tente novamente ou preencha os dados manualmente.`);
    }

    const data = await response.json();

    const enderecoPartes = [data.logradouro, data.numero].filter(Boolean).join(", ");
    const complemento = data.complemento || "";
    const bairro = data.bairro || "";
    const enderecoCompleto = [enderecoPartes, complemento, bairro].filter(Boolean).join(" - ");

    const result = {
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      cnpj: cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
      situacao: data.descricao_situacao_cadastral || "",
      dataAbertura: data.data_inicio_atividade || "",
      naturezaJuridica: `${data.codigo_natureza_juridica || ""} - ${data.natureza_juridica || ""}`,
      cnaePrincipal: `${data.cnae_fiscal || ""} - ${data.cnae_fiscal_descricao || ""}`,
      cnaesSecundarios: (data.cnaes_secundarios || []).map(
        (c: any) => `${c.codigo} - ${c.descricao}`
      ),
      endereco: enderecoCompleto,
      complemento: complemento,
      bairro: bairro,
      cep: data.cep || "",
      municipio: data.municipio || "",
      uf: data.uf || "",
      porte: data.porte || "",
      capitalSocial: (data.capital_social || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      email: data.email || "",
      telefone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/^(\d{2})(\d+)/, "($1) $2") : "",
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
