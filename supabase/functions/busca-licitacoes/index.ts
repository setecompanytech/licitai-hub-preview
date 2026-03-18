import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODALIDADES_PNCP: Record<string, number> = {
  "leilão": 1, "diálogo competitivo": 2, "concurso": 3,
  "concorrência": 4, "concorrência - eletrônica": 5,
  "pregão": 6, "pregão eletrônico": 6, "pregão - eletrônico": 6,
  "dispensa de licitação": 7, "inexigibilidade": 8,
  "manifestação de interesse": 9, "pré-qualificação": 10,
  "credenciamento": 11, "leilão - eletrônico": 12, "concurso - eletrônico": 13,
};

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function mapPncpItem(item: any, uf: string | null) {
  const cnpj = item.orgaoEntidade?.cnpj || "";
  const ano = item.anoCompra || "";
  const seq = item.sequencialCompra || "";
  const urlPncp = cnpj && ano && seq
    ? `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}` : "";
  
  // Determine esfera from orgaoEntidade
  const esferaId = item.orgaoEntidade?.esferaId || item.orgaoEntidade?.poderId || null;
  let esferaNome: string | null = null;
  if (item.orgaoEntidade?.esferaNome) {
    esferaNome = item.orgaoEntidade.esferaNome;
  } else if (esferaId) {
    const esferaMap: Record<string, string> = { "F": "Federal", "E": "Estadual", "M": "Municipal", "D": "Distrital" };
    esferaNome = esferaMap[esferaId] || null;
  }

  return {
    numero: item.numeroCompra || item.numeroControlePNCP || "-",
    orgao: item.orgaoEntidade?.razaoSocial || "-",
    objeto: item.objetoCompra || "-",
    modalidade: item.modalidadeNome || "Pregão - Eletrônico",
    status: item.situacaoCompraNome || "Publicado",
    valor_estimado: item.valorTotalEstimado || item.valorTotalHomologado || null,
    uf: item.unidadeOrgao?.ufSigla || uf || null,
    municipio: item.unidadeOrgao?.municipioNome || null,
    data_abertura: item.dataEncerramentoProposta?.split("T")[0] || item.dataAberturaProposta?.split("T")[0] || null,
    data_publicacao: item.dataPublicacaoPncp?.split("T")[0] || null,
    portal: "PNCP",
    url: item.linkSistemaOrigem || urlPncp,
    pncpNumero: item.numeroControlePNCP || null,
    cnpjOrgao: cnpj || null,
    anoCompra: ano || null,
    sequencialCompra: seq || null,
    isMock: false,
    // Campos adicionais para filtros
    esferaNome: esferaNome,
    tipoInstrumentoNome: item.tipoInstrumentoConvocatorioNome || null,
    unidadeOrgao: item.unidadeOrgao?.nomeUnidade || null,
    municipioIbge: item.unidadeOrgao?.codigoIbge || null,
  };
}

async function fetchPncp(params: URLSearchParams, label: string): Promise<any[]> {
  const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
  console.log(`PNCP API (${label}): ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const t = await response.text();
      console.log(`PNCP ${label} error ${response.status}: ${t.substring(0, 300)}`);
      return [];
    }
    const data = await response.json();
    console.log(`PNCP ${label}: ${(data.data || []).length} resultados`);
    return data.data || [];
  } catch (e) {
    clearTimeout(timeout);
    console.log(`PNCP ${label} timeout/error:`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await requireAuth(req, { functionName: "busca-licitacoes", maxRequests: 30, windowMinutes: 5 });
    } catch (authResp) {
      if (authResp instanceof Response) return authResp;
      throw authResp;
    }

    const body = await req.json();
    const { query, uf, modalidade, pagina, portal, dataInicio, dataFim, mural, cnpjOrgao } = body;
    const allItems: any[] = [];

    try {
      const now = new Date();
      const dataInicialDate = dataInicio ? new Date(dataInicio) : new Date(now.getTime() - 90 * 86400000);
      const dataFinalDate = dataFim ? new Date(dataFim) : new Date(now.getTime() + 90 * 86400000);
      const cleanCnpj = cnpjOrgao ? cnpjOrgao.replace(/[.\-\/\s]/g, "") : null;

      if (cleanCnpj && cleanCnpj.length >= 6) {
        // ── Search by CNPJ/UASG ──
        const params = new URLSearchParams();
        params.set("dataInicial", formatDatePNCP(dataInicialDate));
        params.set("dataFinal", formatDatePNCP(dataFinalDate));
        params.set("pagina", String(pagina || 1));
        params.set("tamanhoPagina", "50");
        params.set("cnpj", cleanCnpj);
        if (uf) params.set("uf", uf);
        if (query) params.set("q", query.substring(0, 100));
        if (modalidade) {
          const cod = MODALIDADES_PNCP[modalidade.toLowerCase().trim()];
          if (cod) params.set("codigoModalidadeContratacao", String(cod));
        }
        const results = await fetchPncp(params, `CNPJ=${cleanCnpj}`);
        allItems.push(...results.map((i: any) => mapPncpItem(i, uf)));
      } else {
        // ── Standard multi-modalidade search ──
        const modalidades = mural
          ? [6, 4, 5, 8, 7, 11]
          : [modalidade ? (MODALIDADES_PNCP[modalidade.toLowerCase().trim()] || 6) : 6];

        const fetches = modalidades.map((cod) => {
          const params = new URLSearchParams();
          params.set("dataInicial", formatDatePNCP(dataInicialDate));
          params.set("dataFinal", formatDatePNCP(dataFinalDate));
          params.set("pagina", String(pagina || 1));
          params.set("tamanhoPagina", mural ? "50" : "20");
          params.set("codigoModalidadeContratacao", String(cod));
          if (uf) params.set("uf", uf);
          if (query) params.set("q", query.substring(0, 100));
          return fetchPncp(params, `mod=${cod}`);
        });

        const results = await Promise.allSettled(fetches);
        for (const result of results) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value.map((i: any) => mapPncpItem(i, uf)));
            if (mural && allItems.length >= 50) break;
          }
        }
      }
    } catch (e) {
      console.log("PNCP API error:", e);
    }

    // ── Firecrawl for non-PNCP portals ──
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (FIRECRAWL_API_KEY && portal && portal !== "all" && portal !== "pncp") {
      try {
        const searchQuery = `${query || "licitação"} edital`;
        console.log(`Firecrawl search for portal ${portal}: ${searchQuery}`);
        const fcResp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, limit: 10, lang: "pt", country: "br", scrapeOptions: { formats: ["markdown"] } }),
        });
        if (fcResp.ok) {
          const fcData = await fcResp.json();
          for (const r of (fcData.data || [])) {
            let valor: number | null = null;
            const valorMatch = ((r.markdown || "") + (r.description || "")).match(/R\$\s*([\d.,]+)/);
            if (valorMatch) { valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", ".")); if (isNaN(valor)) valor = null; }
            allItems.push({
              numero: "", orgao: (r.title || "").substring(0, 100) || portal,
              objeto: (r.title || r.description || "").substring(0, 500),
              modalidade: "Pregão Eletrônico", status: "Publicado", valor_estimado: valor,
              uf: uf || null, municipio: null, data_abertura: null, portal,
              url: r.url || "", pncpNumero: null, cnpjOrgao: null, isMock: false,
            });
          }
        } else { await fcResp.text(); }
      } catch (e) { console.error(`Firecrawl ${portal} error:`, e); }
    }

    const itemsComId = allItems.map((item, idx) => ({ ...item, id: `busca-${idx}` }));
    return new Response(JSON.stringify({
      items: itemsComId, total: itemsComId.length, pagina: pagina || 1,
      fonte: "PNCP", portais_consultados: ["PNCP"],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Licitacoes search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na busca" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});