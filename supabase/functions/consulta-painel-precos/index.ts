import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PNCP_BASE = "https://pncp.gov.br/api";
const FETCH_TIMEOUT = 12_000;

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

    const now = new Date();
    const yearEnd = anoFim || now.getFullYear();
    const yearStart = anoInicio || yearEnd - 2; // últimos 3 anos por padrão

    const dataPublicacaoInicio = `${yearStart}-01-01`;
    const dataPublicacaoFim = `${yearEnd}-12-31`;

    console.log(`[painel-precos] Buscando "${termo}" de ${dataPublicacaoInicio} a ${dataPublicacaoFim}`);

    // Step 1: Search PNCP for procurements matching the term within date range
    const contratacoes = await searchContratacoes(termo, dataPublicacaoInicio, dataPublicacaoFim);
    console.log(`[painel-precos] ${contratacoes.length} contratações encontradas no PNCP`);

    if (contratacoes.length === 0) {
      return json({
        success: true,
        termo,
        resultados: [],
        resumo: null,
        mensagem: "Nenhuma contratação encontrada no PNCP para o período.",
      });
    }

    // Step 2: For each contratação, fetch items and filter by matching description
    const itemResults = await fetchItemsParallel(contratacoes, termo);
    console.log(`[painel-precos] ${itemResults.length} itens com preço unitário encontrados`);

    // Step 3: Sort by date descending
    const sorted = itemResults.sort(
      (a: any, b: any) =>
        new Date(b.data_compra || "2020-01-01").getTime() - new Date(a.data_compra || "2020-01-01").getTime()
    );

    // Step 4: Calculate stats from unit prices
    const precos = sorted.filter((r: any) => r.preco_unitario > 0).map((r: any) => r.preco_unitario);
    const resumo =
      precos.length > 0
        ? {
            menor_preco: Math.min(...precos),
            maior_preco: Math.max(...precos),
            preco_medio: +(precos.reduce((a: number, b: number) => a + b, 0) / precos.length).toFixed(2),
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

/**
 * Search PNCP for procurements matching the term.
 * Fetches multiple pages to get comprehensive coverage.
 */
async function searchContratacoes(
  termo: string,
  dataInicio: string,
  dataFim: string
): Promise<any[]> {
  const all: any[] = [];
  const maxPages = 3;

  // Convert YYYY-MM-DD to YYYYMMDD format required by PNCP API
  const dataInicioFmt = dataInicio.replace(/-/g, "");
  const dataFimFmt = dataFim.replace(/-/g, "");

  for (let page = 1; page <= maxPages; page++) {
    try {
      const params = new URLSearchParams({
        q: termo,
        pagina: String(page),
        tamanhoPagina: "50",
        dataInicial: dataInicioFmt,
        dataFinal: dataFimFmt,
      });

      const url = `${PNCP_BASE}/consulta/v1/contratacoes/publicacao?${params}`;
      console.log(`[painel-precos] Fetching page ${page}: ${url}`);
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });

      if (!resp.ok) {
        console.log(`[painel-precos] PNCP page ${page} returned ${resp.status}`);
        break;
      }

      const data = await resp.json();
      const items = data?.data || [];
      if (!Array.isArray(items) || items.length === 0) break;

      all.push(...items);
    } catch (e) {
      console.error(`[painel-precos] Erro page ${page}:`, e);
      break;
    }
  }

  return all;
}

/**
 * For each contratação, fetch its items from PNCP and filter those matching the search term.
 * Runs in parallel batches of 10 for speed.
 */
async function fetchItemsParallel(contratacoes: any[], termo: string): Promise<any[]> {
  const results: any[] = [];
  const termoLower = termo.toLowerCase();
  const termoWords = termoLower.split(/\s+/).filter((w) => w.length > 2);

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < contratacoes.length; i += batchSize) {
    const batch = contratacoes.slice(i, i + batchSize);
    const promises = batch.map((c) => fetchContratacaoItems(c, termoWords, termoLower));
    const batchResults = await Promise.allSettled(promises);

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value.length > 0) {
        results.push(...r.value);
      }
    }

    // Stop early if we have enough results
    if (results.length >= 80) break;
  }

  return results;
}

/**
 * Fetch items for a single contratação and return matching items with unit prices.
 */
async function fetchContratacaoItems(
  contratacao: any,
  termoWords: string[],
  termoLower: string
): Promise<any[]> {
  try {
    const cnpj = contratacao.orgaoEntidade?.cnpj;
    const ano = contratacao.anoCompra;
    const seq = contratacao.sequencialCompra;

    if (!cnpj || !ano || !seq) return [];

    const url = `${PNCP_BASE}/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1&tamanhoPagina=50`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) return [];

    const items = await resp.json();
    if (!Array.isArray(items)) return [];

    const matched: any[] = [];

    for (const item of items) {
      const desc = (item.descricao || item.materialOuServico || "").toLowerCase();
      
      // Check if the item description matches the search term
      const matchScore = calcMatchScore(desc, termoWords, termoLower);
      if (matchScore < 0.5) continue;

      // Prefer homologated price, then estimated
      const precoUnitario =
        item.valorUnitarioHomologado ||
        item.valorUnitarioEstimado ||
        0;

      if (precoUnitario <= 0) continue;

      // Determine type: ATA (SRP) or Contrato
      const isSRP = contratacao.srp === true || 
        (contratacao.objetoCompra || "").toLowerCase().includes("registro de preço") ||
        (contratacao.objetoCompra || "").toLowerCase().includes("ata de registro");

      const tipoRegistro = isSRP ? "ATA/SRP" : "Contrato";
      const isHomologado = !!item.valorUnitarioHomologado;

      matched.push({
        descricao: item.descricao || item.materialOuServico || contratacao.objetoCompra || "",
        orgao: contratacao.orgaoEntidade?.razaoSocial || contratacao.nomeUnidadeCompradora || "Órgão Federal",
        preco_unitario: precoUnitario,
        quantidade: item.quantidade || 1,
        unidade: item.unidadeMedida || "UN",
        data_compra: contratacao.dataPublicacaoPncp || contratacao.dataAbertura || "",
        modalidade: contratacao.modalidadeNome || "Licitação",
        uf: contratacao.orgaoEntidade?.uf || contratacao.uf || "",
        fonte: "PNCP",
        url: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
        numero_compra: contratacao.numeroCompra || `${ano}/${seq}`,
        tipo_registro: tipoRegistro,
        situacao: isHomologado ? "Homologado" : "Estimado",
        cnpj_orgao: cnpj,
        match_score: matchScore,
      });
    }

    return matched;
  } catch (e) {
    // Silently skip individual failures
    return [];
  }
}

/**
 * Calculate how well an item description matches the search term.
 * Returns 0-1 score.
 */
function calcMatchScore(descricao: string, termoWords: string[], termoLower: string): number {
  if (!descricao) return 0;

  // Exact match gets max score
  if (descricao.includes(termoLower)) return 1.0;

  // Count how many search words appear in the description
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
