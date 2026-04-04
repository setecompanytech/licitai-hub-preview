import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ML_API_BASE = "https://api.mercadolibre.com";

/**
 * Busca imagens de produtos via API pública do Mercado Livre.
 * Retorna thumbnails de alta qualidade + fotos detalhadas via multi-get.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req, { functionName: "busca-imagens-produto", maxRequests: 20, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { termo } = await req.json();

    if (!termo) {
      return new Response(
        JSON.stringify({ success: false, error: "Termo de busca obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Buscando imagens via ML API para:", termo);

    // Buscar produtos na API do ML
    const searchRes = await fetch(
      `${ML_API_BASE}/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=20`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!searchRes.ok) {
      throw new Error(`ML API retornou ${searchRes.status}`);
    }

    const searchData = await searchRes.json();
    const results = searchData.results || [];

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imagens: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar fotos em alta resolução via multi-get (até 20 IDs por request)
    const ids = results.map((r: any) => r.id);
    let picturesMap: Record<string, Array<{ url: string; secure_url: string }>> = {};

    try {
      const detailRes = await fetch(
        `${ML_API_BASE}/items?ids=${ids.join(",")}&attributes=id,pictures`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (detailRes.ok) {
        const detailData = await detailRes.json();
        for (const item of detailData) {
          if (item.code === 200 && item.body.pictures?.length > 0) {
            picturesMap[item.body.id] = item.body.pictures;
          }
        }
      }
    } catch (e) {
      console.error("Multi-get pictures error:", e);
    }

    // Montar resultado com imagens
    const imagens = results.map((item: any) => {
      const pictures = picturesMap[item.id];
      const thumbnailHQ = item.thumbnail_id
        ? `https://http2.mlstatic.com/D_NQ_NP_${item.thumbnail_id}-O.webp`
        : item.thumbnail;

      return {
        titulo: item.title,
        image_url: pictures?.[0]?.secure_url || pictures?.[0]?.url || thumbnailHQ,
        images: pictures
          ? pictures.map((p: any) => p.secure_url || p.url)
          : [thumbnailHQ],
        fonte: "Mercado Livre",
        preco: item.price,
        url: item.permalink,
      };
    }).filter((img: any) => img.titulo && img.image_url);

    console.log(`ML API: ${imagens.length} imagens encontradas`);

    return new Response(
      JSON.stringify({ success: true, imagens }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro busca-imagens-produto:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
