import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// All mural modalidades for broad search (all 13 PNCP codes)
const MURAL_MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

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
}

const PNCP_PAGE_SIZE = 50;
const PNCP_TIMEOUT_MS = 45000;
const PNCP_MAX_RETRIES = 2;
const PNCP_MODALIDADE_CONCURRENCY = 2;
const PNCP_PAGE_CONCURRENCY = 2;

type PncpPageResult = {
  items: any[];
  totalRegistros: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPncpPage(params: URLSearchParams, label: string, attempt = 1): Promise<PncpPageResult> {
  const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
  console.log(`PNCP API (${label}) [tentativa ${attempt}]: ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PNCP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const t = await response.text();
      console.log(`PNCP ${label} error ${response.status}: ${t.substring(0, 300)}`);
      return { items: [], totalRegistros: 0 };
    }

    const text = await response.text();
    if (!text || text.trim().length === 0) {
      console.log(`PNCP ${label}: empty response body`);
      return { items: [], totalRegistros: 0 };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (_parseErr) {
      console.log(`PNCP ${label}: JSON parse error, body length=${text.length}, preview=${text.substring(0, 200)}`);
      return { items: [], totalRegistros: 0 };
    }

    const items = Array.isArray(data.data) ? data.data : [];
    const totalRegistros = Number(data.totalRegistros || items.length || 0);
    console.log(`PNCP ${label}: ${items.length} resultados de ${totalRegistros || '?'} total`);
    return { items, totalRegistros };
  } catch (e) {
    clearTimeout(timeout);
    console.log(`PNCP ${label} timeout/error na tentativa ${attempt}:`, e);

    if (attempt < PNCP_MAX_RETRIES) {
      await wait(600 * attempt);
      return fetchPncpPage(params, label, attempt + 1);
    }

    return { items: [], totalRegistros: 0 };
  }
}

async function fetchPncpAllPages(baseParams: URLSearchParams, label: string, maxPages = 10): Promise<any[]> {
  const firstParams = new URLSearchParams(baseParams);
  firstParams.set("pagina", "1");

  const firstPage = await fetchPncpPage(firstParams, `${label} pg1`);
  const allResults: any[] = [...firstPage.items];
  const totalPages = Math.min(
    maxPages,
    Math.max(1, Math.ceil((firstPage.totalRegistros || firstPage.items.length) / PNCP_PAGE_SIZE)),
  );

  if (totalPages <= 1) return allResults;

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2);

  for (let i = 0; i < remainingPages.length; i += PNCP_PAGE_CONCURRENCY) {
    const pageBatch = remainingPages.slice(i, i + PNCP_PAGE_CONCURRENCY);
    const batchResults = await Promise.all(
      pageBatch.map(async (page) => {
        const params = new URLSearchParams(baseParams);
        params.set("pagina", String(page));
        return fetchPncpPage(params, `${label} pg${page}`);
      }),
    );

    for (const result of batchResults) {
      allResults.push(...result.items);
    }

    if (batchResults.every((result) => result.items.length === 0)) {
      console.log(`PNCP ${label}: lote sem resultados após a página ${pageBatch[pageBatch.length - 1]}, interrompendo paginação.`);
      break;
    }
  }

  return allResults;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }

  return results;
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
    const { query, uf, modalidade, pagina, portal, dataInicio, dataFim, mural, cnpjOrgao, municipio, useCache, persistCache } = body;
    const allItems: any[] = [];

    try {
      const now = new Date();
      const dataInicialDate = dataInicio ? new Date(dataInicio) : new Date(now.getTime() - 30 * 86400000);
      const dataFinalDate = dataFim ? new Date(dataFim) : new Date(now.getTime() + 30 * 86400000);
      const cleanCnpj = cnpjOrgao ? cnpjOrgao.replace(/[.\-\/\s]/g, "") : null;
      const userFilteredByDate = !!(dataInicio || dataFim);
      const cleanMunicipio = municipio ? municipio.trim().toLowerCase() : null;

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
          params.set("tamanhoPagina", String(PNCP_PAGE_SIZE));
        params.set("cnpj", cleanCnpj);
        if (uf) params.set("uf", uf);
        if (query) params.set("q", query.substring(0, 100));
        if (userModalidadeCod) params.set("codigoModalidadeContratacao", String(userModalidadeCod));
          const maxPagesCnpj = userFilteredByDate ? 20 : 10;
          const results = await fetchPncpAllPages(params, `CNPJ=${cleanCnpj}`, maxPagesCnpj);
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

        console.log(`Buscando modalidades: ${modalidades.join(', ')} | mural=${mural} | userMod=${modalidade || 'none'} | municipio=${cleanMunicipio || 'none'}`);

        // Fetch more pages when filtering by municipality or UASG (since API doesn't support server-side municipality filter)
        const needsDeepFetch = !!(cleanMunicipio || isUasg);

        // Run fetches in parallel batches to maximize coverage within Edge Function timeout
        const maxPages = needsDeepFetch
          ? 20
          : userModalidadeCod && uf
            ? 15
            : userModalidadeCod
              ? 12
              : uf
                ? 8
                : (modalidades.length <= 3 ? 8 : 3);

        const tasks = modalidades.map((cod) => async () => {
          const params = new URLSearchParams();
          params.set("dataInicial", formatDatePNCP(dataInicialDate));
          params.set("dataFinal", formatDatePNCP(dataFinalDate));
          params.set("tamanhoPagina", String(PNCP_PAGE_SIZE));
          params.set("codigoModalidadeContratacao", String(cod));
          if (uf) params.set("uf", uf);
          if (query) params.set("q", query.substring(0, 100));
          return fetchPncpAllPages(params, `mod=${cod}`, maxPages);
        });

        const results = await runWithConcurrency(tasks, PNCP_MODALIDADE_CONCURRENCY);
        for (const items of results) {
          if (items.length > 0) {
            allItems.push(...items.map((i: any) => mapPncpItem(i, uf)));
          }
        }
      }

      // ── UASG post-filter: filter by codigoUnidade when 6-digit UASG is provided ──
      if (isUasg && allItems.length > 0) {
        const beforeCount = allItems.length;
        const uasgFiltered = allItems.filter((item: any) => item.codigoUnidade === cleanCnpj);
        if (uasgFiltered.length > 0) {
          allItems.length = 0;
          allItems.push(...uasgFiltered);
          console.log(`UASG ${cleanCnpj} filtro: ${beforeCount} → ${allItems.length} resultados`);
        } else {
          console.log(`UASG ${cleanCnpj} não encontrado em codigoUnidade, mantendo ${allItems.length} resultados sem filtro UASG`);
        }
      }


      // ── Municipality post-filter: filter by municipioNome when municipality is provided ──
      if (cleanMunicipio && allItems.length > 0) {
        const beforeCount = allItems.length;
        const munFiltered = allItems.filter((item: any) => {
          const mun = (item.municipio || "").toLowerCase();
          return mun.includes(cleanMunicipio);
        });
        allItems.length = 0;
        allItems.push(...munFiltered);
        console.log(`Município "${cleanMunicipio}" filtro: ${beforeCount} → ${allItems.length} resultados`);
      }

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

    // ── Complement from cache table ──
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseServiceKey);

      // Build cache query
      let cacheQuery = sb.from("pncp_editais_cache").select("*");

      if (uf) cacheQuery = cacheQuery.eq("uf", uf);
      if (cleanCnpj) cacheQuery = cacheQuery.eq("cnpj_orgao", cleanCnpj);
      if (cleanMunicipio) cacheQuery = cacheQuery.ilike("municipio", `%${cleanMunicipio}%`);
      if (query) cacheQuery = cacheQuery.ilike("objeto", `%${query}%`);

      const userModalidadeCod2 = modalidade
        ? (MODALIDADES_PNCP[modalidade.toLowerCase().trim()] || null)
        : null;
      if (userModalidadeCod2) cacheQuery = cacheQuery.eq("modalidade_id", userModalidadeCod2);

      if (dataInicio) cacheQuery = cacheQuery.gte("data_publicacao_pncp", dataInicio);
      if (dataFim) cacheQuery = cacheQuery.lte("data_publicacao_pncp", dataFim + "T23:59:59");

      cacheQuery = cacheQuery.order("data_publicacao_pncp", { ascending: false }).limit(500);

      const { data: cacheItems } = await cacheQuery;

      if (cacheItems && cacheItems.length > 0) {
        // Deduplicate: only add items not already in allItems
        const existingKeys = new Set(
          allItems.map((i: any) => i.cnpjOrgao && i.anoCompra && i.sequencialCompra
            ? `${i.cnpjOrgao}-${i.anoCompra}-${i.sequencialCompra}` : null
          ).filter(Boolean)
        );

        let cacheAdded = 0;
        for (const ci of cacheItems) {
          const key = ci.cnpj_orgao && ci.ano_compra && ci.sequencial_compra
            ? `${ci.cnpj_orgao}-${ci.ano_compra}-${ci.sequencial_compra}` : null;
          if (key && existingKeys.has(key)) continue;
          if (key) existingKeys.add(key);

          allItems.push({
            numero: ci.numero_compra || "-",
            orgao: ci.orgao || "-",
            objeto: ci.objeto || "-",
            modalidade: ci.modalidade_nome || "Não informada",
            status: ci.situacao || "Publicado",
            valor_estimado: ci.valor_total_estimado,
            uf: ci.uf || null,
            municipio: ci.municipio || null,
            data_abertura: ci.data_abertura_proposta || null,
            data_encerramento: ci.data_encerramento_proposta || null,
            data_publicacao: ci.data_publicacao_pncp || null,
            portal: "PNCP",
            url: ci.url_pncp || null,
            pncpNumero: ci.numero_controle_pncp || null,
            cnpjOrgao: ci.cnpj_orgao || null,
            anoCompra: ci.ano_compra || null,
            sequencialCompra: ci.sequencial_compra || null,
            isMock: false,
            esferaNome: ci.esfera_id === "F" ? "Federal" : ci.esfera_id === "E" ? "Estadual" : ci.esfera_id === "M" ? "Municipal" : ci.esfera_id === "D" ? "Distrital" : null,
            tipoInstrumentoNome: ci.tipo_instrumento || null,
            unidadeOrgao: ci.unidade_orgao || null,
            codigoUnidade: ci.codigo_unidade || null,
          });
          cacheAdded++;
        }
        console.log(`Cache complementou com ${cacheAdded} editais adicionais`);
      }
    } catch (cacheErr) {
      console.log("Cache query error (non-fatal):", cacheErr);
    }

    // ── Persist to cache for instant future loads ──
    if (persistCache && allItems.length > 0) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sbAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const cacheRows = allItems
          .filter((i: any) => i.cnpjOrgao && i.anoCompra && i.sequencialCompra)
          .map((i: any) => ({
            pncp_id: `${i.cnpjOrgao}-${i.anoCompra}-${i.sequencialCompra}`,
            cnpj_orgao: i.cnpjOrgao,
            ano_compra: String(i.anoCompra),
            sequencial_compra: String(i.sequencialCompra),
            numero_compra: i.numero || null,
            orgao: i.orgao || null,
            objeto: i.objeto || null,
            modalidade_nome: i.modalidade || null,
            situacao: i.status || null,
            valor_total_estimado: i.valor_estimado || null,
            uf: i.uf || null,
            municipio: i.municipio || null,
            data_abertura_proposta: i.data_abertura || null,
            data_encerramento_proposta: i.data_encerramento || null,
            data_publicacao_pncp: i.data_publicacao || null,
            url_pncp: i.url || null,
            numero_controle_pncp: i.pncpNumero || null,
            esfera_id: i.esferaNome === 'Federal' ? 'F' : i.esferaNome === 'Estadual' ? 'E' : i.esferaNome === 'Municipal' ? 'M' : i.esferaNome === 'Distrital' ? 'D' : null,
            tipo_instrumento: i.tipoInstrumentoNome || null,
            unidade_orgao: i.unidadeOrgao || null,
            codigo_unidade: i.codigoUnidade || null,
            link_sistema_origem: i.url || null,
            updated_at: new Date().toISOString(),
          }));

        // Upsert in batches of 100
        for (let b = 0; b < cacheRows.length; b += 100) {
          const batch = cacheRows.slice(b, b + 100);
          await sbAdmin.from("pncp_editais_cache").upsert(batch, { onConflict: "pncp_id", ignoreDuplicates: false });
        }
        console.log(`Cache persistido: ${cacheRows.length} editais salvos/atualizados`);
      } catch (persistErr) {
        console.log("Cache persist error (non-fatal):", persistErr);
      }
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
