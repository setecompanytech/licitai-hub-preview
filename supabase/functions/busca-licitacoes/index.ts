import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PNCP modalidade codes
const MODALIDADES_PNCP: Record<string, number> = {
  "leilão": 1,
  "diálogo competitivo": 2,
  "concurso": 3,
  "concorrência": 4,
  "concorrência - eletrônica": 5,
  "pregão": 6,
  "pregão eletrônico": 6,
  "pregão - eletrônico": 6,
  "dispensa de licitação": 7,
  "inexigibilidade": 8,
  "manifestação de interesse": 9,
  "pré-qualificação": 10,
  "credenciamento": 11,
  "leilão - eletrônico": 12,
  "concurso - eletrônico": 13,
};

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
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

    // ── PNCP API (always real data) ──
    try {
      const now = new Date();
      const dataInicialDate = dataInicio ? new Date(dataInicio) : new Date(now.getTime() - 90 * 86400000);
      const dataFinalDate = dataFim ? new Date(dataFim) : new Date(now.getTime() + 90 * 86400000);

      // Clean CNPJ/UASG input — strip dots, slashes, dashes
      const cleanCnpjOrgao = cnpjOrgao ? cnpjOrgao.replace(/[.\-\/\s]/g, '') : null;

      // If searching by CNPJ, use the dedicated PNCP endpoint
      if (cleanCnpjOrgao && cleanCnpjOrgao.length >= 6) {
        // PNCP supports searching by CNPJ directly
        const fetchByCnpj = async () => {
          const params = new URLSearchParams();
          params.set("dataInicial", formatDatePNCP(dataInicialDate));
          params.set("dataFinal", formatDatePNCP(dataFinalDate));
          params.set("pagina", String(pagina || 1));
          params.set("tamanhoPagina", "50");
          if (uf) params.set("uf", uf);
          params.set("cnpj", cleanCnpjOrgao);
          if (query) params.set("q", query.substring(0, 100));
          if (modalidade) {
            const cod = MODALIDADES_PNCP[modalidade.toLowerCase().trim()];
            if (cod) params.set("codigoModalidadeContratacao", String(cod));
          }

          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
          console.log(`PNCP API (CNPJ filter): ${url}`);

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const response = await fetch(url, {
              headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
              const errorText = await response.text();
              console.log(`PNCP CNPJ API error ${response.status}: ${errorText.substring(0, 300)}`);
              return [];
            }

            const data = await response.json();
            const pncpArray = data.data || [];
            console.log(`PNCP CNPJ=${cleanCnpjOrgao}: ${pncpArray.length} resultados`);

            return pncpArray.map((item: any) => {
              const itemCnpj = item.orgaoEntidade?.cnpj || "";
              const anoCompra = item.anoCompra || "";
              const seqCompra = item.sequencialCompra || "";
              let urlPncp = "";
              if (itemCnpj && anoCompra && seqCompra) {
                urlPncp = `https://pncp.gov.br/app/editais/${itemCnpj}/${anoCompra}/${seqCompra}`;
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
                cnpjOrgao: itemCnpj || null,
                anoCompra: anoCompra || null,
                sequencialCompra: seqCompra || null,
                isMock: false,
              };
            });
          } catch (e) {
            clearTimeout(timeout);
            console.log(`PNCP CNPJ timeout/error:`, e);
            return [];
          }
        };

        const cnpjResults = await fetchByCnpj();
        allItems.push(...cnpjResults);
      } else {
      // For "mural" mode, search multiple modalidades in parallel for speed
      const modalidades = mural
        ? [6, 4, 5, 8, 7, 11]
        : [modalidade ? (MODALIDADES_PNCP[modalidade.toLowerCase().trim()] || 6) : 6];

      const fetchModalidade = async (codModalidade: number) => {
        const params = new URLSearchParams();
        params.set("dataInicial", formatDatePNCP(dataInicialDate));
        params.set("dataFinal", formatDatePNCP(dataFinalDate));
        params.set("pagina", String(pagina || 1));
        params.set("tamanhoPagina", mural ? "50" : "20");
        params.set("codigoModalidadeContratacao", String(codModalidade));
        if (uf) params.set("uf", uf);
        if (query) params.set("q", query.substring(0, 100));

        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
        console.log(`PNCP API: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`PNCP API error ${response.status}: ${errorText.substring(0, 300)}`);
            return [];
          }

          const data = await response.json();
          const pncpArray = data.data || [];
          console.log(`PNCP mod=${codModalidade}: ${pncpArray.length} resultados`);

          return pncpArray.map((item: any) => {
            const cnpjOrgaoItem = item.orgaoEntidade?.cnpj || "";
            const anoCompra = item.anoCompra || "";
            const seqCompra = item.sequencialCompra || "";
            let urlPncp = "";
            if (cnpjOrgaoItem && anoCompra && seqCompra) {
              urlPncp = `https://pncp.gov.br/app/editais/${cnpjOrgaoItem}/${anoCompra}/${seqCompra}`;
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
              cnpjOrgao: cnpjOrgaoItem || null,
              anoCompra: anoCompra || null,
              sequencialCompra: seqCompra || null,
              isMock: false,
            };
          });
        } catch (e) {
          clearTimeout(timeout);
          console.log(`PNCP mod=${codModalidade} timeout/error:`, e);
          return [];
        }
      };

      // Run all modalidade fetches in parallel for speed
      const results = await Promise.allSettled(modalidades.map(fetchModalidade));
      for (const result of results) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value);
          if (mural && allItems.length >= 50) break;
        }
      }
      }

        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
        console.log(`PNCP API: ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`PNCP API error ${response.status}: ${errorText.substring(0, 300)}`);
            return [];
          }

          const data = await response.json();
          const pncpArray = data.data || [];
          console.log(`PNCP mod=${codModalidade}: ${pncpArray.length} resultados`);

          return pncpArray.map((item: any) => {
            const cnpjOrgao = item.orgaoEntidade?.cnpj || "";
            const anoCompra = item.anoCompra || "";
            const seqCompra = item.sequencialCompra || "";
            let urlPncp = "";
            if (cnpjOrgao && anoCompra && seqCompra) {
              urlPncp = `https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${seqCompra}`;
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
              cnpjOrgao: cnpjOrgao || null,
              anoCompra: anoCompra || null,
              sequencialCompra: seqCompra || null,
              isMock: false,
            };
          });
        } catch (e) {
          clearTimeout(timeout);
          console.log(`PNCP mod=${codModalidade} timeout/error:`, e);
          return [];
        }
      };

      // Run all modalidade fetches in parallel for speed
      const results = await Promise.allSettled(modalidades.map(fetchModalidade));
      for (const result of results) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value);
          if (mural && allItems.length >= 50) break;
        }
      }
      } // end else (no cnpjOrgao)
    } catch (e) {
      console.log("PNCP API error:", e);
    }

    // ── Firecrawl for non-PNCP portals (no mock fallback) ──
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (FIRECRAWL_API_KEY && portal && portal !== "all" && portal !== "pncp") {
      try {
        const searchQuery = `${query || "licitação"} edital`;
        console.log(`Firecrawl search for portal ${portal}: ${searchQuery}`);

        const fcResp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
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

        if (fcResp.ok) {
          const fcData = await fcResp.json();
          const fcResults = fcData.data || [];
          for (const r of fcResults) {
            const title = r.title || "";
            const description = r.description || "";
            const rUrl = r.url || "";
            const markdown = r.markdown || "";

            let valor: number | null = null;
            const valorMatch = (markdown + description).match(/R\$\s*([\d.,]+)/);
            if (valorMatch) {
              valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
              if (isNaN(valor)) valor = null;
            }

            allItems.push({
              numero: "",
              orgao: title.substring(0, 100) || portal,
              objeto: (title || description).substring(0, 500),
              modalidade: "Pregão Eletrônico",
              status: "Publicado",
              valor_estimado: valor,
              uf: uf || null,
              municipio: null,
              data_abertura: null,
              portal: portal,
              url: rUrl,
              pncpNumero: null,
              cnpjOrgao: null,
              isMock: false,
            });
          }
        } else {
          await fcResp.text();
        }
      } catch (e) {
        console.error(`Firecrawl ${portal} error:`, e);
      }
    }

    // Add unique IDs
    const itemsComId = allItems.map((item, idx) => ({ ...item, id: `busca-${idx}` }));

    return new Response(JSON.stringify({
      items: itemsComId,
      total: itemsComId.length,
      pagina: pagina || 1,
      fonte: "PNCP",
      portais_consultados: ["PNCP"],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Licitacoes search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na busca" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
