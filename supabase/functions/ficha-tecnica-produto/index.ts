import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Check if URL looks like a real product image */
function isProductImage(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (/logo|icon|sprite|banner|favicon|avatar|badge|selo|stamp|watermark/i.test(lower)) return false;
  if (/1x1|pixel|tracking|analytics/i.test(lower)) return false;
  if (/ad[s]?[_\-\/]|doubleclick|googlesyndication|adsense|pubmatic|criteo|taboola|outbrain/i.test(lower)) return false;
  if (/promo|campanha|anuncio|hero[-_]?banner|og[_\-.]|social[-_]?share/i.test(lower)) return false;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\/|\/rating\/|\/stars\//i.test(lower)) return false;
  if (/vlibras|access_popup|shopee-pcmall-live-sg/i.test(lower)) return false;
  if (/_S_\d{2,3}\.\w+$/i.test(lower)) return false;
  if (/_AC_US\d{1,3}_/i.test(lower)) return false;
  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(lower);
}

/** Extract images from scraped HTML/markdown */
function extractImagesFromContent(html: string, markdown: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  function add(url: string) {
    if (!url || seen.has(url) || !isProductImage(url)) return;
    seen.add(url);
    images.push(url);
  }

  // ML images
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src|data-zoom)="(https?:\/\/http2\.mlstatic\.com\/D_[^"]+)"/gi)) {
    add(m[1]);
  }
  // Amazon images
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src)="(https?:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/gi)) {
    add(m[1]);
  }
  // KaBuM images
  for (const m of html.matchAll(/<img[^>]+src="(https?:\/\/images\.kabum\.com\.br\/[^"]+)"/gi)) {
    add(m[1]);
  }
  // Generic product images from HTML
  for (const m of html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+(?:\.jpg|\.png|\.webp|\.jpeg)[^"]*)"/gi)) {
    add(m[1]);
  }
  // Markdown images ![alt](url)
  for (const m of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi)) {
    add(m[1]);
  }
  // Raw URLs in markdown
  for (const m of markdown.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))(?:\?[^\s"'<>]*)?/gi)) {
    add(m[1]);
  }

  return images.slice(0, 20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req, { functionName: "ficha-tecnica-produto", maxRequests: 15, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
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

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // ─── STEP 1: Determine the best URL to scrape ───
    let targetUrl = url;

    // If no URL or URL is a search page, find a product page first
    if (!targetUrl || /\/busca\/|\/search|\?q=/i.test(targetUrl)) {
      console.log("No valid product URL, searching for product page...");
      const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `"${produto_nome}" ficha técnica especificações`,
          limit: 5,
          lang: "pt-BR",
          country: "BR",
        }),
      });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const results = searchData?.data || [];
        // Find a product detail page
        const productResult = results.find((r: any) => {
          const u = (r.url || '').toLowerCase();
          return (
            /mlb[-\/]?\d{6,}/i.test(u) || /\/dp\//i.test(u) || /\/p\//i.test(u) ||
            /\/produto\//i.test(u) || /produto\.mercadolivre/i.test(u)
          );
        }) || results[0];

        if (productResult?.url) {
          targetUrl = productResult.url;
        }
      }

      if (!targetUrl) {
        targetUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(produto_nome || '').replace(/%20/g, "-")}`;
      }
    }

    console.log("Scraping ficha técnica:", targetUrl);

    // ─── STEP 2: Scrape the page with full content ───
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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

    // ─── STEP 3: Extract images ───
    const images = extractImagesFromContent(html, markdown);

    // ─── STEP 4: Use AI to extract structured specs ───
    let specs: { chave: string; valor: string }[] = [];
    let titulo = metadata?.title || "";
    let descricaoResumida = "";
    let precoAI: number | null = null;
    let precoOriginalAI: number | null = null;

    if (lovableApiKey && markdown.length > 50) {
      try {
        const aiPrompt = `Analise o conteúdo da página de produto abaixo e extraia as informações em formato JSON EXATO.
Retorne APENAS o JSON, sem markdown, sem \`\`\`, sem explicações.

O JSON deve ter esta estrutura:
{
  "titulo": "nome completo do produto",
  "descricao_resumida": "descrição objetiva do produto em 2-3 frases, sem termos promocionais",
  "preco": 99.90,
  "preco_original": 129.90,
  "especificacoes": [
    {"chave": "Marca", "valor": "..."},
    {"chave": "Modelo", "valor": "..."},
    {"chave": "Material", "valor": "..."},
    {"chave": "Peso", "valor": "..."},
    {"chave": "Dimensões", "valor": "..."},
    {"chave": "Cor", "valor": "..."}
  ]
}

Regras:
- preco e preco_original devem ser números decimais (ex: 38.05), não strings
- Se não encontrar preco_original, retorne null
- Extraia TODAS as especificações técnicas disponíveis (marca, modelo, material, dimensões, peso, cor, voltagem, capacidade, etc.)
- Não invente dados. Se não existir, omita
- A descrição deve ser técnica e objetiva

Conteúdo da página:
${markdown.substring(0, 6000)}`;

        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: aiPrompt }],
            temperature: 0.1,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData?.choices?.[0]?.message?.content || "";
          
          // Parse JSON from AI response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.titulo) titulo = parsed.titulo;
            if (parsed.descricao_resumida) descricaoResumida = parsed.descricao_resumida;
            if (parsed.preco && typeof parsed.preco === 'number') precoAI = parsed.preco;
            if (parsed.preco_original && typeof parsed.preco_original === 'number') precoOriginalAI = parsed.preco_original;
            if (Array.isArray(parsed.especificacoes)) {
              specs = parsed.especificacoes.filter((s: any) => s.chave && s.valor);
            }
          }
        }
      } catch (aiErr) {
        console.error("AI extraction error:", aiErr);
      }
    }

    // ─── FALLBACK: Regex-based extraction if AI failed ───
    if (specs.length === 0) {
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
            if (/^-+$/.test(val) || /^#+/.test(key)) continue;
            specs.push({ chave: key, valor: val });
          }
        }
      }
    }

    // Fallback title
    if (!titulo) {
      titulo = metadata?.title || markdown.split("\n")[0]?.replace(/^#+\s*/, "") || produto_nome || "";
    }

    // Fallback price
    if (!precoAI) {
      const priceMatches = markdown.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi);
      const prices: number[] = [];
      for (const m of priceMatches) {
        const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(val) && val > 1 && val < 500000) prices.push(val);
      }
      if (prices.length > 0) precoAI = prices[0];
      if (prices.length > 1 && prices[1] > prices[0]) precoOriginalAI = prices[1];
    }

    // Fallback description
    if (!descricaoResumida) {
      descricaoResumida = markdown.substring(0, 1500);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: titulo.substring(0, 300),
          imagens: images.slice(0, 15),
          especificacoes: specs.slice(0, 50),
          preco: precoAI,
          preco_original: precoOriginalAI,
          descricao_resumida: descricaoResumida.substring(0, 2000),
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
