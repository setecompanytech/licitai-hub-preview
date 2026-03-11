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
  // Estaduais
  "https://www.comprasnet.ba.gov.br",
  "https://www.comprasnet.ba.gov.br/",
  "https://www.portalcompras.ce.gov.br",
  "https://www.portalcompras.ce.gov.br/",
  "https://peintegrado.pe.gov.br",
  "https://peintegrado.pe.gov.br/",
  "https://compras.mg.gov.br",
  "https://compras.mg.gov.br/",
  "https://www.comprasnet.go.gov.br",
  "https://www.comprasnet.go.gov.br/",
  "https://www.comprasparana.pr.gov.br",
  "https://www.comprasparana.pr.gov.br/",
  "https://compras.rs.gov.br",
  "https://compras.rs.gov.br/",
  "https://portaldecompras.sc.gov.br",
  "https://portaldecompras.sc.gov.br/",
  "https://compras.es.gov.br",
  "https://compras.es.gov.br/",
  "https://www.compras.df.gov.br",
  "https://www.compras.df.gov.br/",
  "https://aquisicoes.sad.mt.gov.br",
  "https://aquisicoes.sad.mt.gov.br/",
  "https://www.centraldecompras.ms.gov.br",
  "https://www.centraldecompras.ms.gov.br/",
  "https://www.bbmnet.com.br",
  "https://www.bbmnet.com.br/",
  "https://comprasbr.com.br",
  "https://comprasbr.com.br/",
  "https://licitar.digital",
  "https://licitar.digital/",
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

const PORTAIS_SCRAPE: Record<string, { nome: string; searchUrl: (q: string) => string; searchHost: string }> = {
  // ── Plataformas nacionais ──
  bnc: {
    nome: "BNC - Bolsa Nacional de Compras",
    searchUrl: (q) => `https://bnc.org.br/sistema/licitacoes?q=${encodeURIComponent(q)}`,
    searchHost: "bnc.org.br",
  },
  bll: {
    nome: "BLL Compras",
    searchUrl: (q) => `https://bllcompras.com/ProcessosList?q=${encodeURIComponent(q)}`,
    searchHost: "bllcompras.com",
  },
  portalcompras: {
    nome: "Portal de Compras Públicas",
    searchUrl: (q) => `https://www.portaldecompraspublicas.com.br/processos?q=${encodeURIComponent(q)}`,
    searchHost: "portaldecompraspublicas.com.br",
  },
  licitanet: {
    nome: "Licitanet",
    searchUrl: (q) => `https://www.licitanet.com.br/licitacoes?q=${encodeURIComponent(q)}`,
    searchHost: "licitanet.com.br",
  },
  licitacoese: {
    nome: "Licitações-e (BB)",
    searchUrl: (q) => `https://licitacoes-e2.bb.com.br/aop-inter-estatico/`,
    searchHost: "licitacoes-e2.bb.com.br",
  },
  comprasnet: {
    nome: "Compras Governamentais",
    searchUrl: (q) => `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras`,
    searchHost: "cnetmobile.estaleiro.serpro.gov.br",
  },
  bbmnet: {
    nome: "BBMNet Licitações",
    searchUrl: (q) => `https://www.bbmnet.com.br/licitacoes?q=${encodeURIComponent(q)}`,
    searchHost: "bbmnet.com.br",
  },
  comprasbr: {
    nome: "ComprasBR",
    searchUrl: (q) => `https://comprasbr.com.br/licitacoes?q=${encodeURIComponent(q)}`,
    searchHost: "comprasbr.com.br",
  },
  licitardigital: {
    nome: "Licitar Digital",
    searchUrl: (q) => `https://licitar.digital/licitacoes?q=${encodeURIComponent(q)}`,
    searchHost: "licitar.digital",
  },
  // ── Portais estaduais ──
  becsp: {
    nome: "BEC/SP",
    searchUrl: (q) => `https://www.bec.sp.gov.br/BECSP/Aspx/PregaoEletronicoConsulta.aspx`,
    searchHost: "bec.sp.gov.br",
  },
  comprasrj: {
    nome: "Compras Públicas RJ",
    searchUrl: (q) => `https://www.compras.rj.gov.br/Portal-Licitacao/Busca`,
    searchHost: "compras.rj.gov.br",
  },
  banparanet: {
    nome: "Banparanet PA",
    searchUrl: (q) => `https://cotacao.banpara.b.br/portal/Mural.aspx`,
    searchHost: "cotacao.banpara.b.br",
  },
  comprasba: {
    nome: "ComprasNet Bahia",
    searchUrl: (q) => `https://www.comprasnet.ba.gov.br/`,
    searchHost: "comprasnet.ba.gov.br",
  },
  comprasce: {
    nome: "Portal Compras Ceará",
    searchUrl: (q) => `https://www.portalcompras.ce.gov.br/`,
    searchHost: "portalcompras.ce.gov.br",
  },
  compraspe: {
    nome: "PE Integrado",
    searchUrl: (q) => `https://peintegrado.pe.gov.br/`,
    searchHost: "peintegrado.pe.gov.br",
  },
  comprasmg: {
    nome: "Compras MG",
    searchUrl: (q) => `https://compras.mg.gov.br/`,
    searchHost: "compras.mg.gov.br",
  },
  comprasgo: {
    nome: "ComprasNet Goiás",
    searchUrl: (q) => `https://www.comprasnet.go.gov.br/`,
    searchHost: "comprasnet.go.gov.br",
  },
  compraspr: {
    nome: "Compras Paraná",
    searchUrl: (q) => `https://www.comprasparana.pr.gov.br/`,
    searchHost: "comprasparana.pr.gov.br",
  },
  comprasrs: {
    nome: "Compras RS",
    searchUrl: (q) => `https://compras.rs.gov.br/`,
    searchHost: "compras.rs.gov.br",
  },
  comprassc: {
    nome: "Compras SC",
    searchUrl: (q) => `https://portaldecompras.sc.gov.br/`,
    searchHost: "portaldecompras.sc.gov.br",
  },
  comprasam: {
    nome: "e-Compras Amazonas",
    searchUrl: (q) => `https://sistemas.sefaz.am.gov.br/e-compras/`,
    searchHost: "e-compras.am.gov.br",
  },
  comprases: {
    nome: "Compras ES",
    searchUrl: (q) => `https://compras.es.gov.br/`,
    searchHost: "compras.es.gov.br",
  },
  comprasdf: {
    nome: "e-Compras DF",
    searchUrl: (q) => `https://www.compras.df.gov.br/`,
    searchHost: "compras.df.gov.br",
  },
  comprasmt: {
    nome: "Compras MT",
    searchUrl: (q) => `https://aquisicoes.sad.mt.gov.br/`,
    searchHost: "aquisicoes.sad.mt.gov.br",
  },
  comprasms: {
    nome: "Compras MS",
    searchUrl: (q) => `https://www.centraldecompras.ms.gov.br/`,
    searchHost: "centraldecompras.ms.gov.br",
  },
  comprasto: {
    nome: "Compras Tocantins",
    searchUrl: (q) => `https://www.sgc.to.gov.br/`,
    searchHost: "sgc.to.gov.br",
  },
  comprasma: {
    nome: "Compras Maranhão",
    searchUrl: (q) => `https://www.compras.ma.gov.br/`,
    searchHost: "compras.ma.gov.br",
  },
  comprasro: {
    nome: "ComprasNet Rondônia",
    searchUrl: (q) => `https://comprasnet.sistemas.ro.gov.br/`,
    searchHost: "comprasnet.sistemas.ro.gov.br",
  },
};

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ── Relevance filter ──────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
}

function calcularRelevancia(texto: string, query: string): number {
  if (!texto || !query) return 0;
  const textoNorm = normalizeText(texto);
  const queryNorm = normalizeText(query);

  // Exact phrase match = perfect score
  if (textoNorm.includes(queryNorm)) return 1.0;

  const stopWords = new Set([
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "para", "por", "com", "sem", "que", "uma", "uns", "um", "ao", "aos",
    "pela", "pelo", "entre", "sobre", "ate", "como", "mais", "este",
    "esta", "esse", "essa", "licitacao", "edital", "pregao", "eletronico",
    "aquisicao", "contratacao", "servico", "servicos", "fornecimento",
    "registro", "precos", "preco", "ata", "objeto",
  ]);
  const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  if (queryWords.length === 0) return 0.5; // All stop words — can't meaningfully filter

  let matched = 0;
  // Also check partial/stem matches (e.g. "alimenticio" matches "alimenticios")
  for (const word of queryWords) {
    const stem = word.length > 5 ? word.substring(0, word.length - 1) : word;
    if (textoNorm.includes(word) || textoNorm.includes(stem)) matched++;
  }

  const ratio = matched / queryWords.length;

  // For short queries (1-2 meaningful words), ALL words must match
  if (queryWords.length <= 2) {
    return matched === queryWords.length ? 1.0 : 0;
  }

  // For longer queries (3+ words), at least 60% must match
  return ratio >= 0.6 ? ratio : 0;
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
  skipRelevanceFilter?: boolean;
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

  // Request more to allow filtering
  const fetchLimit = Math.min((params.limite || 30) * 3, 100);

  for (const mod of modalidades) {
    try {
      const searchParams = new URLSearchParams({
        dataInicial,
        dataFinal,
        codigoModalidadeContratacao: mod,
        pagina: "1",
        tamanhoPagina: String(fetchLimit),
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

        const objetoCompra = item.objetoCompra || "";
        const orgaoNome = item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || "";

        // ── RELEVANCE FILTER: skip items that don't match the query ──
        const relevanciaObjeto = calcularRelevancia(objetoCompra, params.query);
        const relevanciaOrgao = calcularRelevancia(orgaoNome, params.query);
        const relevancia = Math.max(relevanciaObjeto, relevanciaOrgao);

        if (relevancia <= 0) {
          continue; // Skip irrelevant results — strict matching
        }

        const cnpjOrgao = item.orgaoEntidade?.cnpj || "";
        const anoCompra = item.anoCompra || "";
        const seqCompra = item.sequencialCompra || "";
        let urlPncp = "";
        if (cnpjOrgao && anoCompra && seqCompra) {
          urlPncp = `https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${seqCompra}`;
        }

        resultados.push({
          titulo: objetoCompra.substring(0, 500),
          orgao: orgaoNome || "Órgão",
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
          _relevancia: relevancia,
        });
      }
    } catch (e) {
      console.error(`PNCP mod=${mod}:`, e);
    }
  }

  // Sort by relevance
  resultados.sort((a, b) => (b._relevancia || 0) - (a._relevancia || 0));

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
    const searchQuery = `${query} licitação edital site:${portal.searchHost}`;
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

      // ── RELEVANCE FILTER for Firecrawl results ──
      const relevancia = Math.max(
        calcularRelevancia(title, query),
        calcularRelevancia(description, query),
        calcularRelevancia(markdown.substring(0, 500), query)
      );
      if (relevancia <= 0) continue; // Skip irrelevant — strict matching

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

// ── Enrich Firecrawl results with PNCP download data ─────────────────────
async function enrichWithPncpData(items: any[]): Promise<any[]> {
  const needsEnrichment = items.filter(
    (r) => !r.cnpj_orgao && !r.pncp_numero && r.titulo && r.portal !== "PNCP"
  );
  if (needsEnrichment.length === 0) return items;

  console.log(`Enriching ${needsEnrichment.length} Firecrawl results with PNCP data`);

  // Group by keywords to minimize API calls
  const keywords = new Set<string>();
  for (const r of needsEnrichment) {
    const words = (r.titulo || "")
      .replace(/(?:aviso|edital|pregão|licitação|homologação|registro|preços?)[- ]*/gi, "")
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 4)
      .slice(0, 3);
    if (words.length > 0) keywords.add(words.join(" "));
  }

  // Search PNCP for each keyword set (max 3 queries to avoid slowdown)
  const pncpResults: any[] = [];
  const keywordArr = Array.from(keywords).slice(0, 3);

  for (const kw of keywordArr) {
    try {
      const now = new Date();
      const dataInicial = formatDatePNCP(new Date(now.getTime() - 180 * 86400000));
      const dataFinal = formatDatePNCP(new Date(now.getTime() + 90 * 86400000));

      for (const mod of ["6", "8", "5"]) {
        const params = new URLSearchParams({
          dataInicial,
          dataFinal,
          codigoModalidadeContratacao: mod,
          pagina: "1",
          tamanhoPagina: "15",
          q: kw.substring(0, 80),
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(
          `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`,
          { headers: FETCH_HEADERS, signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!resp.ok) { await resp.text(); continue; }
        const data = await resp.json();
        const pncpItems = data.data || [];
        for (const p of pncpItems) {
          pncpResults.push({
            objeto: (p.objetoCompra || "").toLowerCase(),
            orgao: (p.orgaoEntidade?.razaoSocial || "").toLowerCase(),
            cnpj: p.orgaoEntidade?.cnpj || "",
            ano: p.anoCompra || "",
            seq: p.sequencialCompra || "",
            pncpNumero: p.numeroControlePNCP || "",
            url: p.linkSistemaOrigem || "",
          });
        }
        if (pncpItems.length > 0) break; // Found results for this modalidade
      }
    } catch (e) {
      console.error("PNCP enrichment error:", e);
    }
  }

  if (pncpResults.length === 0) return items;
  console.log(`PNCP enrichment: found ${pncpResults.length} potential matches`);

  // Match Firecrawl results with PNCP results by title/object similarity
  for (const item of items) {
    if (item.cnpj_orgao || item.pncp_numero || item.portal === "PNCP") continue;

    const titleLower = (item.titulo || "").toLowerCase();
    const titleWords = titleLower.split(/\s+/).filter((w: string) => w.length > 4);

    let bestMatch: any = null;
    let bestScore = 0;

    for (const pncp of pncpResults) {
      let score = 0;
      for (const word of titleWords) {
        if (pncp.objeto.includes(word)) score++;
      }
      // Normalize by word count
      const normalized = titleWords.length > 0 ? score / titleWords.length : 0;
      if (normalized > bestScore && normalized >= 0.3) {
        bestScore = normalized;
        bestMatch = pncp;
      }
    }

    if (bestMatch) {
      item.cnpj_orgao = bestMatch.cnpj;
      item.ano_compra = bestMatch.ano;
      item.seq_compra = bestMatch.seq;
      item.pncp_numero = bestMatch.pncpNumero;
      item.tem_download = true;
      item.fonte_real = true;
      // Keep original URL if specific, otherwise use PNCP
      if (!item.url || item.url_portal_generico) {
        item.url = `https://pncp.gov.br/app/editais/${bestMatch.cnpj}/${bestMatch.ano}/${bestMatch.seq}`;
      }
      console.log(`Enriched: "${item.titulo.substring(0, 50)}" → PNCP ${bestMatch.cnpj}/${bestMatch.ano}/${bestMatch.seq}`);
    }
  }

  return items;
}

// ── AI Analysis of results ────────────────────────────────────────────────
async function analisarComIA(
  resultados: any[],
  userQuery: string,
  apiKey: string
): Promise<{ analise: string; resultados_ranqueados: any[] }> {
  const resumo = resultados.slice(0, 20).map((r, i) =>
    `${i + 1}. [${r.portal}] ${r.titulo} | ${r.orgao} | ${r.modalidade} | ${r.valor_estimado ? `R$ ${r.valor_estimado.toLocaleString("pt-BR")}` : "Valor N/I"} | ${r.uf || "UF N/I"} | Download: ${r.download_disponivel ? "✅ Disponível" : "❌ Indisponível"}`
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
4. Alertas sobre editais sem download direto disponível (indicados com ❌) — oriente o usuário a acessar manualmente o portal nesses casos
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
      modo_cnae = false,
      cnaes = [],
    } = body;

    // In CNAE mode, we don't require a text query — we search by CNAE class codes
    if (!modo_cnae && (!query || query.trim().length < 2)) {
      return new Response(JSON.stringify({ error: "Informe um termo de busca" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchQuery = modo_cnae ? (cnaes.length > 0 ? cnaes[0] : query) : query;
    console.log(`Busca IA: query="${searchQuery}" uf=${uf} portais=${portais.join(",")} modalidade=${modalidade} modo_cnae=${modo_cnae}`);

    // ── In CNAE mode, use 30-day window ──
    const effectiveDataInicio = data_inicio || (modo_cnae ? new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0] : undefined);
    const effectiveDataFim = data_fim || (modo_cnae ? new Date().toISOString().split("T")[0] : undefined);
    const promises: Promise<any[]>[] = [];
    const portalLabels: string[] = [];

    // Portals that block direct download — PNCP is auto-included as fallback
    const PORTAIS_BLOQUEADOS = new Set(["licitacoese", "banparanet"]);
    const PORTAL_ALIASES: Record<string, string> = {
      "licitacoes-e": "licitacoese",
    };
    const temPortalBloqueado = portais.some((p: string) => {
      const mapped = PORTAL_ALIASES[p] || p;
      return PORTAIS_BLOQUEADOS.has(mapped);
    });

    // In CNAE mode, run multiple searches — one for each CNAE code
    if (modo_cnae && cnaes.length > 0) {
      for (const cnaeCode of cnaes.slice(0, 5)) {
        promises.push(buscarPNCP({
          query: cnaeCode,
          uf,
          modalidade,
          dataInicio: effectiveDataInicio,
          dataFim: effectiveDataFim,
          cnpj,
          limite: Math.ceil(limite / Math.min(cnaes.length, 5)),
          skipRelevanceFilter: true,
        }));
      }
      portalLabels.push("PNCP");
    } else if (portais.includes("pncp") || portais.includes("todos") || temPortalBloqueado) {
      // Always search PNCP (real API) — also auto-include when blocked portals are selected
      promises.push(buscarPNCP({ query: searchQuery, uf, modalidade, dataInicio: effectiveDataInicio, dataFim: effectiveDataFim, cnpj, limite }));
      portalLabels.push("PNCP");
      if (temPortalBloqueado && !portais.includes("pncp")) {
        console.log("PNCP auto-incluído como fallback para portais com acesso bloqueado");
      }
    }

    // Firecrawl scraping for other portals (skip in CNAE mode)
    if (FIRECRAWL_API_KEY && !modo_cnae) {
      const scrapePortals = portais.includes("todos")
        ? Object.keys(PORTAIS_SCRAPE)
        : portais
            .map((p: string) => PORTAL_ALIASES[p] || p)
            .filter((p: string) => p !== "pncp" && PORTAIS_SCRAPE[p]);

      for (const pid of scrapePortals) {
        promises.push(buscarComFirecrawl(pid, searchQuery, FIRECRAWL_API_KEY));
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

    // ── Enrich Firecrawl results with PNCP download data ──────────
    allItems = await enrichWithPncpData(allItems);

    // ── Classify download availability ──────────────────────────────
    for (const item of allItems) {
      if (item.portal === "PNCP" && item.cnpj_orgao && item.ano_compra && item.seq_compra) {
        item.download_disponivel = true;
        item.download_fonte = "PNCP";
      } else if (item.cnpj_orgao && item.ano_compra && item.seq_compra) {
        // Enriched from PNCP
        item.download_disponivel = true;
        item.download_fonte = "PNCP (enriquecido)";
      } else if (item.url && !item.url_portal_generico) {
        // Has a specific URL but no PNCP data — check if portal is blocked
        const portalKey = Object.keys(PORTAIS_SCRAPE).find(k => PORTAIS_SCRAPE[k].nome === item.portal);
        if (portalKey && PORTAIS_BLOQUEADOS.has(portalKey)) {
          item.download_disponivel = false;
          item.download_fonte = "Portal bloqueado (acesso manual)";
        } else {
          item.download_disponivel = true;
          item.download_fonte = item.portal;
        }
      } else {
        item.download_disponivel = false;
        item.download_fonte = "Indisponível";
      }
    }

    // ── Sort: prioritize items with download available ────────────
    allItems.sort((a, b) => {
      if (a.download_disponivel && !b.download_disponivel) return -1;
      if (!a.download_disponivel && b.download_disponivel) return 1;
      // Secondary: PNCP first, then enriched, then others
      if (a.portal === "PNCP" && b.portal !== "PNCP") return -1;
      if (a.portal !== "PNCP" && b.portal === "PNCP") return 1;
      return 0;
    });

    // ── AI Analysis ───────────────────────────────────────────────────
    let analise = "";
    if (com_analise_ia && LOVABLE_API_KEY && allItems.length > 0) {
      const resultado = await analisarComIA(allItems, query, LOVABLE_API_KEY);
      analise = resultado.analise;
    }

    const totalComDownload = allItems.filter(r => r.download_disponivel).length;
    const totalSemDownload = allItems.filter(r => !r.download_disponivel).length;

    return new Response(
      JSON.stringify({
        success: true,
        resultados: allItems.slice(0, limite),
        total: allItems.length,
        analise_ia: analise,
        portais_consultados: portalLabels,
        query,
        resumo_download: {
          com_download: totalComDownload,
          sem_download: totalSemDownload,
          pncp_fallback_ativo: temPortalBloqueado && !portais.includes("pncp"),
        },
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
