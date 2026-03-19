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

// All mural modalidades for broad search
const MURAL_MODALIDADES = [6, 4, 5, 8, 7, 11];

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
    data_abertura: item.dataAberturaProposta || null,
    data_encerramento: item.dataEncerramentoProposta || null,
    data_publicacao: item.dataPublicacaoPncp || null,
    portal: "PNCP",
    url: item.linkSistemaOrigem || urlPncp,
    pncpNumero: item.numeroControlePNCP || null,
    cnpjOrgao: cnpj || null,
    anoCompra: ano || null,
    sequencialCompra: seq || null,
    isMock: false,
    esferaNome: esferaNome,
    tipoInstrumentoNome: item.tipoInstrumentoConvocatorioNome || null,
    unidadeOrgao: item.unidadeOrgao?.nomeUnidade || null,
    municipioIbge: item.unidadeOrgao?.codigoIbge || null,
    codigoUnidade: item.unidadeOrgao?.codigoUnidade || null,
  };

async function fetchPncp(params: URLSearchParams, label: string): Promise<any[]> {
  const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
  console.log(`PNCP API (${label}): ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
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
    console.log(`PNCP ${label}: ${(data.data || []).length} resultados de ${data.totalRegistros || '?'} total`);
    return data.data || [];
  } catch (e) {
    clearTimeout(timeout);
    console.log(`PNCP ${label} timeout/error:`, e);
    return [];
  }
}

// Fetch multiple pages from PNCP for a single modalidade to get comprehensive results
async function fetchPncpAllPages(baseParams: URLSearchParams, label: string, maxPages = 5): Promise<any[]> {
  const allResults: any[] = [];
  
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams(baseParams);
    params.set("pagina", String(page));
    
    const results = await fetchPncp(params, `${label} pg${page}`);
    allResults.push(...results);
    
    // PNCP max page size is 50; if fewer, we've reached the end
    if (results.length < 50) break;
  }
  
  return allResults;
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
      const dataInicialDate = dataInicio ? new Date(dataInicio) : new Date(now.getTime() - 30 * 86400000);
      const dataFinalDate = dataFim ? new Date(dataFim) : new Date(now.getTime() + 30 * 86400000);
      const cleanCnpj = cnpjOrgao ? cnpjOrgao.replace(/[.\-\/\s]/g, "") : null;
      const userFilteredByDate = !!(dataInicio || dataFim);

      // Resolve modalidade code from user input
      const userModalidadeCod = modalidade
        ? (MODALIDADES_PNCP[modalidade.toLowerCase().trim()] || null)
        : null;

      // Detect input type: CNPJ (14 digits), CPF (11 digits), or UASG (6 digits)
      const isCnpjValido = cleanCnpj && (cleanCnpj.length === 14 || cleanCnpj.length === 11);
      const isUasg = cleanCnpj && cleanCnpj.length === 6 && /^\d{6}$/.test(cleanCnpj);
      
      if (isCnpjValido) {
        // ── Search by CNPJ ──
        const params = new URLSearchParams();
        params.set("dataInicial", formatDatePNCP(dataInicialDate));
        params.set("dataFinal", formatDatePNCP(dataFinalDate));
        params.set("pagina", String(pagina || 1));
        params.set("tamanhoPagina", "50");
        params.set("cnpj", cleanCnpj);
        if (uf) params.set("uf", uf);
        if (query) params.set("q", query.substring(0, 100));
        if (userModalidadeCod) params.set("codigoModalidadeContratacao", String(userModalidadeCod));
        const results = await fetchPncp(params, `CNPJ=${cleanCnpj}`);
        allItems.push(...results.map((i: any) => mapPncpItem(i, uf)));
        
        if (allItems.length === 0) {
          console.log(`CNPJ ${cleanCnpj} retornou 0 resultados, tentando busca normal...`);
        }
      }
      
      // Normal search (also handles UASG - post-filtered by codigoUnidade)
      if (!isCnpjValido || allItems.length === 0) {
        // ── Determine which modalidades to search ──
        // If user selected a specific modalidade, respect it even in mural mode
        const modalidades = userModalidadeCod
          ? [userModalidadeCod]
          : (mural ? MURAL_MODALIDADES : [6]);

        console.log(`Buscando modalidades: ${modalidades.join(', ')} | mural=${mural} | userMod=${modalidade || 'none'}`);

        const fetches = modalidades.map((cod) => {
          const params = new URLSearchParams();
          params.set("dataInicial", formatDatePNCP(dataInicialDate));
          params.set("dataFinal", formatDatePNCP(dataFinalDate));
          params.set("tamanhoPagina", "50");
          params.set("codigoModalidadeContratacao", String(cod));
          if (uf) params.set("uf", uf);
          if (query) params.set("q", query.substring(0, 100));
          
          // For single modalidade search, support pagination across pages
          if (modalidades.length === 1) {
            return fetchPncpAllPages(params, `mod=${cod}`, 3);
          } else {
            // For multi-modalidade (mural without filter), fetch page 1 with large page size
            params.set("pagina", String(pagina || 1));
            return fetchPncp(params, `mod=${cod}`);
          }
        });

        const results = await Promise.allSettled(fetches);
        for (const result of results) {
          if (result.status === "fulfilled") {
            allItems.push(...result.value.map((i: any) => mapPncpItem(i, uf)));
          }
        }
      }

      // ── Deduplicate by CNPJ + ano + sequencial ──
      const seen = new Set<string>();
      for (let idx = allItems.length - 1; idx >= 0; idx--) {
        const item = allItems[idx];
        const key = item.cnpjOrgao && item.anoCompra && item.sequencialCompra
          ? `${item.cnpjOrgao}-${item.anoCompra}-${item.sequencialCompra}`
          : null;
        if (key) {
          if (seen.has(key)) {
            allItems.splice(idx, 1);
          } else {
            seen.add(key);
          }
        }
      }

      // ── Post-processing: filter by proposal dates when user defined date filters ──
      if (userFilteredByDate) {
        const inicioMs = dataInicio ? new Date(dataInicio).getTime() : 0;
        const fimMs = dataFim ? new Date(dataFim + "T23:59:59").getTime() : Infinity;

        for (let idx = allItems.length - 1; idx >= 0; idx--) {
          const item = allItems[idx];
          const aberturaStr = item.data_abertura || item.data_publicacao;
          const encerramentoStr = item.data_encerramento;
          
          let dentroJanela = true;

          if (dataInicio && aberturaStr) {
            const aberturaDate = new Date(aberturaStr).getTime();
            if (aberturaDate < inicioMs - 7 * 86400000) dentroJanela = false;
          }

          if (dataFim && encerramentoStr) {
            const encerramentoDate = new Date(encerramentoStr).getTime();
            if (encerramentoDate > fimMs + 7 * 86400000) dentroJanela = false;
          }

          if (!encerramentoStr && aberturaStr) {
            const aberturaDate = new Date(aberturaStr).getTime();
            const agora = now.getTime();
            if (agora - aberturaDate > 60 * 86400000) dentroJanela = false;
          }

          if (!dentroJanela) {
            allItems.splice(idx, 1);
          }
        }
        console.log(`Pós-filtro temporal: ${allItems.length} resultados dentro da janela`);
      }

      // ── Default filter: remove procurements with encerramento > 60 days ago ──
      const limiteObsoleto = now.getTime() - 60 * 86400000;
      for (let idx = allItems.length - 1; idx >= 0; idx--) {
        const enc = allItems[idx].data_encerramento;
        if (enc) {
          const encDate = new Date(enc).getTime();
          if (encDate < limiteObsoleto) {
            allItems.splice(idx, 1);
          }
        }
      }

      console.log(`Total final após filtros: ${allItems.length} resultados`);
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
