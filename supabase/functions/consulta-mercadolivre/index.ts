import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ML_API_BASE = "https://api.mercadolibre.com";

interface MLProduct {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  condition: string;
  permalink: string;
  thumbnail: string;
  thumbnail_id: string;
  seller: {
    id: number;
    nickname: string;
    power_seller_status: string | null;
    seller_reputation?: {
      level_id: string;
      power_seller_status: string | null;
      transactions?: {
        completed: number;
        canceled: number;
      };
    };
  };
  shipping: {
    free_shipping: boolean;
    mode: string;
  };
  attributes: Array<{
    id: string;
    name: string;
    value_name: string | null;
  }>;
  catalog_product_id?: string;
  catalog_listing?: boolean;
  installments?: {
    quantity: number;
    amount: number;
    rate: number;
  };
  official_store_id?: number | null;
  official_store_name?: string;
  pictures?: Array<{ url: string; secure_url: string }>;
}

interface MLSearchResponse {
  site_id: string;
  country_default_time_zone: string;
  query: string;
  paging: {
    total: number;
    primary_results: number;
    offset: number;
    limit: number;
  };
  results: MLProduct[];
  available_filters: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; name: string; results: number }>;
  }>;
}

function extractBrand(attrs: MLProduct["attributes"]): string {
  const brandAttr = attrs.find(
    (a) => a.id === "BRAND" || a.name?.toLowerCase() === "marca"
  );
  return brandAttr?.value_name || "";
}

function extractModel(attrs: MLProduct["attributes"]): string {
  const modelAttr = attrs.find(
    (a) => a.id === "MODEL" || a.name?.toLowerCase() === "modelo"
  );
  return modelAttr?.value_name || "";
}

function mapCondition(condition: string): string {
  switch (condition) {
    case "new":
      return "Novo";
    case "used":
      return "Usado";
    case "refurbished":
      return "Recondicionado";
    default:
      return condition;
  }
}

/**
 * Busca produtos na API pública do Mercado Livre (MLB = Brasil).
 * Retorna até 50 resultados por consulta.
 * Rate limit: ~30 req/min por IP (sem autenticação).
 */
async function searchML(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    sort?: string;
    condition?: string;
    category?: string;
    price_min?: number;
    price_max?: number;
  } = {}
): Promise<MLSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(options.limit || 50, 50)),
    offset: String(options.offset || 0),
  });

  if (options.sort) params.set("sort", options.sort);
  if (options.condition) params.set("ITEM_CONDITION", options.condition);
  if (options.category) params.set("category", options.category);
  if (options.price_min) params.set("price", `${options.price_min}-*`);
  if (options.price_max) {
    const existing = params.get("price");
    if (existing) {
      params.set("price", `${options.price_min || "*"}-${options.price_max}`);
    } else {
      params.set("price", `*-${options.price_max}`);
    }
  }

  const url = `${ML_API_BASE}/sites/MLB/search?${params.toString()}`;
  console.log("ML API Search:", url);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`ML API error ${res.status}:`, errorBody);
    throw new Error(`ML API retornou ${res.status}`);
  }

  return res.json();
}

/**
 * Busca detalhes de um produto específico (inclui fotos em alta resolução).
 */
async function getProductDetails(
  itemId: string
): Promise<{ pictures: Array<{ url: string; secure_url: string }> } | null> {
  try {
    const res = await fetch(`${ML_API_BASE}/items/${itemId}?include_attributes=all`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Busca imagens de múltiplos itens em paralelo (batch de IDs).
 */
async function getMultiItemDetails(
  ids: string[]
): Promise<
  Array<{
    code: number;
    body: {
      id: string;
      pictures?: Array<{ url: string; secure_url: string; size: string }>;
    };
  }>
> {
  if (ids.length === 0) return [];

  // API suporta até 20 IDs por request
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) {
    batches.push(ids.slice(i, i + 20));
  }

  const allResults: Array<{
    code: number;
    body: {
      id: string;
      pictures?: Array<{ url: string; secure_url: string; size: string }>;
    };
  }> = [];

  for (const batch of batches) {
    try {
      const res = await fetch(
        `${ML_API_BASE}/items?ids=${batch.join(",")}&attributes=id,pictures`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        allResults.push(...data);
      }
    } catch (e) {
      console.error("ML multi-item error:", e);
    }
  }

  return allResults;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req, {
      functionName: "consulta-mercadolivre",
      maxRequests: 30,
      windowMinutes: 5,
    });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const body = await req.json();
    const {
      termo,
      termos,
      limite = 50,
      offset = 0,
      ordenar,
      condicao,
      categoria,
      preco_min,
      preco_max,
      incluir_imagens = false,
      modo = "precos", // "precos" | "imagens" | "completo"
    } = body;

    const searchQuery = termo || (termos && termos[0]);

    if (!searchQuery) {
      return new Response(
        JSON.stringify({ success: false, error: "Termo de busca obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`ML busca [${modo}]:`, searchQuery);

    // Executar busca
    const mlData = await searchML(searchQuery, {
      limit: Math.min(limite, 50),
      offset,
      sort: ordenar,
      condition: condicao === "novo" ? "new" : condicao === "usado" ? "used" : undefined,
      category: categoria,
      price_min: preco_min,
      price_max: preco_max,
    });

    // Se modo imagens, buscar fotos em alta resolução
    let picturesMap: Record<string, Array<{ url: string; secure_url: string }>> = {};

    if ((modo === "imagens" || modo === "completo" || incluir_imagens) && mlData.results.length > 0) {
      const ids = mlData.results.map((r) => r.id);
      const details = await getMultiItemDetails(ids);
      for (const detail of details) {
        if (detail.code === 200 && detail.body.pictures) {
          picturesMap[detail.body.id] = detail.body.pictures.map((p) => ({
            url: p.url || p.secure_url,
            secure_url: p.secure_url || p.url,
          }));
        }
      }
    }

    // Formatar resposta
    const produtos = mlData.results.map((item) => {
      const marca = extractBrand(item.attributes);
      const modelo = extractModel(item.attributes);
      const imagens = picturesMap[item.id] || [];

      // Thumbnail de alta qualidade
      const thumbnailHQ = item.thumbnail_id
        ? `https://http2.mlstatic.com/D_NQ_NP_${item.thumbnail_id}-O.webp`
        : item.thumbnail;

      return {
        id: item.id,
        titulo: item.title,
        preco: item.price,
        preco_original: item.original_price,
        moeda: item.currency_id,
        condicao: mapCondition(item.condition),
        disponivel: item.available_quantity,
        vendidos: item.sold_quantity,
        url: item.permalink,
        thumbnail: thumbnailHQ,
        imagens: imagens.length > 0
          ? imagens.map((i) => i.secure_url || i.url)
          : [thumbnailHQ],
        marca,
        modelo,
        vendedor: {
          nome: item.seller.nickname,
          reputacao: item.seller.power_seller_status || item.seller.seller_reputation?.level_id,
          power_seller: !!item.seller.power_seller_status,
        },
        frete_gratis: item.shipping.free_shipping,
        parcelas: item.installments
          ? `${item.installments.quantity}x R$ ${item.installments.amount.toFixed(2)}${item.installments.rate === 0 ? " sem juros" : ""}`
          : null,
        loja_oficial: item.official_store_name || null,
        catalogo: item.catalog_listing || false,
        desconto: item.original_price && item.original_price > item.price
          ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
          : null,
      };
    });

    // Estatísticas de preço
    const precos = produtos.filter((p) => p.preco > 0).map((p) => p.preco);
    const estatisticas =
      precos.length > 0
        ? {
            menor: Math.min(...precos),
            maior: Math.max(...precos),
            media: parseFloat((precos.reduce((a, b) => a + b, 0) / precos.length).toFixed(2)),
            mediana: (() => {
              const sorted = [...precos].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            })(),
            total_resultados: mlData.paging.total,
            total_retornados: produtos.length,
          }
        : null;

    // Categorias disponíveis (para filtros no frontend)
    const categorias = mlData.available_filters
      ?.find((f) => f.id === "category")
      ?.values.map((v) => ({ id: v.id, nome: v.name, quantidade: v.results })) || [];

    console.log(`ML: ${produtos.length} produtos, ${precos.length} com preço válido`);

    return new Response(
      JSON.stringify({
        success: true,
        query: mlData.query,
        produtos,
        estatisticas,
        categorias,
        paginacao: mlData.paging,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro consulta-mercadolivre:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
