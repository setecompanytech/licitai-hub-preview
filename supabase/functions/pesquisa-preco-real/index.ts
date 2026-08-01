import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

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
};

const KNOWN_BRANDS = [
  'Dell','HP','Lenovo','Samsung','Apple','LG','Sony','Asus','Acer',
  'Philips','Panasonic','Motorola','Xiaomi','Intel','AMD','Logitech',
  'Microsoft','Epson','Canon','Brother','Multilaser','Positivo','Intelbras',
  'Electrolux','Brastemp','Consul','Makita','Bosch','DeWalt','Kingston',
  'JBL','TP-Link','Nvidia','Gigabyte','MSI','AOC','BenQ','Chamex','Report',
  'Suzano','Navigator','3M','Faber-Castell','BIC','Pilot','Staedtler','Pentel',
  'Ypê','Bombril','Bettanin','Reckitt','Johnson','Kimberly-Clark',
  'Descarpack','Talge','Santher','Mili','Neve','Tramontina','Vonder',
];

function extractBrand(title: string): string {
  const upper = title.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    if (upper.includes(brand.toUpperCase())) return brand;
  }
  return '';
}

function extractModel(title: string): string {
  const m = title.match(/([A-Z]{1,4}[-\s]?\d{3,}[A-Z]?\w*)/i) || title.match(/(\d{3,}[A-Z]?\w*)/i);
  return m ? m[1] : '';
}

function detectStore(url: string): string {
  const u = url.toLowerCase();
  const map: [RegExp, string][] = [
    [/mercadoli[vb]re|mlstatic|produto\.mercadolivre/, 'Mercado Livre'],
    [/amazon\.com\.br/, 'Amazon'],
    [/magazineluiza|magalu/, 'Magazine Luiza'],
    [/kabum\.com\.br/, 'KaBuM'],
    [/americanas\.com\.br/, 'Americanas'],
    [/casasbahia\.com\.br/, 'Casas Bahia'],
    [/shopee\.com\.br/, 'Shopee'],
    [/kalunga\.com\.br/, 'Kalunga'],
    [/leroymerlin\.com\.br/, 'Leroy Merlin'],
    [/buscape\.com\.br/, 'Buscapé'],
    [/zoom\.com\.br/, 'Zoom'],
    [/submarino\.com\.br/, 'Submarino'],
    [/carrefour\.com\.br/, 'Carrefour'],
    [/extra\.com\.br/, 'Extra'],
    [/fastshop\.com\.br/, 'Fast Shop'],
    [/pichau\.com\.br/, 'Pichau'],
    [/havan\.com\.br/, 'Havan'],
    [/atacadao\.com\.br/, 'Atacadão'],
    [/staples\.com\.br/, 'Staples'],
    [/google\.com.*\/shopping/, 'Google Shopping'],
  ];
  for (const [re, name] of map) {
    if (re.test(u)) return name;
  }
  try { return new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return 'Outros'; }
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // "R$ 42,90" → 42.90 | "42.90" → 42.90 | "1.234,56" → 1234.56
  const cleaned = priceStr
    .replace(/R\$\s*/g, '')
    .replace(/\s/g, '')
    .trim();
  // Brazilian format: dots as thousands separator, comma as decimal
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(cleaned.replace(',', '.')) || 0;
}

// ── Serper.dev Google Shopping search ──────────────────────────────────────
async function serperSearch(apiKey: string, termo: string): Promise<ProdutoExtraido[]> {
  console.log(`[Serper] buscando: "${termo}"`);

  const res = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: termo,
      gl: 'br',
      hl: 'pt-br',
      num: 20,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[Serper] erro HTTP ${res.status}:`, err.slice(0, 300));
    return [];
  }

  const data = await res.json();
  const items: any[] = data.shopping || [];
  console.log(`[Serper] ${items.length} resultados`);

  const produtos: ProdutoExtraido[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const url = item.link || '';
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const preco = parsePrice(item.price || '');
    if (!preco || preco <= 0) continue;

    const loja = item.source || detectStore(url);
    const titulo = item.title || '';
    if (!titulo) continue;

    produtos.push({
      loja,
      produto: titulo.substring(0, 200),
      marca: extractBrand(titulo),
      modelo: extractModel(titulo),
      categoria: 'Marketplace',
      preco,
      condicao: 'Novo',
      frete: (item.delivery || '').toLowerCase().includes('grát') ? 'Frete grátis' : 'Consultar',
      url,
      image_url: item.imageUrl || undefined,
      avaliacao: item.rating ? parseFloat(item.rating) : undefined,
    });
  }

  console.log(`[Serper] ${produtos.length} produtos com preço válido`);
  return produtos;
}

// ── Firecrawl fallback (caso SERPER_API_KEY não esteja configurada) ─────────
function extractPriceFromText(text: string): number {
  const lines = text.split('\n');
  const prices: { value: number; score: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/gi)) {
      const val = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (isNaN(val) || val <= 0.5 || val >= 500000) continue;
      let score = 0;
      if (/preço|valor|comprar|pagar|oferta|à\s*vista|pix/i.test(line)) score += 5;
      if (i < 15) score += 3;
      if (/\d+x\s*(?:de\s*)?R\$/i.test(line)) score -= 8;
      if (/seguro|garantia\s*estend/i.test(line)) score -= 10;
      prices.push({ value: val, score });
    }
  }
  if (!prices.length) return 0;
  prices.sort((a, b) => b.score - a.score);
  return prices[0].value;
}

async function firecrawlSearch(apiKey: string, termo: string): Promise<ProdutoExtraido[]> {
  const queries = [
    `"${termo}" site:mercadolivre.com.br`,
    `"${termo}" site:shopee.com.br OR site:amazon.com.br`,
    `"${termo}" site:buscape.com.br OR site:zoom.com.br OR site:magazineluiza.com.br`,
  ];

  const resultados: ProdutoExtraido[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(queries.map(async (q) => {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 8, lang: 'pt-BR', country: 'BR', scrapeOptions: { formats: ['markdown'] } }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) { console.warn(`[Firecrawl] HTTP ${res.status} para "${q}"`); return; }
      const data = await res.json();
      for (const item of (data?.data || [])) {
        const url = (item.url || '').split('?')[0];
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const title = item.title || '';
        if (!title || title.length < 5) continue;
        const fullText = `${title}\n${item.description || ''}\n${item.markdown || ''}`;
        const preco = extractPriceFromText(fullText);
        if (!preco) continue;
        resultados.push({
          loja: detectStore(url),
          produto: title.substring(0, 200),
          marca: extractBrand(title),
          modelo: extractModel(title),
          categoria: 'Marketplace',
          preco,
          condicao: 'Novo',
          frete: /frete\s*gr[aá]tis/i.test(fullText) ? 'Frete grátis' : 'Consultar',
          url,
        });
      }
    } catch (e) { console.warn(`[Firecrawl] erro:`, e instanceof Error ? e.message : e); }
  }));

  return resultados;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req, { functionName: 'pesquisa-preco-real', maxRequests: 50, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { termo } = await req.json();
    if (!termo) {
      return new Response(JSON.stringify({ success: false, error: 'Termo obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const serperKey = Deno.env.get('SERPER_API_KEY');
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!serperKey && !firecrawlKey) {
      return new Response(JSON.stringify({ success: false, error: 'Nenhuma API de busca configurada. Adicione SERPER_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const start = Date.now();
    let fornecedores: ProdutoExtraido[] = [];

    if (serperKey) {
      fornecedores = await serperSearch(serperKey, termo);
    }

    // Fallback para Firecrawl se Serper não trouxe resultados
    if (fornecedores.length === 0 && firecrawlKey) {
      console.log('[Fallback] Tentando Firecrawl...');
      fornecedores = await firecrawlSearch(firecrawlKey, termo);
    }

    // Remove outliers (< 10% da mediana)
    if (fornecedores.length >= 3) {
      fornecedores.sort((a, b) => a.preco - b.preco);
      const median = fornecedores[Math.floor(fornecedores.length / 2)].preco;
      const filtered = fornecedores.filter(f => f.preco >= median * 0.10);
      if (filtered.length >= 2) fornecedores.splice(0, fornecedores.length, ...filtered);
    }
    fornecedores.sort((a, b) => a.preco - b.preco);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const fonteCount: Record<string, number> = {};
    for (const f of fornecedores) fonteCount[f.loja] = (fonteCount[f.loja] || 0) + 1;

    const precos = fornecedores.map(f => f.preco);
    const menorPreco = precos.length ? Math.min(...precos) : 0;
    const maiorPreco = precos.length ? Math.max(...precos) : 0;
    const precoMedio = precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : 0;
    const fornecedorMenor = fornecedores.find(f => f.preco === menorPreco);

    console.log(`[OK] ${fornecedores.length} produtos de ${Object.keys(fonteCount).length} fontes em ${elapsed}s`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        produto: termo,
        data_pesquisa: new Date().toLocaleDateString('pt-BR'),
        categoria: 'Pesquisa de Mercado',
        fornecedores,
        resumo: {
          menor_preco: menorPreco,
          maior_preco: maiorPreco,
          preco_medio: Math.round(precoMedio * 100) / 100,
          variacao: menorPreco > 0 ? `${(((maiorPreco - menorPreco) / menorPreco) * 100).toFixed(1)}%` : '0%',
          fornecedor_menor: fornecedorMenor?.loja || '',
          total_fontes: Object.keys(fonteCount).length,
          total_buscas: 1,
          recomendacao: fornecedores.length > 0
            ? `${fornecedores.length} produtos em ${Object.keys(fonteCount).length} lojas. Menor: R$ ${menorPreco.toFixed(2)} (${fornecedorMenor?.loja}). Tempo: ${elapsed}s.`
            : 'Nenhum resultado encontrado.',
        },
        fontes_consultadas: fonteCount,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Erro pesquisa-preco-real:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
