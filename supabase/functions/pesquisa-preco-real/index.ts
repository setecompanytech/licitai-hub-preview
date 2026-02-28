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
  parcelas?: string;
  avaliacao?: number;
  vendedor_qualificado?: boolean;
};

/* ─── Known brands for extraction ─── */
const KNOWN_BRANDS = [
  'Dell', 'HP', 'Lenovo', 'Samsung', 'Apple', 'LG', 'Sony', 'Asus', 'Acer',
  'Philips', 'Panasonic', 'Motorola', 'Xiaomi', 'Intel', 'AMD', 'Corsair',
  'Logitech', 'Microsoft', 'Epson', 'Canon', 'Brother', 'Multilaser', 'Positivo',
  'Intelbras', 'Electrolux', 'Brastemp', 'Consul', 'Fischer', 'Cadence',
  'Mondial', 'Britânia', 'Tramontina', 'Vonder', 'Makita', 'Bosch', 'DeWalt',
  'Suvinil', 'Coral', 'Sherwin-Williams', 'Tigre', 'Amanco', 'Quartzolit',
  'Kingston', 'HyperX', 'Redragon', 'JBL', 'Edifier', 'TP-Link', 'Nvidia',
  'Gigabyte', 'MSI', 'Razer', 'SteelSeries', 'AOC', 'BenQ', 'ViewSonic',
  'Fujioka', 'Ibyte', 'Mirão',
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
  if (u.includes('ibyte.com.br')) return 'Ibyte';
  if (u.includes('fujioka.com.br')) return 'Fujioka';
  if (u.includes('havan.com.br')) return 'Havan';
  if (u.includes('google.com')) return 'Google Shopping';
  if (u.includes('buscape.com.br')) return 'Buscapé';
  if (u.includes('zoom.com.br')) return 'Zoom';
  if (u.includes('pontofrio.com.br')) return 'Ponto Frio';
  if (u.includes('extra.com.br')) return 'Extra';
  if (u.includes('girafa.com.br')) return 'Girafa';
  if (u.includes('chipart.com.br')) return 'Chipart';
  return 'Outros';
}

/** Extract price from text/markdown content */
function extractPrices(text: string): number[] {
  const prices: number[] = [];
  // Match R$ X.XXX,XX or R$ X,XX patterns
  const matches = text.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi);
  for (const m of matches) {
    const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(val) && val > 1 && val < 500000) prices.push(val);
  }
  return prices;
}

/** Extract image URL from markdown content */
function extractImage(markdown: string): string | undefined {
  // Look for image markdown patterns
  const imgMatch = markdown.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+(?:\.jpg|\.png|\.webp|\.jpeg)[^\s)]*)\)/i)
    || markdown.match(/(https?:\/\/(?:http2\.mlstatic\.com|m\.media-amazon\.com|[^"\s]+magazineluiza|[^"\s]+kabum)[^\s"'<>]+)/i);
  return imgMatch ? imgMatch[1] : undefined;
}

/** Parse a Firecrawl search result into product entries */
function parseSearchResult(result: any): ProdutoExtraido | null {
  const url = result.url || '';
  const title = result.title || '';
  const description = result.description || '';
  const markdown = result.markdown || '';
  const fullText = `${title} ${description} ${markdown}`;

  if (!title || title.length < 5) return null;

  // Extract price
  const prices = extractPrices(fullText);
  if (prices.length === 0) return null;
  
  // Use the first (usually main) price
  const preco = prices[0];
  const precoOriginal = prices.length > 1 && prices[1] > preco ? prices[1] : undefined;

  const loja = detectStore(url);
  
  // Check for free shipping
  const freteGratis = /frete\s*gr[aá]tis|entrega\s*gr[aá]tis|free.shipping|sem\s*custo\s*de\s*envio/i.test(fullText);
  
  // Check for condition
  let condicao = 'Novo';
  if (/usado|segunda\s*mão|second.hand/i.test(fullText)) condicao = 'Usado';
  if (/recondicionado|refurbished|seminovo/i.test(fullText)) condicao = 'Recondicionado';

  // Rating
  const ratingMatch = fullText.match(/(\d[.,]\d)\s*(?:de\s*5|estrelas|avalia)/i);
  const avaliacao = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

  // Parcelas
  const parcelasMatch = fullText.match(/(\d{1,2}x\s*(?:de\s*)?R\$\s*[0-9.,]+(?:\s*sem\s*juros)?)/i);

  // Image
  const image_url = extractImage(markdown);

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

    // Run multiple targeted searches in parallel for different marketplaces
    const searches = await Promise.allSettled([
      searchProducts(apiKey, `${termo} comprar preço site:mercadolivre.com.br`, 8),
      searchProducts(apiKey, `${termo} comprar preço site:amazon.com.br`, 6),
      searchProducts(apiKey, `${termo} comprar preço site:magazineluiza.com.br OR site:kabum.com.br`, 6),
      searchProducts(apiKey, `${termo} preço comprar Brasil`, 10),
    ]);

    const allFornecedores: ProdutoExtraido[] = [];
    const seenUrls = new Set<string>();
    const fonteCount: Record<string, number> = {};

    for (const result of searches) {
      if (result.status !== 'fulfilled') continue;
      for (const item of result.value) {
        // Deduplicate by URL
        const url = (item.url || '').split('?')[0];
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        const produto = parseSearchResult(item);
        if (produto) {
          allFornecedores.push(produto);
          fonteCount[produto.loja] = (fonteCount[produto.loja] || 0) + 1;
        }
      }
    }

    // Sort by price
    allFornecedores.sort((a, b) => a.preco - b.preco);

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
