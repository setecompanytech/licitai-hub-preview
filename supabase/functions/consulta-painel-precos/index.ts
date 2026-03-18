import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { termo, pagina = 1 } = await req.json();
    if (!termo) {
      return new Response(JSON.stringify({ error: "Termo de busca é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Buscando preços Gov.br para: "${termo}"`);

    // Strategy 1: Search PNCP API for recent procurement prices
    const pncpResults = await searchPNCP(termo);

    // Strategy 2: Use Firecrawl to search Painel de Preços / ComprasNet
    const firecrawlResults = await searchWithFirecrawl(termo, FIRECRAWL_API_KEY);

    // Combine results
    const allResults = [...pncpResults, ...firecrawlResults];

    // Deduplicate and sort by date
    const deduped = deduplicateResults(allResults);
    const sorted = deduped.sort((a: any, b: any) => 
      new Date(b.data_compra || '2020-01-01').getTime() - new Date(a.data_compra || '2020-01-01').getTime()
    );

    // Calculate stats
    const precos = sorted.filter((r: any) => r.preco_unitario > 0).map((r: any) => r.preco_unitario);
    const resumo = precos.length > 0 ? {
      menor_preco: Math.min(...precos),
      maior_preco: Math.max(...precos),
      preco_medio: precos.reduce((a: number, b: number) => a + b, 0) / precos.length,
      total_registros: sorted.length,
      fontes: [...new Set(sorted.map((r: any) => r.fonte))],
    } : null;

    return new Response(JSON.stringify({
      success: true,
      termo,
      resultados: sorted.slice(0, 50),
      resumo,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro consulta painel:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function searchPNCP(termo: string): Promise<any[]> {
  try {
    const encoded = encodeURIComponent(termo);
    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?q=${encoded}&pagina=1&tamanhoPagina=20`;
    
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!resp.ok) {
      console.log(`PNCP returned ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const items = data?.data || data?.content || [];
    if (!Array.isArray(items)) return [];

    return items.slice(0, 15).map((item: any) => ({
      descricao: item.objetoCompra || item.descricao || termo,
      orgao: item.orgaoEntidade?.razaoSocial || item.nomeUnidadeCompradora || 'Órgão Federal',
      preco_unitario: item.valorTotalEstimado || item.valorTotalHomologado || 0,
      quantidade: item.quantidadeItens || 1,
      unidade: 'UN',
      data_compra: item.dataPublicacaoPncp || item.dataAbertura || '',
      modalidade: item.modalidadeNome || item.modalidade || 'Licitação',
      uf: item.uf || item.orgaoEntidade?.uf || '',
      fonte: 'PNCP',
      url: `https://pncp.gov.br/app/editais/${item.codigoUnidadeCompradora || ''}/${item.anoCompra || ''}/${item.sequencialCompra || ''}`,
      numero_compra: item.numeroCompra || '',
    }));
  } catch (e) {
    console.error("Erro PNCP:", e);
    return [];
  }
}

async function searchWithFirecrawl(termo: string, apiKey: string): Promise<any[]> {
  try {
    const query = `"${termo}" preço compras governamentais site:gov.br OR site:comprasnet.gov.br`;
    
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 10,
        lang: "pt-br",
        country: "BR",
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!resp.ok) {
      console.log(`Firecrawl search returned ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const results = data?.data || [];
    if (!Array.isArray(results)) return [];

    // Parse scraped results to extract price information
    const parsed: any[] = [];
    for (const r of results) {
      const markdown = r.markdown || r.description || '';
      const priceMatches = markdown.match(/R\$\s*([\d.,]+)/g) || [];
      const prices = priceMatches
        .map((p: string) => parseFloat(p.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()))
        .filter((p: number) => p > 0 && p < 10000000);
      
      if (prices.length > 0) {
        parsed.push({
          descricao: r.title || termo,
          orgao: extractOrgao(r.url || ''),
          preco_unitario: prices[0],
          quantidade: 1,
          unidade: 'UN',
          data_compra: '',
          modalidade: 'Compra Pública',
          uf: '',
          fonte: 'Compras Gov.br',
          url: r.url || '',
          numero_compra: '',
        });
      }
    }

    return parsed;
  } catch (e) {
    console.error("Erro Firecrawl Gov:", e);
    return [];
  }
}

function extractOrgao(url: string): string {
  if (url.includes('comprasnet')) return 'ComprasNet';
  if (url.includes('pncp')) return 'PNCP';
  if (url.includes('gov.br')) return 'Portal Gov.br';
  return 'Órgão Público';
}

function deduplicateResults(results: any[]): any[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.descricao}-${r.preco_unitario}-${r.orgao}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
