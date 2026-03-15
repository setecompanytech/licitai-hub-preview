import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProdutoExtraido = {
  loja: string;
  produto: string;
  marca: string;
  modelo: string;
  categoria: string;
  preco: number;
  preco_original?: number;
  condicao: string;
  frete: string;
  url: string;
  image_url?: string;
  images?: string[];
  parcelas?: string;
  avaliacao?: number;
  vendedor_qualificado?: boolean;
};

/* ─── Known brands ─── */
const KNOWN_BRANDS = [
  'Dell', 'HP', 'Lenovo', 'Samsung', 'Apple', 'LG', 'Sony', 'Asus', 'Acer',
  'Philips', 'Panasonic', 'Motorola', 'Xiaomi', 'Intel', 'AMD', 'Corsair',
  'Logitech', 'Microsoft', 'Epson', 'Canon', 'Brother', 'Multilaser', 'Positivo',
  'Intelbras', 'Electrolux', 'Brastemp', 'Consul', 'Fischer', 'Cadence',
  'Mondial', 'Britânia', 'Tramontina', 'Vonder', 'Makita', 'Bosch', 'DeWalt',
  'Suvinil', 'Coral', 'Sherwin-Williams', 'Tigre', 'Amanco', 'Quartzolit',
  'Kingston', 'HyperX', 'Redragon', 'JBL', 'Edifier', 'TP-Link', 'Nvidia',
  'Gigabyte', 'MSI', 'Razer', 'SteelSeries', 'AOC', 'BenQ', 'ViewSonic',
  'Chamex', 'Report', 'Suzano', 'International Paper', 'Navigator', 'Copimax',
  '3M', 'Faber-Castell', 'BIC', 'Pilot', 'Staedtler', 'Pentel',
  'Caterpillar', 'John Deere', 'Komatsu', 'Volvo', 'Scania',
  'Havaianas', 'Alpargatas', 'Grendene', 'Nike', 'Adidas', 'Puma',
];

function extractBrand(title: string): string {
  const upper = title.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand.toUpperCase())) return brand;
  }
  const first = title.split(/\s+/)[0];
  if (first && /^[A-Z][a-z]+$/.test(first) && first.length > 2) return first;
  return '';
}

function extractModel(title: string): string {
  const modelMatch = title.match(/([A-Z]{1,4}[-\s]?\d{3,}[A-Z]?\w*)/i)
    || title.match(/(\d{3,}[A-Z]?\w*)/i);
  return modelMatch ? modelMatch[1] : '';
}

/** Detects which store a URL belongs to */
function detectStore(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('mlstatic') || u.includes('produto.mercadolivre')) return 'Mercado Livre';
  if (u.includes('amazon.com.br')) return 'Amazon';
  if (u.includes('magazineluiza') || u.includes('magalu')) return 'Magazine Luiza';
  if (u.includes('kabum.com.br')) return 'KaBuM';
  if (u.includes('americanas.com.br')) return 'Americanas';
  if (u.includes('casasbahia.com.br')) return 'Casas Bahia';
  if (u.includes('submarino.com.br')) return 'Submarino';
  if (u.includes('carrefour.com.br')) return 'Carrefour';
  if (u.includes('shopee.com.br')) return 'Shopee';
  if (u.includes('aliexpress.com')) return 'AliExpress';
  if (u.includes('pichau.com.br')) return 'Pichau';
  if (u.includes('terabyteshop.com.br')) return 'Terabyte';
  if (u.includes('havan.com.br')) return 'Havan';
  if (u.includes('gazinatacado.com.br')) return 'Gazin Atacado';
  if (u.includes('webcontinental.com.br')) return 'Webcontinental';
  if (u.includes('pontofrio.com.br')) return 'Ponto Frio';
  if (u.includes('rakaymed.com.br')) return 'Rakay Med';
  if (u.includes('hospitalardistribuidora.com.br')) return 'Hospitalar Distribuidora';
  if (u.includes('google.com/shopping') || u.includes('google.com.br/shopping')) return 'Google Shopping';
  if (u.includes('buscape.com.br')) return 'Buscapé';
  if (u.includes('zoom.com.br')) return 'Zoom';
  if (u.includes('leroymerlin.com.br')) return 'Leroy Merlin';
  if (u.includes('madeiramadeira.com.br')) return 'MadeiraMadeira';
  if (u.includes('fastshop.com.br')) return 'Fast Shop';
  if (u.includes('mirao.com.br')) return 'Mirão Atacado';
  if (u.includes('kalunga.com.br')) return 'Kalunga';
  if (u.includes('staples.com.br')) return 'Staples';
  if (u.includes('extra.com.br')) return 'Extra';
  if (u.includes('colombo.com.br')) return 'Colombo';
  if (u.includes('centauro.com.br')) return 'Centauro';
  return 'Outros';
}

/** Check if URL is a search/listing page rather than a product detail */
function isSearchOrListingPage(url: string): boolean {
  return /\/busca\/|\/search|\/lista\/|\/list\/|catalogsearch|\?s?k=|[?&]q=|[?&]search=|[?&]str=|\/(?:categoria|departamento)\//i.test(url);
}

/** Check if URL is likely a product detail page */
function isLikelyProductPage(url: string, loja: string): boolean {
  const u = url.toLowerCase();

  if (loja === 'Amazon') return /\/dp\/[a-z0-9]{8,}/i.test(url) || /\/gp\/product\//i.test(url);
  if (loja === 'Mercado Livre') {
    // ML uses many URL patterns: /MLB-XXXX, /p/MLBXXXX, /produto/..., etc.
    return /mlb[-\/]?\d{6,}/i.test(url) || /\/p\/mlb\d+/i.test(url) || /produto\.mercadolivre/i.test(url);
  }
  if (loja === 'Magazine Luiza') return /\/p\//i.test(u) && !u.includes('/busca/');
  if (loja === 'KaBuM' || loja === 'Terabyte' || loja === 'Pichau') return /\/produto\//i.test(u);
  if (loja === 'Shopee') return /-i\.\d+\.\d+/i.test(url);
  if (loja === 'Casas Bahia' || loja === 'Americanas' || loja === 'Submarino') return /\/produto\//i.test(u) || /\/p\//i.test(u) || /\/\d{6,}\//i.test(u);
  if (loja === 'Buscapé' || loja === 'Zoom') return true; // aggregators always show product info
  if (loja === 'Google Shopping') return true;

  // For other stores, accept if it's not a search page
  return !isSearchOrListingPage(url);
}

/**
 * INTELLIGENT PRICE EXTRACTION
 */
function extractMainProductPrice(title: string, fullText: string): { preco: number; precoOriginal?: number } | null {
  const prices: { value: number; context: string; lineIdx: number }[] = [];
  const lines = fullText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi);
    for (const m of matches) {
      const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(val) && val > 1 && val < 500000) {
        prices.push({ value: val, context: line, lineIdx: i });
      }
    }
  }

  if (prices.length === 0) return null;

  const ACCESSORY_KEYWORDS = /seguro|proteç[aã]o|garantia\s*estendida|capa\s*protetora|película|case\s*para|acessório|carregador\s*para|fone\s*para|suporte\s*para|adaptador\s*para|cabo\s*para|mouse\s*pad|kit\s*de\s*limp/i;

  const mainPrices = prices.filter(p => {
    const contextWindow = lines.slice(Math.max(0, p.lineIdx - 2), Math.min(lines.length, p.lineIdx + 3)).join(' ');
    if (ACCESSORY_KEYWORDS.test(contextWindow)) return false;
    return true;
  });

  const validPrices = mainPrices.length > 0 ? mainPrices : prices;
  const sortedValues = validPrices.map(p => p.value).sort((a, b) => a - b);

  if (sortedValues.length === 1) return { preco: sortedValues[0] };

  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  const reasonablePrices = sortedValues.filter(p => p >= median * 0.15);

  if (reasonablePrices.length === 0) return { preco: sortedValues[0] };

  const firstReasonable = validPrices.find(p => reasonablePrices.includes(p.value));
  const preco = firstReasonable?.value || reasonablePrices[0];
  const precoOriginal = sortedValues.find(p => p > preco * 1.05) || undefined;

  return { preco, precoOriginal };
}

/** Score image quality/relevance */
function scoreImageCandidate(url: string): number {
  const u = url.toLowerCase();
  let score = 0;

  if (/m\.media-amazon\.com\/images\/i\//i.test(u)) score += 4;
  if (/http2\.mlstatic\.com\/d_/i.test(u)) score += 4;
  if (/images\.kabum\.com\.br/i.test(u)) score += 3;
  if (/\/produto\//i.test(u)) score += 3;
  if (/_ac_|_sx|_sy|_sl/i.test(u)) score += 2;
  if (/cf\.shopee/i.test(u)) score += 3;
  if (/magazineluiza|magalu/i.test(u)) score += 3;
  if (/americanas|b2w/i.test(u)) score += 3;
  if (/casasbahia/i.test(u)) score += 3;

  if (/thumb|thumbnail/i.test(u)) score -= 1; // thumbs may still be ok
  if (/og[_\-.]|social[-_]?share/i.test(u)) score -= 5;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\//i.test(u)) score -= 5;
  if (/\/rating\/|\/stars\//i.test(u)) score -= 4;
  if (/logo|icon|sprite|banner|favicon|badge|selo|stamp|watermark/i.test(u)) score -= 6;

  return score;
}

/** Check if URL looks like a real product image */
function isProductImage(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();

  if (/logo|icon|sprite|banner|favicon|avatar|badge|selo|stamp|watermark/i.test(lower)) return false;
  if (/1x1|pixel|tracking|analytics/i.test(lower)) return false;
  if (/ad[s]?[_\-\/]|doubleclick|googlesyndication|adsense|adserver|pubmatic|criteo|taboola|outbrain/i.test(lower)) return false;
  if (/promo|campanha|anuncio|slide.*banner|hero[-_]?banner|og[_\-.]|social[-_]?share/i.test(lower)) return false;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\/|\/rating\/|\/stars\//i.test(lower)) return false;
  if (/vlibras|access_popup|shopee-pcmall-live-sg|kalunga\.jpg|og_tb\.png/i.test(lower)) return false;
  if (/_S_\d{2,3}\.\w+$/i.test(lower)) return false;
  if (/_AC_US\d{1,3}_/i.test(lower)) return false;

  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(lower);
}

/** Extract all product image URLs from search result */
function extractImages(result: any): string[] {
  const markdown = result.markdown || '';
  const candidates: { url: string; score: number }[] = [];
  const seen = new Set<string>();

  function addImg(url: string) {
    if (!url || seen.has(url) || !isProductImage(url)) return;
    seen.add(url);
    candidates.push({ url, score: scoreImageCandidate(url) });
  }

  // 1. ML static images
  const mlMatches = [...markdown.matchAll(/(https?:\/\/http2\.mlstatic\.com\/D_[^\s"')]+\.(?:jpg|webp|png))/gi)];
  for (const m of mlMatches) addImg(m[1]);

  // 2. Amazon images
  const amzMatches = [...markdown.matchAll(/(https?:\/\/m\.media-amazon\.com\/images\/I\/[^\s"')]+\.(?:jpg|webp|png))/gi)];
  for (const m of amzMatches) addImg(m[1]);

  // 3. Kabum images
  const kabumMatches = [...markdown.matchAll(/(https?:\/\/images\.kabum\.com\.br\/[^\s"')]+\.(?:jpg|webp|png))/gi)];
  for (const m of kabumMatches) addImg(m[1]);

  // 4. Magazine Luiza images
  const magaluMatches = [...markdown.matchAll(/(https?:\/\/[^\s"')]*(?:magazineluiza|magalu)[^\s"')]*\.(?:jpg|webp|png))/gi)];
  for (const m of magaluMatches) addImg(m[1]);

  // 5. Shopee images
  const shopeeMatches = [...markdown.matchAll(/(https?:\/\/cf\.shopee\.[^\s"')]+\.(?:jpg|webp|png))/gi)];
  for (const m of shopeeMatches) addImg(m[1]);

  // 6. Markdown images ![alt](url)
  const mdImgMatches = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi)];
  for (const m of mdImgMatches) addImg(m[1]);

  // 7. Raw image URLs
  const rawMatches = [...markdown.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))(?:\?[^\s"'<>]*)?/gi)];
  for (const m of rawMatches) addImg(m[1]);

  // 8. OG image as fallback
  const ogImage = result.metadata?.ogImage || result.metadata?.['og:image'];
  if (ogImage) addImg(ogImage);

  return candidates
    .sort((a, b) => b.score - a.score)
    .map(c => c.url)
    .slice(0, 8);
}

/**
 * Validates that the title is for a real product, not an accessory/insurance/listing page
 */
function isMainProduct(title: string, searchTerm: string, url: string, loja: string): boolean {
  const titleLower = title.toLowerCase();

  // For aggregators (Buscapé, Zoom, Google Shopping), be more permissive
  if (['Buscapé', 'Zoom', 'Google Shopping'].includes(loja)) {
    // Just check basic relevance
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (searchWords.length > 0) {
      const matchCount = searchWords.filter(w => titleLower.includes(w)).length;
      return matchCount > 0;
    }
    return true;
  }

  // For major marketplaces, accept detail pages and also well-structured search results
  if (!isLikelyProductPage(url, loja)) {
    // Only reject if it's clearly a search/listing page with no product info
    if (isSearchOrListingPage(url)) return false;
  }

  // Skip items that are clearly accessories/insurance
  const SKIP_PATTERNS = [
    /^seguro\s/i, /^proteç[aã]o\s/i, /^garantia\s*estendida/i,
    /^capa\s*(para|de|do|da)\s/i, /^película\s/i, /^case\s*(para|de|do|da)\s/i,
    /^suporte\s*(para|de|do|da)\s/i, /^kit\s*de\s*limpeza/i,
    /^adaptador\s*(para|de|do|da)\s/i, /^cabo\s*(para|de|do|da)\s/i,
    /^carregador\s*(para|de|do|da)\s/i, /^mouse\s*pad/i,
    /^skin\s*(para|de|do|da)\s/i, /^adesivo\s*(para|de|do|da)\s/i,
  ];

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(titleLower)) return false;
  }

  // Skip generic listing titles
  if (/em promoç[aã]o|com menor preço|na amazon\.com\.br|mercado livre|\| shopee|resultado de busca|categoria/i.test(titleLower)) {
    return false;
  }

  // Skip generic category pages
  if (/^(eletrodomésticos|eletrônicos|informática|móveis|utilidades)\s*(no\s*atacado|em\s*oferta)/i.test(titleLower)) {
    return false;
  }
  if (/^(gazin\s*atacado|inicio|home)\s*[:|\-]?\s*$/i.test(titleLower.replace(/\s+/g, ' ').trim())) {
    return false;
  }

  // Relevance check: at least one significant word from search should appear in title
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length > 0) {
    const matchCount = searchWords.filter(w => titleLower.includes(w)).length;
    // More lenient: require at least 1 match for short queries, 40% for longer
    const threshold = searchWords.length <= 3 ? 1 : Math.ceil(searchWords.length * 0.4);
    if (matchCount < threshold) return false;
  }

  return true;
}

/** Parse a Firecrawl search result into product entries */
function parseSearchResult(result: any, searchTerm: string): ProdutoExtraido | null {
  const url = result.url || '';
  const title = result.title || '';
  const description = result.description || '';
  const markdown = result.markdown || '';
  const fullText = `${title}\n${description}\n${markdown}`;

  if (!title || title.length < 5) return null;

  const loja = detectStore(url);

  if (!isMainProduct(title, searchTerm, url, loja)) {
    return null;
  }

  const priceResult = extractMainProductPrice(title, fullText);
  if (!priceResult) return null;

  const { preco, precoOriginal } = priceResult;

  const freteGratis = /frete\s*gr[aá]tis|entrega\s*gr[aá]tis|free.shipping|sem\s*custo\s*de\s*envio/i.test(fullText);

  let condicao = 'Novo';
  if (/usado|segunda\s*mão|second.hand/i.test(fullText)) condicao = 'Usado';
  if (/recondicionado|refurbished|seminovo/i.test(fullText)) condicao = 'Recondicionado';

  const ratingMatch = fullText.match(/(\d[.,]\d)\s*(?:de\s*5|estrelas|avalia)/i);
  const avaliacao = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

  const parcelasMatch = fullText.match(/(\d{1,2}x\s*(?:de\s*)?R\$\s*[0-9.,]+(?:\s*sem\s*juros)?)/i);

  const allImages = extractImages(result);
  const image_url = allImages.length > 0 ? allImages[0] : undefined;

  const vendedorQualificado = /mercadol[ií]der|loja.oficial|vendedor.destaque|prime|full/i.test(fullText);

  return {
    loja,
    produto: title.substring(0, 200),
    marca: extractBrand(title),
    modelo: extractModel(title),
    categoria: 'Marketplace',
    preco,
    preco_original: precoOriginal,
    condicao,
    frete: freteGratis ? 'Frete grátis' : 'Consultar',
    url,
    image_url,
    images: allImages.length > 1 ? allImages : undefined,
    parcelas: parcelasMatch ? parcelasMatch[1] : undefined,
    avaliacao,
    vendedor_qualificado: vendedorQualificado,
  };
}

/** Run a Firecrawl search query */
async function searchProducts(apiKey: string, query: string, limit = 15): Promise<any[]> {
  try {
    console.log(`Searching: "${query}" (limit ${limit})`);
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        lang: "pt-BR",
        country: "BR",
        scrapeOptions: { formats: ["markdown", "links"] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Search error: HTTP ${response.status} - ${errText.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    return data?.data || [];
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

/** Scrape a single product page for richer data (images + details) */
async function scrapeProductPage(apiKey: string, url: string): Promise<any | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.data || data || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    console.log(`Pesquisa real para: "${termo}"`);

    // ─── STRATEGY: Multiple targeted searches with higher limits ───
    // Use product-focused queries and broader searches
    const termoEncoded = termo.replace(/\s+/g, '+');

    const searches = await Promise.allSettled([
      // Primary: Mercado Livre (largest BR marketplace) — multiple queries
      searchProducts(apiKey, `"${termo}" site:mercadolivre.com.br`, 20),
      searchProducts(apiKey, `${termo} preço site:produto.mercadolivre.com.br`, 15),
      // Amazon BR
      searchProducts(apiKey, `"${termo}" comprar site:amazon.com.br`, 15),
      // Major retail
      searchProducts(apiKey, `"${termo}" site:magazineluiza.com.br OR site:kabum.com.br OR site:americanas.com.br`, 15),
      searchProducts(apiKey, `"${termo}" site:casasbahia.com.br OR site:carrefour.com.br OR site:shopee.com.br`, 12),
      // Atacado / specialty
      searchProducts(apiKey, `"${termo}" site:gazinatacado.com.br OR site:mirao.com.br OR site:kalunga.com.br`, 10),
      // Price comparators (Buscapé, Zoom) — great for aggregated prices
      searchProducts(apiKey, `${termo} site:buscape.com.br OR site:zoom.com.br`, 12),
      // Webcontinental, Leroy, MadeiraMadeira, Fast Shop
      searchProducts(apiKey, `"${termo}" site:webcontinental.com.br OR site:leroymerlin.com.br OR site:madeiramadeira.com.br OR site:fastshop.com.br`, 10),
      // Havan, Colombo
      searchProducts(apiKey, `"${termo}" site:havan.com.br OR site:colombo.com.br OR site:extra.com.br`, 10),
      // Medical/special
      searchProducts(apiKey, `${termo} site:rakaymed.com.br OR site:hospitalardistribuidora.com.br`, 8),
      // Generic broad search to catch other stores
      searchProducts(apiKey, `"${termo}" comprar preço loja online Brasil`, 20),
      searchProducts(apiKey, `${termo} preço atacado distribuidor Brasil`, 15),
    ]);

    const allFornecedores: ProdutoExtraido[] = [];
    const seenUrls = new Set<string>();
    const fonteCount: Record<string, number> = {};

    for (const result of searches) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        const url = (item.url || '').split('?')[0].split('#')[0];
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        const produto = parseSearchResult(item, termo);
        if (produto) {
          allFornecedores.push(produto);
          fonteCount[produto.loja] = (fonteCount[produto.loja] || 0) + 1;
        }
      }
    }

    // ─── ENRICHMENT: For top results without images, scrape the product page ───
    const itemsWithoutImages = allFornecedores.filter(f => !f.image_url && f.url?.startsWith('https://'));
    const scrapePromises = itemsWithoutImages.slice(0, 8).map(async (item) => {
      try {
        const scraped = await scrapeProductPage(apiKey, item.url);
        if (scraped) {
          const images = extractImages(scraped);
          if (images.length > 0) {
            item.image_url = images[0];
            item.images = images.length > 1 ? images : undefined;
          }
        }
      } catch { /* ignore */ }
    });

    await Promise.allSettled(scrapePromises);

    // Sort by price
    allFornecedores.sort((a, b) => a.preco - b.preco);

    // POST-PROCESSING: Remove statistical outliers
    if (allFornecedores.length >= 3) {
      const medianIdx = Math.floor(allFornecedores.length / 2);
      const median = allFornecedores[medianIdx].preco;
      const threshold = median * 0.10;
      const filtered = allFornecedores.filter(f => f.preco >= threshold);
      if (filtered.length >= 3) {
        allFornecedores.length = 0;
        allFornecedores.push(...filtered);
      }
    }

    console.log(`Total: ${allFornecedores.length} produtos de ${Object.keys(fonteCount).length} fontes`);
    console.log("Fontes:", JSON.stringify(fonteCount));

    // Build summary
    const precos = allFornecedores.map(f => f.preco);
    const menorPreco = precos.length > 0 ? Math.min(...precos) : 0;
    const maiorPreco = precos.length > 0 ? Math.max(...precos) : 0;
    const precoMedio = precos.length > 0 ? precos.reduce((a, b) => a + b, 0) / precos.length : 0;
    const fornecedorMenor = allFornecedores.find(f => f.preco === menorPreco);
    const fornecedorMaior = allFornecedores.find(f => f.preco === maiorPreco);
    const variacao = menorPreco > 0 ? `${(((maiorPreco - menorPreco) / menorPreco) * 100).toFixed(1)}%` : '0%';

    const response = {
      success: true,
      data: {
        produto: termo,
        data_pesquisa: new Date().toLocaleDateString('pt-BR'),
        categoria: 'Pesquisa de Mercado',
        fornecedores: allFornecedores,
        resumo: {
          menor_preco: menorPreco,
          maior_preco: maiorPreco,
          preco_medio: Math.round(precoMedio * 100) / 100,
          variacao,
          fornecedor_menor: fornecedorMenor ? `${fornecedorMenor.loja}` : '',
          fornecedor_maior: fornecedorMaior ? `${fornecedorMaior.loja}` : '',
          recomendacao: allFornecedores.length > 0
            ? `Pesquisa em ${Object.keys(fonteCount).length} fontes com ${allFornecedores.length} resultados válidos. Menor preço: R$ ${menorPreco.toFixed(2)} (${fornecedorMenor?.loja}).`
            : 'Nenhum resultado encontrado.',
        },
        fontes_consultadas: fonteCount,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro pesquisa-preco-real:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
