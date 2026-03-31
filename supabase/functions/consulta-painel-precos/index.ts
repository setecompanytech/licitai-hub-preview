import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PNCP_BASE = "https://pncp.gov.br/api/pncp/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req, { functionName: "consulta-painel-precos", maxRequests: 20, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { termo, anoInicio, anoFim } = await req.json();
    if (!termo) {
      return json({ error: "Termo de busca é obrigatório" }, 400);
    }

    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_KEY) {
      return json({ error: "Chave Firecrawl não configurada" }, 500);
    }

    const now = new Date();
    const yearEnd = anoFim || now.getFullYear();
    const yearStart = anoInicio || yearEnd - 2;

    console.log(`[painel-precos] Buscando "${termo}" de ${yearStart} a ${yearEnd}`);

    // Phase 1: Use Firecrawl/Google to find relevant PNCP procurement pages
    const pncpLinks = await findPncpLinks(termo, yearStart, yearEnd, FIRECRAWL_KEY);
    console.log(`[painel-precos] ${pncpLinks.length} links PNCP encontrados via busca`);

    if (pncpLinks.length === 0) {
      return json({
        success: true,
        termo,
        resultados: [],
        resumo: null,
        mensagem: "Nenhuma contratação encontrada para esse termo no período.",
      });
    }

    // Phase 2: Fetch items from PNCP API for each procurement found
    const allItems = await fetchAllItems(pncpLinks, termo);
    console.log(`[painel-precos] ${allItems.length} itens com preço unitário encontrados`);

    // Sort by date descending
    const sorted = allItems.sort(
      (a, b) => new Date(b.data_compra || "2020-01-01").getTime() - new Date(a.data_compra || "2020-01-01").getTime()
    );

    // Calculate stats
    const precos = sorted.filter((r) => r.preco_unitario > 0).map((r) => r.preco_unitario);
    const resumo =
      precos.length > 0
        ? {
            menor_preco: Math.min(...precos),
            maior_preco: Math.max(...precos),
            preco_medio: +(precos.reduce((a, b) => a + b, 0) / precos.length).toFixed(2),
            mediana: calcMediana(precos),
            total_registros: sorted.length,
            periodo: `${yearStart}-${yearEnd}`,
            fontes: ["PNCP - Portal Nacional de Contratações Públicas"],
          }
        : null;

    return json({
      success: true,
      termo,
      resultados: sorted.slice(0, 100),
      resumo,
    });
  } catch (e: any) {
    console.error("[painel-precos] Erro:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});

// ============================================================
// Phase 1: Find PNCP procurement links via Firecrawl/Google search
// ============================================================
type PncpLink = {
  cnpj: string;
  ano: string;
  seq: string;
  title: string;
  orgao: string;
  dataPublicacao: string;
};

async function findPncpLinks(
  termo: string,
  yearStart: number,
  yearEnd: number,
  apiKey: string
): Promise<PncpLink[]> {
  // Run multiple search queries in parallel for better coverage
  const queries = [
    `"${termo}" site:pncp.gov.br/app/editais`,
    `"${termo}" preço unitário ata registro preços site:pncp.gov.br`,
    `"${termo}" pregão eletrônico site:pncp.gov.br`,
  ];

  const searches = queries.map((query) =>
    firecrawlSearch(query, apiKey, 15).catch(() => [] as any[])
  );

  const results = await Promise.all(searches);
  const allResults = results.flat();

  // Extract PNCP identifiers from URLs
  const seen = new Set<string>();
  const links: PncpLink[] = [];

  for (const r of allResults) {
    const url = r.url || "";
    const match = url.match(/pncp\.gov\.br\/app\/editais\/(\d+)\/(\d+)\/(\d+)/);
    if (!match) continue;

    const [, cnpj, ano, seq] = match;
    const key = `${cnpj}-${ano}-${seq}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Filter by year range
    const anoNum = parseInt(ano);
    if (anoNum < yearStart || anoNum > yearEnd) continue;

    links.push({
      cnpj,
      ano,
      seq,
      title: r.title || "",
      orgao: "",
      dataPublicacao: "",
    });
  }

  return links;
}

async function firecrawlSearch(query: string, apiKey: string, limit: number): Promise<any[]> {
  const resp = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      lang: "pt-br",
      country: "BR",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    console.log(`[painel-precos] Firecrawl returned ${resp.status}`);
    return [];
  }

  const data = await resp.json();
  return data?.data || [];
}

// ============================================================
// Phase 2: Fetch verified items from PNCP API
// ============================================================
async function fetchAllItems(links: PncpLink[], termo: string): Promise<any[]> {
  const termoLower = termo.toLowerCase();
  const termoWords = termoLower.split(/\s+/).filter((w) => w.length > 2);
  const results: any[] = [];

  // Process in parallel batches of 8
  const batchSize = 8;
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    const promises = batch.map((link) => fetchPncpItems(link, termoWords, termoLower));
    const batchResults = await Promise.allSettled(promises);

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value.length > 0) {
        results.push(...r.value);
      }
    }

    if (results.length >= 80) break;
  }

  return results;
}

async function fetchPncpItems(
  link: PncpLink,
  termoWords: string[],
  termoLower: string
): Promise<any[]> {
  try {
    // Fetch procurement details first
    const detailUrl = `${PNCP_BASE}/orgaos/${link.cnpj}/compras/${link.ano}/${link.seq}`;
    const detailResp = await fetch(detailUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    let contratacao: any = null;
    if (detailResp.ok) {
      contratacao = await detailResp.json();
    }

    // Fetch items
    const itemsUrl = `${PNCP_BASE}/orgaos/${link.cnpj}/compras/${link.ano}/${link.seq}/itens?pagina=1&tamanhoPagina=100`;
    const itemsResp = await fetch(itemsUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!itemsResp.ok) return [];

    const items = await itemsResp.json();
    if (!Array.isArray(items)) return [];

    const matched: any[] = [];

    for (const item of items) {
      const desc = (item.descricao || item.materialOuServico || "").toLowerCase();

      // Check if item matches the search term
      const matchScore = calcMatchScore(desc, termoWords, termoLower);
      if (matchScore < 0.5) continue;

      // Prefer homologated price > estimated price
      const precoUnitario = item.valorUnitarioHomologado || item.valorUnitarioEstimado || 0;
      if (precoUnitario <= 0) continue;

      // Determine type (ATA/SRP vs Contrato)
      const isSRP =
        contratacao?.srp === true ||
        (contratacao?.objetoCompra || "").toLowerCase().includes("registro de preço");
      const tipoRegistro = isSRP ? "ATA/SRP" : "Contrato";
      const isHomologado = !!item.valorUnitarioHomologado;

      const orgao =
        contratacao?.orgaoEntidade?.razaoSocial ||
        contratacao?.unidadeOrgao?.nomeUnidade ||
        link.title ||
        "Órgão Público";

      const uf =
        contratacao?.unidadeOrgao?.ufSigla ||
        contratacao?.orgaoEntidade?.uf ||
        "";

      matched.push({
        descricao: item.descricao || item.materialOuServico || "",
        orgao,
        preco_unitario: precoUnitario,
        quantidade: item.quantidade || 1,
        unidade: item.unidadeMedida || "UN",
        data_compra: contratacao?.dataPublicacaoPncp || contratacao?.dataInclusao || "",
        modalidade: contratacao?.modalidadeNome || "Licitação",
        uf,
        fonte: "PNCP",
        url: `https://pncp.gov.br/app/editais/${link.cnpj}/${link.ano}/${link.seq}`,
        numero_compra: contratacao?.numeroCompra || `${link.ano}/${link.seq}`,
        tipo_registro: tipoRegistro,
        situacao: isHomologado ? "Homologado" : "Estimado",
        match_score: matchScore,
      });
    }

    return matched;
  } catch (e) {
    return [];
  }
}

function calcMatchScore(descricao: string, termoWords: string[], termoLower: string): number {
  if (!descricao) return 0;
  if (descricao.includes(termoLower)) return 1.0;

  let matchedWords = 0;
  for (const word of termoWords) {
    if (descricao.includes(word)) matchedWords++;
  }
  if (termoWords.length === 0) return 0;
  return matchedWords / termoWords.length;
}

function calcMediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
