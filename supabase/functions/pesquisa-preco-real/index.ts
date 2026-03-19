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
  images?: string[];
  parcelas?: string;
  avaliacao?: number;
  vendedor_qualificado?: boolean;
};

/* ─── Known brands ─── */
const KNOWN_BRANDS = [
  'Dell','HP','Lenovo','Samsung','Apple','LG','Sony','Asus','Acer',
  'Philips','Panasonic','Motorola','Xiaomi','Intel','AMD','Corsair',
  'Logitech','Microsoft','Epson','Canon','Brother','Multilaser','Positivo',
  'Intelbras','Electrolux','Brastemp','Consul','Fischer','Cadence',
  'Mondial','Britânia','Tramontina','Vonder','Makita','Bosch','DeWalt',
  'Suvinil','Coral','Sherwin-Williams','Tigre','Amanco','Quartzolit',
  'Kingston','HyperX','Redragon','JBL','Edifier','TP-Link','Nvidia',
  'Gigabyte','MSI','Razer','SteelSeries','AOC','BenQ','ViewSonic',
  'Chamex','Report','Suzano','International Paper','Navigator','Copimax',
  '3M','Faber-Castell','BIC','Pilot','Staedtler','Pentel',
  'Caterpillar','John Deere','Komatsu','Volvo','Scania',
  'Havaianas','Alpargatas','Grendene','Nike','Adidas','Puma',
  'Nestlé','Unilever','P&G','Ambev','BRF','JBS','Seara','Sadia','Perdigão',
  'Ypê','Bombril','Bettanin','Limppano','Reckitt','Johnson','Kimberly-Clark',
  'Dixie','Descarpack','Talge','Santher','Mili','Personal','Neve',
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

function detectStore(url: string): string {
  const u = url.toLowerCase();
  const map: [RegExp, string][] = [
    [/mercadoli[vb]re|mercadolibre|mlstatic|produto\.mercadolivre/, 'Mercado Livre'],
    [/amazon\.com\.br/, 'Amazon'],
    [/magazineluiza|magalu/, 'Magazine Luiza'],
    [/kabum\.com\.br/, 'KaBuM'],
    [/americanas\.com\.br/, 'Americanas'],
    [/casasbahia\.com\.br/, 'Casas Bahia'],
    [/submarino\.com\.br/, 'Submarino'],
    [/carrefour\.com\.br/, 'Carrefour'],
    [/shopee\.com\.br/, 'Shopee'],
    [/aliexpress\.com/, 'AliExpress'],
    [/pichau\.com\.br/, 'Pichau'],
    [/terabyteshop\.com\.br/, 'Terabyte'],
    [/havan\.com\.br/, 'Havan'],
    [/gazinatacado\.com\.br/, 'Gazin Atacado'],
    [/webcontinental\.com\.br/, 'Webcontinental'],
    [/pontofrio\.com\.br/, 'Ponto Frio'],
    [/google\.com.*\/shopping/, 'Google Shopping'],
    [/buscape\.com\.br/, 'Buscapé'],
    [/zoom\.com\.br/, 'Zoom'],
    [/leroymerlin\.com\.br/, 'Leroy Merlin'],
    [/madeiramadeira\.com\.br/, 'MadeiraMadeira'],
    [/fastshop\.com\.br/, 'Fast Shop'],
    [/kalunga\.com\.br/, 'Kalunga'],
    [/extra\.com\.br/, 'Extra'],
    [/colombo\.com\.br/, 'Colombo'],
    [/centauro\.com\.br/, 'Centauro'],
    [/atacadao\.com\.br/, 'Atacadão'],
    [/assai\.com\.br/, 'Assaí'],
    [/samsclub\.com\.br/, "Sam's Club"],
    [/makro\.com\.br/, 'Makro'],
    [/lojadomecanico\.com\.br/, 'Loja do Mecânico'],
    [/cobasi\.com\.br/, 'Cobasi'],
    [/drogasil\.com\.br/, 'Drogasil'],
    [/drogaraia\.com\.br/, 'Droga Raia'],
    [/ultrafarma\.com\.br/, 'Ultrafarma'],
    [/paguemenos\.com\.br/, 'Pague Menos'],
    [/obramax\.com\.br/, 'Obramax'],
    [/telhanorte\.com\.br/, 'Telha Norte'],
    [/dutramaquinas\.com\.br/, 'Dutra Máquinas'],
    [/jfriosistemas\.com\.br/, 'JFrio'],
    [/multioffice\.com\.br/, 'Multi Office'],
  ];
  for (const [re, name] of map) {
    if (re.test(u)) return name;
  }
  return 'Outros';
}

function isSearchOrListingPage(url: string): boolean {
  return /\/busca\/|\/search|\/lista\/|\/list\/|catalogsearch|\?s?k=|[?&]q=|[?&]search=|[?&]str=|\/(?:categoria|departamento)\//i.test(url);
}

function isLikelyProductPage(url: string, loja: string): boolean {
  const u = url.toLowerCase();
  if (loja === 'Amazon') return /\/dp\/[a-z0-9]{8,}/i.test(url) || /\/gp\/product\//i.test(url);
  if (loja === 'Mercado Livre') return /mlb[-\/]?\d{6,}/i.test(url) || /\/p\/mlb\d+/i.test(url) || /produto\.mercadolivre/i.test(url);
  if (loja === 'Magazine Luiza') return /\/p\//i.test(u) && !u.includes('/busca/');
  if (loja === 'KaBuM' || loja === 'Terabyte' || loja === 'Pichau') return /\/produto\//i.test(u);
  if (loja === 'Shopee') return /-i\.\d+\.\d+/i.test(url);
  if (loja === 'Casas Bahia' || loja === 'Americanas' || loja === 'Submarino') return /\/produto\//i.test(u) || /\/p\//i.test(u) || /\/\d{6,}\//i.test(u);
  if (['Buscapé', 'Zoom', 'Google Shopping'].includes(loja)) return true;
  return !isSearchOrListingPage(url);
}

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
  if (/thumb|thumbnail/i.test(u)) score -= 1;
  if (/og[_\-.]|social[-_]?share/i.test(u)) score -= 5;
  if (/\/assets\/|\/static\/|\/themes\/|\/template\//i.test(u)) score -= 5;
  if (/\/rating\/|\/stars\//i.test(u)) score -= 4;
  if (/logo|icon|sprite|banner|favicon|badge|selo|stamp|watermark/i.test(u)) score -= 6;
  return score;
}

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

function extractImages(result: any): string[] {
  const markdown = result.markdown || '';
  const candidates: { url: string; score: number }[] = [];
  const seen = new Set<string>();

  function addImg(url: string) {
    if (!url || seen.has(url) || !isProductImage(url)) return;
    seen.add(url);
    candidates.push({ url, score: scoreImageCandidate(url) });
  }

  const patterns = [
    /(https?:\/\/http2\.mlstatic\.com\/D_[^\s"')]+\.(?:jpg|webp|png))/gi,
    /(https?:\/\/m\.media-amazon\.com\/images\/I\/[^\s"')]+\.(?:jpg|webp|png))/gi,
    /(https?:\/\/images\.kabum\.com\.br\/[^\s"')]+\.(?:jpg|webp|png))/gi,
    /(https?:\/\/[^\s"')]*(?:magazineluiza|magalu)[^\s"')]*\.(?:jpg|webp|png))/gi,
    /(https?:\/\/cf\.shopee\.[^\s"')]+\.(?:jpg|webp|png))/gi,
  ];
  for (const pat of patterns) {
    for (const m of markdown.matchAll(pat)) addImg(m[1]);
  }

  for (const m of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi)) addImg(m[1]);
  for (const m of markdown.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp))(?:\?[^\s"'<>]*)?/gi)) addImg(m[1]);

  const ogImage = result.metadata?.ogImage || result.metadata?.['og:image'];
  if (ogImage) addImg(ogImage);

  return candidates.sort((a, b) => b.score - a.score).map(c => c.url).slice(0, 5);
}

function isMainProduct(title: string, searchTerm: string, url: string, loja: string): boolean {
  const titleLower = title.toLowerCase();

  if (['Buscapé', 'Zoom', 'Google Shopping'].includes(loja)) {
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return searchWords.length === 0 || searchWords.some(w => titleLower.includes(w));
  }

  if (isSearchOrListingPage(url) && !isLikelyProductPage(url, loja)) return false;

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

  if (/em promoç[aã]o|com menor preço|na amazon\.com\.br|mercado livre|\| shopee|resultado de busca|categoria/i.test(titleLower)) return false;
  if (/^(eletrodomésticos|eletrônicos|informática|móveis|utilidades)\s*(no\s*atacado|em\s*oferta)/i.test(titleLower)) return false;
  if (/^(gazin\s*atacado|inicio|home)\s*[:|\-]?\s*$/i.test(titleLower.replace(/\s+/g, ' ').trim())) return false;

  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length > 0) {
    const matchCount = searchWords.filter(w => titleLower.includes(w)).length;
    const threshold = searchWords.length <= 3 ? 1 : Math.ceil(searchWords.length * 0.4);
    if (matchCount < threshold) return false;
  }

  return true;
}

function parseSearchResult(result: any, searchTerm: string): ProdutoExtraido | null {
  const url = result.url || '';
  const title = result.title || '';
  const description = result.description || '';
  const markdown = result.markdown || '';
  const fullText = `${title}\n${description}\n${markdown}`;

  if (!title || title.length < 5) return null;

  const loja = detectStore(url);
  if (!isMainProduct(title, searchTerm, url, loja)) return null;

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

/* ─── Category detection for smart search routing ─── */
type ProductCategory = 'alimentos' | 'informatica' | 'eletrodomesticos' | 'moveis' | 'descartaveis' | 'higiene_limpeza' | 'escritorio' | 'construcao' | 'ferramentas' | 'geral';

function detectCategory(termo: string): ProductCategory {
  const t = termo.toLowerCase();
  if (/aliment|comida|bebida|arroz|feijão|açúcar|café|óleo|farinha|leite|carne|frango|macarrão|biscoito|suco|água\s*mineral|sal\s*refin|margarina|manteiga|queijo|presunto|iogurte|cereal|conserva|molho|tempero|vinagre|azeite/i.test(t)) return 'alimentos';
  if (/notebook|computador|monitor|impressora|teclado|mouse|ssd|hd\s*externo|pendrive|roteador|switch|servidor|nobreak|scanner|webcam|headset|placa|memória\s*ram|processador|gabinete|fonte\s*\d+w/i.test(t)) return 'informatica';
  if (/geladeira|refrigerador|fogão|microondas|lavadora|máquina\s*de\s*lavar|ar\s*condicionado|ventilador|liquidificador|batedeira|cafeteira|forno|freezer|purificador|bebedouro|climatizador|aspirador/i.test(t)) return 'eletrodomesticos';
  if (/mesa|cadeira|armário|estante|gaveteiro|arquivo|sofá|poltrona|bancada|balcão|escrivaninha|rack|painel|prateleira|longarina/i.test(t)) return 'moveis';
  if (/descartáv|copo\s*descart|prato\s*descart|talher\s*descart|guardanapo|papel\s*toalha|saco\s*de\s*lixo|luva\s*descart|máscara\s*descart|avental\s*descart|touca\s*descart/i.test(t)) return 'descartaveis';
  if (/detergente|desinfetante|água\s*sanit|sabão|limpador|alvejante|esponja|vassoura|rodo|pano\s*de\s*chão|papel\s*higiênico|sabonete|shampoo|álcool|higien|limpeza|desodorizador/i.test(t)) return 'higiene_limpeza';
  if (/papel\s*(a4|sulfit|ofício)|caneta|lápis|borracha|grampeador|clips|pasta|envelope|fita\s*adesiva|cola|tesoura|régua|carimbo|toner|cartucho|etiqueta/i.test(t)) return 'escritorio';
  if (/cimento|tijolo|argamassa|tinta\s*(acrílica|latex)|piso|azulejo|tubo|conexão|fio\s*elétrico|disjuntor|tomada|interruptor|registro|torneira|vaso\s*sanitário/i.test(t)) return 'construcao';
  if (/furadeira|parafusadeira|serra|martelo|chave\s*(de\s*fenda|phillips|allen|combinada)|alicate|trena|nível|broca|disco\s*de\s*corte|lixadeira|compressor|solda/i.test(t)) return 'ferramentas';
  return 'geral';
}

/** Build an array of 20-30 targeted search queries based on product category */
function buildSearchQueries(termo: string, categoria: ProductCategory): { query: string; limit: number }[] {
  const queries: { query: string; limit: number }[] = [];

  // ── UNIVERSAL searches (always included — 8 queries) ──
  // 1-2. Two biggest BR marketplaces
  queries.push({ query: `${termo} site:mercadolivre.com.br`, limit: 10 });
  queries.push({ query: `${termo} site:amazon.com.br`, limit: 8 });
  // 3. Google Shopping aggregator
  queries.push({ query: `${termo} site:google.com.br/shopping OR site:shopping.google.com.br`, limit: 8 });
  // 4-5. Major retail chains (split to avoid OR overload)
  queries.push({ query: `"${termo}" site:magazineluiza.com.br OR site:casasbahia.com.br`, limit: 6 });
  queries.push({ query: `"${termo}" site:americanas.com.br OR site:submarino.com.br`, limit: 6 });
  // 6. Shopee + Carrefour
  queries.push({ query: `"${termo}" site:shopee.com.br OR site:carrefour.com.br`, limit: 6 });
  // 7. Price comparators
  queries.push({ query: `${termo} site:buscape.com.br OR site:zoom.com.br`, limit: 6 });
  // 8. Broad catch-all
  queries.push({ query: `"${termo}" comprar preço loja online Brasil`, limit: 6 });

  // ── CATEGORY-SPECIFIC searches (10-22 additional queries) ──
  switch (categoria) {
    case 'alimentos':
      queries.push({ query: `"${termo}" site:atacadao.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:assai.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:samsclub.com.br OR site:makro.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazinatacado.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:paodeacucar.com`, limit: 5 });
      queries.push({ query: `"${termo}" site:supermercadosnow.com.br OR site:ifood.com.br/mercado`, limit: 5 });
      queries.push({ query: `"${termo}" atacado distribuidor alimentos preço`, limit: 6 });
      queries.push({ query: `"${termo}" site:savegnago.com.br OR site:supermuffato.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:coren.com.br OR site:bondfaro.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" cesta básica cotação atacado`, limit: 5 });
      queries.push({ query: `"${termo}" site:extraplus.com.br OR site:bigbom.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" preço kg litro unidade supermercado`, limit: 5 });
      break;

    case 'informatica':
      queries.push({ query: `"${termo}" site:kabum.com.br`, limit: 8 });
      queries.push({ query: `"${termo}" site:pichau.com.br OR site:terabyteshop.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:fastshop.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:dell.com.br OR site:hp.com.br OR site:lenovo.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:colombo.com.br OR site:webcontinental.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazintacado.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:waz.com.br OR site:hardplus.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:eletrum.com.br OR site:ibyte.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:mega10.com.br OR site:shoploko.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" distribuidor informática atacado preço`, limit: 5 });
      queries.push({ query: `"${termo}" licitação informática fornecedor governo`, limit: 5 });
      queries.push({ query: `"${termo}" site:kalunga.com.br OR site:staples.com.br`, limit: 5 });
      break;

    case 'eletrodomesticos':
      queries.push({ query: `"${termo}" site:colombo.com.br OR site:webcontinental.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazinatacado.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:fastshop.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:pontofrio.com.br OR site:extra.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:electrolux.com.br OR site:consul.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:brastemp.com.br OR site:lg.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:samsung.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:climatrio.com.br OR site:gelfriosistemas.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" eletrodoméstico preço atacado distribuidor`, limit: 5 });
      queries.push({ query: `"${termo}" loja eletrodomésticos menor preço`, limit: 5 });
      break;

    case 'moveis':
      queries.push({ query: `"${termo}" site:madeiramadeira.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:leroymerlin.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:tokstok.com.br OR site:mobly.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:flexform.com.br OR site:marelli.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:moveisparaescritorio.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:colombo.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:casamob.com.br OR site:lojasdemoveis.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" móveis escritório corporativo atacado`, limit: 5 });
      queries.push({ query: `"${termo}" mobiliário escolar institucional preço`, limit: 5 });
      queries.push({ query: `"${termo}" site:planaltomoveis.com.br OR site:moveiskappesberg.com.br`, limit: 5 });
      break;

    case 'descartaveis':
      queries.push({ query: `"${termo}" site:atacadao.com.br OR site:assai.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:samsclub.com.br OR site:makro.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:gazinatacado.com.br OR site:havan.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" descartável atacado distribuidor embalagem`, limit: 6 });
      queries.push({ query: `"${termo}" site:lojacatalao.com.br OR site:centraldeembalagens.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:destakcasa.com.br OR site:embalatudo.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:sylvamo.com.br OR site:copobras.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:descarpack.com.br OR site:talge.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" copo prato talher descartável preço caixa`, limit: 5 });
      queries.push({ query: `"${termo}" site:webarcondicionado.com.br OR site:embalagemdireto.com.br`, limit: 5 });
      break;

    case 'higiene_limpeza':
      queries.push({ query: `"${termo}" site:atacadao.com.br OR site:assai.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:samsclub.com.br OR site:makro.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:gazinatacado.com.br OR site:havan.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:kalunga.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" higiene limpeza atacado distribuidor preço`, limit: 6 });
      queries.push({ query: `"${termo}" site:catarinense.com OR site:distribuidora.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:drogaraia.com.br OR site:drogasil.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:paguemenos.com.br OR site:ultrafarma.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:ype.ind.br OR site:bombril.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" papel higiênico sabão detergente preço caixa`, limit: 5 });
      break;

    case 'escritorio':
      queries.push({ query: `"${termo}" site:kalunga.com.br`, limit: 8 });
      queries.push({ query: `"${termo}" site:staples.com.br OR site:gimba.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:papelariauniversal.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:multioffice.com.br OR site:officemax.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:colombo.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" papelaria escritório atacado distribuidor`, limit: 6 });
      queries.push({ query: `"${termo}" site:chies.com.br OR site:acrimet.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:mania-de-papelaria.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" papel A4 toner cartucho preço resma caixa`, limit: 5 });
      queries.push({ query: `"${termo}" site:3m.com.br OR site:bfranca.com.br`, limit: 5 });
      break;

    case 'construcao':
      queries.push({ query: `"${termo}" site:leroymerlin.com.br`, limit: 8 });
      queries.push({ query: `"${termo}" site:madeiramadeira.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:obramax.com.br OR site:telhanorte.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:amoedo.com.br OR site:hfraga.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazinatacado.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:chatuba.com.br OR site:sodimac.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" material construção distribuidora atacado preço`, limit: 6 });
      queries.push({ query: `"${termo}" site:tigre.com.br OR site:amanco.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:quartzolit.com.br OR site:votoran.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" cimento tinta piso azulejo preço saco`, limit: 5 });
      break;

    case 'ferramentas':
      queries.push({ query: `"${termo}" site:leroymerlin.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:lojadomecanico.com.br OR site:dutramaquinas.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:palaciodasferramentas.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:ferramentaskennedy.com.br OR site:maxferramentas.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazinatacado.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:makita.com.br OR site:dewalt.com.br OR site:bosch-professional.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" ferramenta elétrica manual atacado preço`, limit: 5 });
      queries.push({ query: `"${termo}" site:obramax.com.br OR site:telhanorte.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:nafrente.com.br OR site:ferramentaskennedy.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" ferramenta profissional distribuidor governo`, limit: 5 });
      break;

    default: // 'geral'
      queries.push({ query: `"${termo}" site:havan.com.br OR site:gazinatacado.com.br`, limit: 6 });
      queries.push({ query: `"${termo}" site:webcontinental.com.br OR site:colombo.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:leroymerlin.com.br OR site:madeiramadeira.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:fastshop.com.br OR site:centauro.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:kabum.com.br OR site:pichau.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:kalunga.com.br OR site:staples.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:atacadao.com.br OR site:assai.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:cobasi.com.br OR site:petlove.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" distribuidor atacado preço cotação Brasil`, limit: 6 });
      queries.push({ query: `"${termo}" fornecedor governo licitação menor preço`, limit: 5 });
      queries.push({ query: `"${termo}" site:pontofrio.com.br OR site:extra.com.br`, limit: 5 });
      queries.push({ query: `"${termo}" site:drogaraia.com.br OR site:drogasil.com.br`, limit: 5 });
      break;
  }

  return queries;
}

/** Run a Firecrawl search with per-query timeout */
async function searchProducts(apiKey: string, query: string, limit = 10, timeoutMs = 8000): Promise<any[]> {
  try {
    console.log(`Searching: "${query}" (limit ${limit})`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Search error: HTTP ${response.status} - ${errText.substring(0, 200)}`);
      return [];
    }

    const data = await response.json();
    return data?.data || [];
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      console.warn(`Search timeout: "${query}"`);
      return [];
    }
    console.error("Search error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req, { functionName: "pesquisa-preco-real", maxRequests: 15, windowMinutes: 5 });
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

    console.log(`Pesquisa real para: "${termo}"`);
    const startTime = Date.now();

    // ─── SMART CATEGORY DETECTION ───
    const categoria = detectCategory(termo);
    console.log(`Categoria detectada: ${categoria}`);

    // ─── BUILD 20-30 TARGETED QUERIES ───
    const queryList = buildSearchQueries(termo, categoria);
    console.log(`Total de buscas paralelas: ${queryList.length}`);

    // ─── EXECUTE ALL IN PARALLEL with 8s per-query timeout ───
    const searches = await Promise.allSettled(
      queryList.map(q => searchProducts(apiKey, q.query, q.limit, 8000))
    );

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

    // Sort by price
    allFornecedores.sort((a, b) => a.preco - b.preco);

    // Remove statistical outliers
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

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Total: ${allFornecedores.length} produtos de ${Object.keys(fonteCount).length} fontes em ${elapsed}s`);
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
        categoria: categoria === 'geral' ? 'Pesquisa de Mercado' : categoria.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        fornecedores: allFornecedores,
        resumo: {
          menor_preco: menorPreco,
          maior_preco: maiorPreco,
          preco_medio: Math.round(precoMedio * 100) / 100,
          variacao,
          fornecedor_menor: fornecedorMenor ? `${fornecedorMenor.loja}` : '',
          fornecedor_maior: fornecedorMaior ? `${fornecedorMaior.loja}` : '',
          total_fontes: Object.keys(fonteCount).length,
          total_buscas: queryList.length,
          recomendacao: allFornecedores.length > 0
            ? `Pesquisa em ${Object.keys(fonteCount).length} fontes (${queryList.length} buscas paralelas) com ${allFornecedores.length} resultados válidos. Categoria: ${categoria}. Menor preço: R$ ${menorPreco.toFixed(2)} (${fornecedorMenor?.loja}). Tempo: ${elapsed}s.`
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
