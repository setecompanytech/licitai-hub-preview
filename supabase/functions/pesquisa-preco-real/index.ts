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
  if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('mlstatic')) return 'Mercado Livre';
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
  if (u.includes('google.com')) return 'Google Shopping';
  if (u.includes('buscape.com.br')) return 'Buscapé';
  if (u.includes('zoom.com.br')) return 'Zoom';
  if (u.includes('leroymerlin.com.br')) return 'Leroy Merlin';
  if (u.includes('madeiramadeira.com.br')) return 'MadeiraMadeira';
  if (u.includes('fastshop.com.br')) return 'Fast Shop';
  return 'Outros';
}

function isSearchOrListingPage(url: string): boolean {
  const u = url.toLowerCase();
  return /\/busca\/|\/search|\/lista\/|\/list\/|catalogsearch|\?s?k=|[?&]q=|[?&]search=|[?&]str=|\/(?:categoria|departamento|monitores|notebooks|celulares)\//i.test(u);
}

function isLikelyProductDetailPage(url: string, loja: string): boolean {
  const u = url.toLowerCase();

  if (loja === 'Amazon') return /\/dp\/[a-z0-9]{8,}/i.test(url) || /\/gp\/product\//i.test(url);
  if (loja === 'Mercado Livre') return /\/mlb[-/]?\d+/i.test(url) || /\/p\/mlb\d+/i.test(url);
  if (loja === 'Magazine Luiza') return /\/p\//i.test(u) && !u.includes('/busca/');
  if (loja === 'KaBuM' || loja === 'Terabyte' || loja === 'Pichau') return /\/produto\//i.test(u);
  if (loja === 'Shopee') return /-i\.\d+\.\d+/i.test(url);
  if (loja === 'Gazin Atacado') return u.includes('gazinatacado.com.br');

  return !isSearchOrListingPage(url);
}

function storeRequiresDetailPage(loja: string): boolean {
  return [
    'Amazon', 'Mercado Livre', 'Magazine Luiza', 'KaBuM', 'Terabyte', 'Pichau', 'Shopee', 'Gazin Atacado',
    'Americanas', 'Casas Bahia', 'Carrefour', 'Havan', 'Fast Shop', 'Leroy Merlin', 'MadeiraMadeira',
    'Webcontinental', 'Ponto Frio', 'Rakay Med'
  ].includes(loja);
}

/**
 * INTELLIGENT PRICE EXTRACTION
 * Filters out accessory/insurance/case prices by:
 * 1. Only using prices that appear near the product title context
 * 2. Excluding prices from lines mentioning insurance/case/protection/accessory
 * 3. Using the MOST PROMINENT price (usually the first large one)
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

  // Keywords that indicate the price is NOT for the main product
  const ACCESSORY_KEYWORDS = /seguro|proteç[aã]o|garantia\s*estendida|capa\s*protetora|película|case\s*para|acessório|carregador\s*para|fone\s*para|suporte\s*para|adaptador\s*para|cabo\s*para|mouse\s*pad|kit\s*de\s*limp/i;

  // Keywords that indicate this IS the product price
  const PRODUCT_PRICE_KEYWORDS = /à\s*vista|no\s*pix|preço|comprar|adicionar|carrinho|por\s*R\$|de\s*R\$/i;

  // Filter out prices from accessory/insurance contexts
  const mainPrices = prices.filter(p => {
    // Check surrounding lines too (2 lines before and after)
    const contextWindow = lines.slice(Math.max(0, p.lineIdx - 2), Math.min(lines.length, p.lineIdx + 3)).join(' ');
    if (ACCESSORY_KEYWORDS.test(contextWindow)) return false;
    return true;
  });

  // If all were filtered, use originals but with caution
  const validPrices = mainPrices.length > 0 ? mainPrices : prices;

  // Estimate a reasonable price range based on the product title
  // Use median-based approach: cluster prices and pick the main cluster
  const sortedValues = validPrices.map(p => p.value).sort((a, b) => a - b);

  if (sortedValues.length === 1) {
    return { preco: sortedValues[0] };
  }

  // Use statistical filtering: remove extreme outliers
  // If the cheapest price is < 10% of the most expensive, it's likely an accessory
  const median = sortedValues[Math.floor(sortedValues.length / 2)];

  // Main price is the one closest to the first prominent price that's
  // within a reasonable range (not an accessory price)
  // Rule: if a price is less than 15% of the median, it's an accessory/addon
  const reasonablePrices = sortedValues.filter(p => p >= median * 0.15);

  if (reasonablePrices.length === 0) {
    return { preco: sortedValues[0] };
  }

  // Pick the first reasonable price (usually the main displayed price)
  const firstReasonable = validPrices.find(p => reasonablePrices.includes(p.value));
  const preco = firstReasonable?.value || reasonablePrices[0];

  // Find original price (crossed out / "de R$") - must be higher
  const precoOriginal = sortedValues.find(p => p > preco * 1.05) || undefined;

  return { preco, precoOriginal };
}

/** Score image quality/relevance to prioritize real product photos */
function scoreImageCandidate(url: string): number {
  const u = url.toLowerCase();
  let score = 0;

  if (/m\.media-amazon\.com\/images\/i\//i.test(u)) score += 4;
  if (/http2\.mlstatic\.com\/d_/i.test(u)) score += 4;
  if (/images\.kabum\.com\.br/i.test(u)) score += 3;
  if (/\/produto\//i.test(u)) score += 3;
  if (/_ac_|_sx|_sy|_sl/i.test(u)) score += 2;

  if (/thumb|thumbnail/i.test(u)) score -= 2;
  if (/og[_\-.]|social[-_]?share/i.test(u)) score -= 5;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\//i.test(u)) score -= 5;
  if (/\/rating\/|\/stars\//i.test(u)) score -= 4;

  return score;
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
  const magaluMatches = [...markdown.matchAll(/(https?:\/\/[^\s"')]*magazineluiza[^\s"')]*\.(?:jpg|webp|png))/gi)];
  for (const m of magaluMatches) addImg(m[1]);

  // 5. Markdown images
  const mdImgMatches = [...markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi)];
  for (const m of mdImgMatches) addImg(m[1]);

  // 6. Raw image URLs
  const rawMatches = [...markdown.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))(?:\?[^\s"'<>]*)?/gi)];
  for (const m of rawMatches) addImg(m[1]);

  // 7. OG image as fallback only
  const ogImage = result.metadata?.ogImage || result.metadata?.['og:image'];
  if (ogImage) addImg(ogImage);

  return candidates
    .sort((a, b) => b.score - a.score)
    .map(c => c.url)
    .slice(0, 6);
}

/** Extract single best image (backwards compat) */
function extractImage(result: any): string | undefined {
  const imgs = extractImages(result);
  return imgs.length > 0 ? imgs[0] : undefined;
}

/** Check if URL looks like a real product image (not logo/icon/banner) */
function isProductImage(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();

  // Reject non-product images (logos, icons, banners, ads, site assets)
  if (/logo|icon|sprite|banner|favicon|avatar|badge|selo|stamp|watermark/i.test(lower)) return false;
  if (/1x1|pixel|tracking|analytics/i.test(lower)) return false;
  if (/ad[s]?[_\-\/]|doubleclick|googlesyndication|adsense|adserver|pubmatic|criteo|taboola|outbrain/i.test(lower)) return false;
  if (/promo|campanha|anuncio|slide.*banner|hero[-_]?banner|og[_\-.]|social[-_]?share/i.test(lower)) return false;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\/|\/rating\/|\/stars\//i.test(lower)) return false;
  if (/vlibras|access_popup|shopee-pcmall-live-sg|kalunga\.jpg|og_tb\.png/i.test(lower)) return false;

  // Reject very small images / known placeholders
  if (/_S_\d{2,3}\.\w+$/i.test(lower)) return false;
  if (/_AC_US\d{1,3}_/i.test(lower)) return false;
  if (/\/D_NQ_NP_ID-MLB/i.test(lower)) return false;

  return /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(lower);
}

/**
 * Validates that the title is for a real product, not an accessory/insurance/listing page
 */
function isMainProduct(title: string, searchTerm: string, url: string, loja: string): boolean {
  const titleLower = title.toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  // Skip list/search/category pages (these usually return wrong images and prices)
  if (isSearchOrListingPage(url) && !isLikelyProductDetailPage(url, loja)) return false;

  // For major marketplaces, only accept detail product pages
  if (storeRequiresDetailPage(loja) && !isLikelyProductDetailPage(url, loja)) return false;

  // Skip items that are clearly accessories/insurance for the product
  const SKIP_PATTERNS = [
    /^seguro\s/i,
    /^proteç[aã]o\s/i,
    /^garantia\s*estendida/i,
    /^capa\s*(para|de|do|da)\s/i,
    /^película\s/i,
    /^case\s*(para|de|do|da)\s/i,
    /^suporte\s*(para|de|do|da)\s/i,
    /^kit\s*de\s*limpeza/i,
    /^adaptador\s*(para|de|do|da)\s/i,
    /^cabo\s*(para|de|do|da)\s/i,
    /^carregador\s*(para|de|do|da)\s/i,
    /^mouse\s*pad/i,
    /^skin\s*(para|de|do|da)\s/i,
    /^adesivo\s*(para|de|do|da)\s/i,
  ];

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(titleLower)) return false;
  }

  // Skip generic listing titles
  if (/em promoç[aã]o|com menor preço|na amazon\.com\.br|mercado livre|\| shopee|resultado de busca|categoria/i.test(titleLower)) {
    return false;
  }

  // Skip generic category pages (e.g. "Eletrodomésticos no atacado", "Freezer no atacado")
  if (/^(eletrodomésticos|eletrônicos|informática|móveis|utilidades)\s*(no\s*atacado|em\s*oferta)/i.test(titleLower)) {
    return false;
  }
  if (/^(gazin\s*atacado|inicio|home)\s*[:|\-]?\s*$/i.test(titleLower.replace(/\s+/g, ' ').trim())) {
    return false;
  }

  // At least one significant word from the search should appear in the title
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 3);
  if (searchWords.length > 0) {
    const matchCount = searchWords.filter(w => titleLower.includes(w)).length;
    if (matchCount === 0) return false;
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

  // Check if this is actually the main product (not accessory/listing page)
  if (!isMainProduct(title, searchTerm, url, loja)) {
    console.log(`Filtered out non-product/listing: "${title.substring(0, 80)}"`);
    return null;
  }

  // Use intelligent price extraction
  const priceResult = extractMainProductPrice(title, fullText);
  if (!priceResult) return null;

  const { preco, precoOriginal } = priceResult;

  // Check for free shipping
  const freteGratis = /frete\s*gr[aá]tis|entrega\s*gr[aá]tis|free.shipping|sem\s*custo\s*de\s*envio/i.test(fullText);

  // Condition
  let condicao = 'Novo';
  if (/usado|segunda\s*mão|second.hand/i.test(fullText)) condicao = 'Usado';
  if (/recondicionado|refurbished|seminovo/i.test(fullText)) condicao = 'Recondicionado';

  // Rating
  const ratingMatch = fullText.match(/(\d[.,]\d)\s*(?:de\s*5|estrelas|avalia)/i);
  const avaliacao = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

  // Parcelas
  const parcelasMatch = fullText.match(/(\d{1,2}x\s*(?:de\s*)?R\$\s*[0-9.,]+(?:\s*sem\s*juros)?)/i);

  // Images - use dedicated extractor
  const allImages = extractImages(result);
  const image_url = allImages.length > 0 ? allImages[0] : undefined;

  // Qualified seller
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
async function searchProducts(apiKey: string, query: string, limit = 10): Promise<any[]> {
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
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      console.error(`Search error: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data?.data || [];
  } catch (e) {
    console.error("Search error:", e);
    return [];
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

    // Run targeted searches
    const searches = await Promise.allSettled([
      searchProducts(apiKey, `${termo} comprar preço site:mercadolivre.com.br`, 12),
      searchProducts(apiKey, `${termo} comprar preço site:amazon.com.br`, 10),
      searchProducts(apiKey, `${termo} comprar preço site:magazineluiza.com.br OR site:kabum.com.br`, 10),
      searchProducts(apiKey, `${termo} comprar preço site:americanas.com.br OR site:casasbahia.com.br`, 8),
      searchProducts(apiKey, `${termo} comprar preço site:shopee.com.br OR site:carrefour.com.br`, 8),
      searchProducts(apiKey, `"${termo}" site:gazinatacado.com.br`, 8),
      searchProducts(apiKey, `${termo} comprar preço site:buscape.com.br OR site:zoom.com.br`, 8),
      searchProducts(apiKey, `${termo} comprar preço site:webcontinental.com.br OR site:pontofrio.com.br`, 8),
      searchProducts(apiKey, `${termo} site:rakaymed.com.br`, 8),
      searchProducts(apiKey, `${termo} preço comprar Brasil`, 12),
    ]);

    const allFornecedores: ProdutoExtraido[] = [];
    const seenUrls = new Set<string>();
    const fonteCount: Record<string, number> = {};

    for (const result of searches) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        const url = (item.url || '').split('?')[0];
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        // Pass search term for relevance checking
        const produto = parseSearchResult(item, termo);
        if (produto) {
          allFornecedores.push(produto);
          fonteCount[produto.loja] = (fonteCount[produto.loja] || 0) + 1;
        }
      }
    }

    // Sort by price
    allFornecedores.sort((a, b) => a.preco - b.preco);

    // POST-PROCESSING: Remove statistical outliers
    // If median is known, remove items priced < 10% of median (likely accessories that slipped through)
    if (allFornecedores.length >= 3) {
      const medianIdx = Math.floor(allFornecedores.length / 2);
      const median = allFornecedores[medianIdx].preco;
      const threshold = median * 0.10; // 10% of median
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
            ? `Pesquisa real em ${Object.keys(fonteCount).length} marketplaces com ${allFornecedores.length} resultados. Menor preço: R$ ${menorPreco.toFixed(2)} (${fornecedorMenor?.loja}).`
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
