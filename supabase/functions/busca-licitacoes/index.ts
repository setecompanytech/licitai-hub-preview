import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, uf, modalidade, pagina } = await req.json();

    // PNCP - Portal Nacional de Contratações Públicas (API pública)
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (uf) params.set("uf", uf);
    if (modalidade) params.set("modalidade", modalidade);
    params.set("pagina", String(pagina || 1));
    params.set("tamanhoPagina", "20");

    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      // Fallback: return structured mock data when PNCP is unavailable
      console.warn("PNCP unavailable, returning sample data");
      return new Response(JSON.stringify({
        items: [],
        total: 0,
        pagina: pagina || 1,
        fonte: "offline",
        mensagem: "API do PNCP temporariamente indisponível. Tente novamente em alguns minutos.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      items: data.data || data.resultado || [],
      total: data.totalRegistros || 0,
      pagina: pagina || 1,
      fonte: "pncp",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Licitacoes search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na busca" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
