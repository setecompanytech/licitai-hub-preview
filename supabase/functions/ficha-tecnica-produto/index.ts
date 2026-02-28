import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, produto_nome } = await req.json();

    if (!url && !produto_nome) {
      return new Response(
        JSON.stringify({ success: false, error: "URL ou nome do produto obrigatório" }),
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

    const targetUrl = url || `https://lista.mercadolivre.com.br/${encodeURIComponent(produto_nome).replace(/%20/g, "-")}`;
    console.log("Scraping ficha técnica:", targetUrl);

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl error:", response.status);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao acessar página: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || data?.markdown || "";
    const html = data?.data?.html || data?.html || "";
    const metadata = data?.data?.metadata || data?.metadata || {};

    // Extract images from HTML
    const images: string[] = [];
    const seen = new Set<string>();

    // ML images
    const mlImgs = html.matchAll(/<img[^>]+(?:src|data-src)="(https?:\/\/http2\.mlstatic\.com\/D_[^"]+)"/gi);
    for (const m of mlImgs) {
      const u = m[1].split("?")[0];
      if (!seen.has(u) && !/_S_\d{2,3}\.\w+$/i.test(u)) { seen.add(u); images.push(m[1]); }
    }

    // Amazon images
    const amzImgs = html.matchAll(/<img[^>]+(?:src|data-src)="(https?:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/gi);
    for (const m of amzImgs) {
      const u = m[1].split("?")[0];
      if (!seen.has(u)) { seen.add(u); images.push(m[1]); }
    }

    // Generic product images (jpg/png/webp, min 200px or no size in URL)
    const genericImgs = html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+(?:\.jpg|\.png|\.webp|\.jpeg)[^"]*)"/gi);
    for (const m of genericImgs) {
      const u = m[1].split("?")[0];
      if (!seen.has(u) && !u.includes("logo") && !u.includes("icon") && !u.includes("sprite") && !u.includes("banner")) {
        seen.add(u);
        images.push(m[1]);
      }
    }

    // Extract specs from markdown
    const specs: { chave: string; valor: string }[] = [];
    // Pattern: "**Key**: Value" or "Key: Value" in table/list format
    const specPatterns = [
      /\*\*([^*]+)\*\*\s*[:：]\s*(.+)/g,
      /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g,
      /[-•]\s*([^:：]+)[:：]\s*(.+)/g,
    ];
    for (const pattern of specPatterns) {
      const matches = markdown.matchAll(pattern);
      for (const m of matches) {
        const key = m[1].trim();
        const val = m[2].trim();
        if (key.length > 2 && key.length < 60 && val.length > 0 && val.length < 200) {
          // Skip header rows and navigation
          if (/^-+$/.test(val) || /^#+/.test(key)) continue;
          specs.push({ chave: key, valor: val });
        }
      }
    }

    // Extract price
    const priceMatches = markdown.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi);
    const prices: number[] = [];
    for (const m of priceMatches) {
      const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(val) && val > 1 && val < 500000) prices.push(val);
    }

    // Extract title
    const title = metadata?.title || markdown.split("\n")[0]?.replace(/^#+\s*/, "") || produto_nome || "";

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: title.substring(0, 300),
          imagens: images.slice(0, 15),
          especificacoes: specs.slice(0, 40),
          preco: prices[0] || null,
          preco_original: prices.length > 1 && prices[1] > prices[0] ? prices[1] : null,
          descricao_resumida: markdown.substring(0, 1500),
          url: targetUrl,
          fonte: metadata?.sourceURL || targetUrl,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro ficha-tecnica-produto:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
