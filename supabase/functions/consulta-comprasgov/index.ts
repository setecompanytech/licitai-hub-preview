import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Edge Function para consultar a API de Dados Abertos do Compras.gov.br
 * Documentação: https://dadosabertos.compras.gov.br/swagger-ui/index.html
 *
 * Endpoints suportados:
 * - licitacoes: Lista licitações
 * - contratos: Lista contratos
 * - fornecedores: Consulta fornecedores
 * - itens: Itens de licitação
 * - atas: Atas de registro de preço
 * - materiais: Materiais/Serviços (CATMAT/CATSER)
 */
const BASE_URL = "https://dadosabertos.compras.gov.br/modulo-licitacao/v1";
const BASE_URL_CONTRATOS = "https://dadosabertos.compras.gov.br/modulo-contrato/v1";
const BASE_URL_FORNECEDOR = "https://dadosabertos.compras.gov.br/modulo-fornecedor/v1";
const BASE_URL_MATERIAL = "https://dadosabertos.compras.gov.br/modulo-material/v1";

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

    // Pagination defaults
    if (params?.pagina) queryParams.set("pagina", String(params.pagina));
    if (params?.tamanhoPagina) queryParams.set("tamanhoPagina", String(params.tamanhoPagina || 20));

    switch (endpoint) {
      // ─── LICITAÇÕES ───
      case "licitacoes": {
        url = `${BASE_URL}/licitacoes`;
        if (params?.dataInicial) queryParams.set("dataInicial", params.dataInicial);
        if (params?.dataFinal) queryParams.set("dataFinal", params.dataFinal);
        if (params?.codigoUasg) queryParams.set("codigoUasg", params.codigoUasg);
        if (params?.modalidade) queryParams.set("modalidade", params.modalidade);
        if (params?.numPregao) queryParams.set("numPregao", params.numPregao);
        if (params?.situacao) queryParams.set("situacao", params.situacao);
        if (params?.uf) queryParams.set("uf", params.uf);
        if (params?.municipio) queryParams.set("municipio", params.municipio);
        break;
      }

      case "licitacao-detalhe": {
        if (!params?.codigoUasg || !params?.numPregao) {
          return json({ error: "codigoUasg e numPregao são obrigatórios" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.codigoUasg}/${params.numPregao}`;
        break;
      }

      case "licitacao-itens": {
        if (!params?.codigoUasg || !params?.numPregao) {
          return json({ error: "codigoUasg e numPregao são obrigatórios" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.codigoUasg}/${params.numPregao}/itens`;
        break;
      }

      case "licitacao-participantes": {
        if (!params?.codigoUasg || !params?.numPregao) {
          return json({ error: "codigoUasg e numPregao são obrigatórios" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.codigoUasg}/${params.numPregao}/participantes`;
        break;
      }

      case "licitacao-atas": {
        if (!params?.codigoUasg || !params?.numPregao) {
          return json({ error: "codigoUasg e numPregao são obrigatórios" }, 400);
        }
        url = `${BASE_URL}/licitacoes/${params.codigoUasg}/${params.numPregao}/atas`;
        break;
      }

      // ─── CONTRATOS ───
      case "contratos": {
        url = `${BASE_URL_CONTRATOS}/contratos`;
        if (params?.dataInicial) queryParams.set("dataInicial", params.dataInicial);
        if (params?.dataFinal) queryParams.set("dataFinal", params.dataFinal);
        if (params?.codigoUasg) queryParams.set("codigoUasg", params.codigoUasg);
        if (params?.cnpjFornecedor) queryParams.set("cnpjFornecedor", params.cnpjFornecedor);
        if (params?.codigoOrgao) queryParams.set("codigoOrgao", params.codigoOrgao);
        break;
      }

      case "contrato-detalhe": {
        if (!params?.id) {
          return json({ error: "id do contrato é obrigatório" }, 400);
        }
        url = `${BASE_URL_CONTRATOS}/contratos/${params.id}`;
        break;
      }

      // ─── FORNECEDORES ───
      case "fornecedores": {
        url = `${BASE_URL_FORNECEDOR}/fornecedores`;
        if (params?.cnpj) queryParams.set("cnpj", params.cnpj);
        if (params?.razaoSocial) queryParams.set("razaoSocial", params.razaoSocial);
        if (params?.uf) queryParams.set("uf", params.uf);
        break;
      }

      case "fornecedor-detalhe": {
        if (!params?.cnpj) {
          return json({ error: "cnpj é obrigatório" }, 400);
        }
        url = `${BASE_URL_FORNECEDOR}/fornecedores/${params.cnpj}`;
        break;
      }

      case "fornecedor-penalidades": {
        if (!params?.cnpj) {
          return json({ error: "cnpj é obrigatório" }, 400);
        }
        url = `${BASE_URL_FORNECEDOR}/fornecedores/${params.cnpj}/penalidades`;
        break;
      }

      // ─── MATERIAIS / CATMAT / CATSER ───
      case "materiais": {
        url = `${BASE_URL_MATERIAL}/materiais`;
        if (params?.descricao) queryParams.set("descricao", params.descricao);
        if (params?.grupo) queryParams.set("grupo", params.grupo);
        if (params?.classe) queryParams.set("classe", params.classe);
        break;
      }

      case "servicos": {
        url = `${BASE_URL_MATERIAL}/servicos`;
        if (params?.descricao) queryParams.set("descricao", params.descricao);
        break;
      }

      // ─── PREÇOS PRATICADOS ───
      case "precos-praticados": {
        if (!params?.codigoMaterial) {
          return json({ error: "codigoMaterial é obrigatório" }, 400);
        }
        url = `${BASE_URL}/precos-praticados/${params.codigoMaterial}`;
        if (params?.dataInicial) queryParams.set("dataInicial", params.dataInicial);
        if (params?.dataFinal) queryParams.set("dataFinal", params.dataFinal);
        break;
      }

      default:
        return json({ error: `Endpoint desconhecido: ${endpoint}` }, 400);
    }

    const qs = queryParams.toString();
    const fullUrl = qs ? `${url}?${qs}` : url;

    console.log(`[consulta-comprasgov] ${endpoint} → ${fullUrl}`);

    const resp = await fetch(fullUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[consulta-comprasgov] Erro ${resp.status}: ${errText}`);
      return json({
        error: `API Compras.gov retornou ${resp.status}`,
        detalhes: errText.slice(0, 500),
      }, resp.status);
    }

    const data = await resp.json();
    return json({ success: true, data, endpoint });
  } catch (e: any) {
    console.error("[consulta-comprasgov] Erro:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
