import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

// ── Portal definitions ────────────────────────────────────────────────────
const PORTAL_HOMEPAGES = new Set([
  "https://www.gov.br/compras/pt-br",
  "https://www.gov.br/compras",
  "https://www.gov.br",
  "https://bnc.org.br",
  "https://bnc.org.br/",
  "https://www.bec.sp.gov.br",
  "https://www.bec.sp.gov.br/",
  "https://www.compras.rj.gov.br",
  "https://www.compras.rj.gov.br/",
  "https://licitacoes-e2.bb.com.br/aop-inter-estatico/",
  "https://licitacoes-e2.bb.com.br",
  "https://cotacao.banpara.b.br/portal/Mural.aspx",
  "https://cotacao.banpara.b.br",
  "https://www.licitanet.com.br",
  "https://www.licitanet.com.br/",
  "https://bllcompras.com",
  "https://bllcompras.com/",
  "https://www.portaldecompraspublicas.com.br",
  "https://www.portaldecompraspublicas.com.br/",
  "https://pncp.gov.br",
  "https://pncp.gov.br/",
]);

function isGenericPortalUrl(url: string): boolean {
  if (!url) return true;
  const normalized = url.replace(/\/+$/, "").split("?")[0].split("#")[0];
  if (PORTAL_HOMEPAGES.has(normalized) || PORTAL_HOMEPAGES.has(normalized + "/")) return true;
  // Check if it's just a domain root or generic path
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (pathParts.length <= 1) return true; // Too generic (e.g., /compras or /)
  } catch { return true; }
  return false;
}

const PORTAIS_SCRAPE: Record<string, { nome: string; searchUrl: (q: string) => string }> = {
  bnc: {
    nome: "BNC - Bolsa Nacional de Compras",
    searchUrl: (q) => `https://bnc.org.br/sistema/licitacoes?q=${encodeURIComponent(q)}`,
  },
  becsp: {
    nome: "BEC/SP",
    searchUrl: (q) => `https://www.bec.sp.gov.br/BECSP/Aspx/PregaoEletronicoConsulta.aspx`,
  },
  comprasrj: {
    nome: "Compras Públicas RJ",
    searchUrl: (q) => `https://www.compras.rj.gov.br/Portal-Licitacao/Busca`,
  },
  licitacoese: {
    nome: "Licitações-e (BB)",
    searchUrl: (q) => `https://licitacoes-e2.bb.com.br/aop-inter-estatico/`,
  },
  banparanet: {
    nome: "Banparanet PA",
    searchUrl: (q) => `https://cotacao.banpara.b.br/portal/Mural.aspx`,
  },
  comprasnet: {
    nome: "Compras Governamentais",
    searchUrl: (q) => `https://www.gov.br/compras/pt-br`,
  },
  licitanet: {
    nome: "Licitanet",
    searchUrl: (q) => `https://www.licitanet.com.br/licitacoes?q=${encodeURIComponent(q)}`,
  },
  bll: {
    nome: "BLL Compras",
    searchUrl: (q) => `https://bllcompras.com/ProcessosList?q=${encodeURIComponent(q)}`,
  },
  portalcompras: {
    nome: "Portal de Compras Públicas",
    searchUrl: (q) => `https://www.portaldecompraspublicas.com.br/processos?q=${encodeURIComponent(q)}`,
  },
};

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ── PNCP API (real data) ──────────────────────────────────────────────────
async function buscarPNCP(params: {
  query: string;
  uf?: string;
  modalidade?: string;
  dataInicio?: string;
  dataFim?: string;
  cnpj?: string;
  limite?: number;
}): Promise<any[]> {
  const resultados: any[] = [];
  const now = new Date();
  const dataInicial = params.dataInicio
    ? formatDatePNCP(new Date(params.dataInicio))
    : formatDatePNCP(new Date(now.getTime() - 90 * 86400000));
  const dataFinal = params.dataFim
    ? formatDatePNCP(new Date(params.dataFim))
    : formatDatePNCP(new Date(now.getTime() + 90 * 86400000));

  const modalidades = params.modalidade
    ? [params.modalidade]
    : ["6", "4", "8", "5", "9", "1"];

  for (const mod of modalidades) {
    try {
      const searchParams = new URLSearchParams({
        dataInicial,
        dataFinal,
        codigoModalidadeContratacao: mod,
        pagina: "1",
        tamanhoPagina: String(params.limite || 30),
      });
      if (params.query) searchParams.set("q", params.query.substring(0, 100));
      if (params.uf) searchParams.set("uf", params.uf);
      if (params.cnpj) searchParams.set("cnpjOrgao", params.cnpj.replace(/\D/g, ""));

      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${searchParams}`;
      console.log(`PNCP (mod=${mod}): ${url}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) { await resp.text(); continue; }
      const data = await resp.json();
      const items = data.data || [];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const ufItem = item.unidadeOrgao?.ufSigla || item.orgaoEntidade?.ufSigla || "";
        if (params.uf && params.uf !== "TODOS" && ufItem !== params.uf && ufItem !== "DF") continue;

        const cnpjOrgao = item.orgaoEntidade?.cnpj || "";
        const anoCompra = item.anoCompra || "";
        const seqCompra = item.sequencialCompra || "";
        let urlPncp = "";
        if (cnpjOrgao && anoCompra && seqCompra) {
          urlPncp = `https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${seqCompra}`;
        }

        resultados.push({
          titulo: (item.objetoCompra || "Sem título").substring(0, 500),
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || "Órgão",
          modalidade: item.modalidadeNome || "Pregão Eletrônico",
          status: item.situacaoCompraNome || "Publicado",
          valor_estimado: item.valorTotalEstimado || item.valorTotalHomologado || null,
          uf: ufItem,
          municipio: item.unidadeOrgao?.municipioNome || null,
          data_abertura: item.dataEncerramentoProposta?.split("T")[0] || item.dataAberturaProposta?.split("T")[0] || null,
          data_publicacao: item.dataPublicacaoPncp?.split("T")[0] || null,
          portal: "PNCP",
          url: item.linkSistemaOrigem || urlPncp,
          cnpj_orgao: cnpjOrgao,
          ano_compra: anoCompra,
          seq_compra: seqCompra,
          pncp_numero: item.numeroControlePNCP || null,
          numero: item.numeroCompra || item.numeroControlePNCP || "",
          fonte_real: true,
          tem_download: !!(cnpjOrgao && anoCompra && seqCompra),
        });
      }
    } catch (e) {
      console.error(`PNCP mod=${mod}:`, e);
    }
  }
  return resultados;
}

// ── Firecrawl scraping for other portals ──────────────────────────────────
async function buscarComFirecrawl(
  portalId: string,
  query: string,
  firecrawlKey: string
): Promise<any[]> {
  const portal = PORTAIS_SCRAPE[portalId];
  if (!portal) return [];

  const resultados: any[] = [];
  try {
    // Use Firecrawl search to find bidding documents
    const searchQuery = `${query} licitação edital site:${new URL(portal.searchUrl(query)).hostname}`;
    console.log(`Firecrawl search for ${portal.nome}: ${searchQuery}`);

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
        lang: "pt",
        country: "br",
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Firecrawl search error for ${portalId}: ${response.status} ${errText.substring(0, 200)}`);
      return resultados;
    }

    const data = await response.json();
    const results = data.data || [];
    console.log(`Firecrawl ${portalId}: ${results.length} results`);

    for (const result of results) {
      const title = result.title || "";
      const description = result.description || "";
      const url = result.url || "";
      const markdown = result.markdown || "";

      // Extract value if present
      let valor: number | null = null;
      const valorMatch = (markdown + description).match(/R\$\s*([\d.,]+)/);
      if (valorMatch) {
        valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
        if (isNaN(valor)) valor = null;
      }

      // Extract modalidade
      let modalidade = "Pregão Eletrônico";
      if (/concorrência/i.test(title + description)) modalidade = "Concorrência";
      else if (/dispensa/i.test(title + description)) modalidade = "Dispensa";
      else if (/inexigibilidade/i.test(title + description)) modalidade = "Inexigibilidade";
      else if (/tomada de preço/i.test(title + description)) modalidade = "Tomada de Preços";
      else if (/credenciamento/i.test(title + description)) modalidade = "Credenciamento";

      // Extract número
      let numero = "";
      const numMatch = title.match(/(?:PE|PP|TP|CC|DL|IN)\s*[nN]?[°ºo.]?\s*(\d+[\/.]\d+)/);
      if (numMatch) numero = numMatch[0];

      // Skip results with generic portal URLs
      const isGeneric = isGenericPortalUrl(url);

      resultados.push({
        titulo: (title || description).substring(0, 500),
        orgao: portal.nome,
        modalidade,
        status: "Publicado",
        valor_estimado: valor,
        uf: null,
        municipio: null,
        data_abertura: null,
        data_publicacao: null,
        portal: portal.nome,
        url: isGeneric ? "" : url,
        numero,
        fonte_real: !isGeneric,
        tem_download: !isGeneric,
        url_portal_generico: isGeneric,
        scrape_content: markdown.substring(0, 1000),
      });
    }
  } catch (e) {
    console.error(`Firecrawl ${portalId} error:`, e);
  }
  return resultados;
}

// ── Firecrawl scrape a specific portal page ───────────────────────────────
async function scrapePortalPage(
  url: string,
  firecrawlKey: string
): Promise<{ links: string[]; markdown: string } | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }

    const data = await response.json();
    return {
      links: data.data?.links || [],
      markdown: data.data?.markdown || "",
    };
  } catch (e) {
    console.error("Scrape error:", e);
    return null;
  }
}

// ── AI Analysis of results ────────────────────────────────────────────────
async function analisarComIA(
  resultados: any[],
  userQuery: string,
  apiKey: string
): Promise<{ analise: string; resultados_ranqueados: any[] }> {
  const resumo = resultados.slice(0, 20).map((r, i) =>
    `${i + 1}. [${r.portal}] ${r.titulo} | ${r.orgao} | ${r.modalidade} | ${r.valor_estimado ? `R$ ${r.valor_estimado.toLocaleString("pt-BR")}` : "Valor N/I"} | ${r.uf || "UF N/I"}`
  ).join("\n");

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em licitações públicas brasileiras. Analise os resultados e forneça:
1. Um resumo executivo dos editais encontrados
2. Destaques relevantes (maiores valores, prazos próximos)
3. Recomendações para o licitante
Responda em português, de forma objetiva e profissional. Use markdown.`,
          },
          {
            role: "user",
            content: `Consulta do usuário: "${userQuery}"\n\nResultados encontrados (${resultados.length} total):\n${resumo}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResp.ok) {
      console.error("AI analysis error:", aiResp.status);
      return { analise: "", resultados_ranqueados: resultados };
    }

    const aiData = await aiResp.json();
    const analise = aiData.choices?.[0]?.message?.content || "";

    return { analise, resultados_ranqueados: resultados };
  } catch (e) {
    console.error("AI error:", e);
    return { analise: "", resultados_ranqueados: resultados };
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      query,
      uf,
      modalidade,
      portais = ["pncp"],
      data_inicio,
      data_fim,
      cnpj,
      com_analise_ia = true,
      limite = 30,
    } = body;

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Informe um termo de busca" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Busca IA: query="${query}" uf=${uf} portais=${portais.join(",")} modalidade=${modalidade}`);

    // ── Run searches in parallel ──────────────────────────────────────
    const promises: Promise<any[]>[] = [];
    const portalLabels: string[] = [];

    // Always search PNCP (real API)
    if (portais.includes("pncp") || portais.includes("todos")) {
      promises.push(buscarPNCP({ query, uf, modalidade, dataInicio: data_inicio, dataFim: data_fim, cnpj, limite }));
      portalLabels.push("PNCP");
    }

    // Firecrawl scraping for other portals
    if (FIRECRAWL_API_KEY) {
      const scrapePortals = portais.includes("todos")
        ? Object.keys(PORTAIS_SCRAPE)
        : portais.filter((p: string) => p !== "pncp" && PORTAIS_SCRAPE[p]);

      for (const pid of scrapePortals) {
        promises.push(buscarComFirecrawl(pid, query, FIRECRAWL_API_KEY));
        portalLabels.push(PORTAIS_SCRAPE[pid]?.nome || pid);
      }
    }

    const results = await Promise.all(promises);
    let allItems = results.flat();

    // Deduplicate by title similarity
    const seen = new Set<string>();
    allItems = allItems.filter((r) => {
      const key = `${r.titulo.substring(0, 50).toLowerCase()}_${r.orgao.substring(0, 20).toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`Total: ${allItems.length} resultados de ${portalLabels.join(", ")}`);

    // ── AI Analysis ───────────────────────────────────────────────────
    let analise = "";
    if (com_analise_ia && LOVABLE_API_KEY && allItems.length > 0) {
      const resultado = await analisarComIA(allItems, query, LOVABLE_API_KEY);
      analise = resultado.analise;
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultados: allItems.slice(0, limite),
        total: allItems.length,
        analise_ia: analise,
        portais_consultados: portalLabels,
        query,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Busca IA error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro na busca" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
