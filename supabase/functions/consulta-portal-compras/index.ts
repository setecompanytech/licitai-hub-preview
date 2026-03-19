import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function para consultar a API pública do Portal de Compras Públicas
 * Documentação: https://apipcp.portaldecompraspublicas.com.br/publico/apidoc/
 *
 * Endpoints:
 * - licitacoes: Buscar licitações públicas
 * - licitacao-detalhe: Detalhe de uma licitação
 * - licitacao-itens: Itens de uma licitação
 * - orgaos: Listar órgãos
 */
const BASE_URL = "https://apipcp.portaldecompraspublicas.com.br/publico/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, params } = await req.json();

    if (!endpoint) {
      return json({ error: "endpoint é obrigatório" }, 400);
    }

    let url: string;
    const queryParams = new URLSearchParams();

    // Pagination
    if (params?.page) queryParams.set("page", String(params.page));
    if (params?.limit) queryParams.set("limit", String(params.limit || 20));

    switch (endpoint) {
      case "licitacoes": {
        url = `${BASE_URL}/licitacoes`;
        if (params?.status) queryParams.set("status", params.status);
        if (params?.dataInicio) queryParams.set("dataInicio", params.dataInicio);
        if (params?.dataFim) queryParams.set("dataFim", params.dataFim);
        if (params?.objeto) queryParams.set("objeto", params.objeto);
        if (params?.uf) queryParams.set("uf", params.uf);
        if (params?.modalidade) queryParams.set("modalidade", params.modalidade);
        if (params?.orgao) queryParams.set("orgao", params.orgao);
        break;
      }

      case "licitacao-detalhe": {
        if (!params?.id) {
          return json({ error: "id da licitação é obrigatório" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.id}`;
        break;
      }

      case "licitacao-itens": {
        if (!params?.id) {
          return json({ error: "id da licitação é obrigatório" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.id}/itens`;
        break;
      }

      case "orgaos": {
        url = `${BASE_URL}/orgaos`;
        if (params?.nome) queryParams.set("nome", params.nome);
        if (params?.uf) queryParams.set("uf", params.uf);
        break;
      }

      case "propostas": {
        if (!params?.licitacaoId) {
          return json({ error: "licitacaoId é obrigatório" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.licitacaoId}/propostas`;
        break;
      }

      default:
        return json({ error: `Endpoint desconhecido: ${endpoint}` }, 400);
    }

    const qs = queryParams.toString();
    const fullUrl = qs ? `${url}?${qs}` : url;

    console.log(`[consulta-portal-compras] ${endpoint} → ${fullUrl}`);

    const resp = await fetch(fullUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[consulta-portal-compras] Erro ${resp.status}: ${errText}`);
      return json({
        error: `API Portal de Compras retornou ${resp.status}`,
        detalhes: errText.slice(0, 500),
      }, resp.status);
    }

    const data = await resp.json();
    return json({ success: true, data, endpoint });
  } catch (e: any) {
    console.error("[consulta-portal-compras] Erro:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
