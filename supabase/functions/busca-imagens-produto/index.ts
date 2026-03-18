import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extracts product image + title pairs from Mercado Livre search HTML.
 * ML uses img tags with http2.mlstatic.com sources for real product images.
 */
function extractMLImages(html: string): { titulo: string; image_url: string }[] {
  const results: { titulo: string; image_url: string }[] = [];
  const seen = new Set<string>();

  // Match img tags with mlstatic.com sources
  const imgTags = html.match(/<img[^>]+>/gi) || [];
  for (const tag of imgTags) {
    const srcMatch =
      tag.match(/src="(https?:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i) ||
      tag.match(/data-src="(https?:\/\/http2\.mlstatic\.com\/D_[^"]+)"/i);
    if (!srcMatch) continue;

    let imageUrl = srcMatch[1];
    // Skip tiny thumbnails (contain _Q_ or very small dimensions)
    if (/_S_\d{2,3}\.\w+$/i.test(imageUrl)) continue;

    // Normalize URL to avoid duplicates
    const baseUrl = imageUrl.replace(/D_[A-Z]+_NP_/, "D_NQ_NP_").split("?")[0];
    if (seen.has(baseUrl)) continue;
    seen.add(baseUrl);

    const altMatch = tag.match(/alt="([^"]*)"/i);
    const titulo = altMatch ? altMatch[1].trim() : "";

    if (titulo) {
      results.push({ titulo, image_url: imageUrl });
    }
  }

  return results.slice(0, 20); // Limit to 20 images
}

/**
 * Extracts product images from Amazon search HTML.
 */
function extractAmazonImages(html: string): { titulo: string; image_url: string }[] {
  const results: { titulo: string; image_url: string }[] = [];
  const seen = new Set<string>();

  const imgTags = html.match(/<img[^>]+>/gi) || [];
  for (const tag of imgTags) {
    const srcMatch =
      tag.match(/src="(https?:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
      tag.match(/data-src="(https?:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i);
    if (!srcMatch) continue;

    const imageUrl = srcMatch[1];
    const baseUrl = imageUrl.split("?")[0];
    if (seen.has(baseUrl)) continue;
    seen.add(baseUrl);

    const altMatch = tag.match(/alt="([^"]*)"/i);
    const titulo = altMatch ? altMatch[1].trim() : "";
    if (titulo && titulo.length > 5) {
      results.push({ titulo, image_url: imageUrl });
    }
  }

  return results.slice(0, 20);
}

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

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "FIRECRAWL_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Buscando imagens para:", termo);

    // Scrape Mercado Livre search results
    const mlSearchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(termo).replace(/%20/g, "-")}`;

    const [mlResponse, amzResponse] = await Promise.allSettled([
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: mlSearchUrl,
          formats: ["html"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      }),
      fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.amazon.com.br/s?k=${encodeURIComponent(termo)}`,
          formats: ["html"],
          onlyMainContent: true,
          waitFor: 3000,
        }),
      }),
    ]);

    const imagens: { titulo: string; image_url: string; fonte: string }[] = [];

    // Process ML results
    if (mlResponse.status === "fulfilled") {
      const mlData = await mlResponse.value.json();
      const html = mlData?.data?.html || mlData?.html || "";
      const mlImages = extractMLImages(html);
      console.log(`ML: ${mlImages.length} imagens extraídas`);
      imagens.push(...mlImages.map((img) => ({ ...img, fonte: "Mercado Livre" })));
    }

    // Process Amazon results
    if (amzResponse.status === "fulfilled") {
      const amzData = await amzResponse.value.json();
      const html = amzData?.data?.html || amzData?.html || "";
      const amzImages = extractAmazonImages(html);
      console.log(`Amazon: ${amzImages.length} imagens extraídas`);
      imagens.push(...amzImages.map((img) => ({ ...img, fonte: "Amazon" })));
    }

    console.log(`Total: ${imagens.length} imagens encontradas`);

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
