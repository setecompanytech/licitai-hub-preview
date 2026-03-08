import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PORTAIS_INFO: Record<string, { nome: string; url: string }> = {
  pncp: { nome: "PNCP", url: "https://pncp.gov.br" },
  comprasnet: { nome: "Compras Governamentais", url: "https://www.gov.br/compras/pt-br" },
  "licitacoes-e": { nome: "Licitações-e (BB)", url: "https://licitacoes-e2.bb.com.br" },
  bnc: { nome: "BNC", url: "https://bnc.org.br" },
  banparanet: { nome: "Banparanet PA", url: "https://cotacao.banpara.b.br" },
  becsp: { nome: "BEC/SP", url: "https://www.bec.sp.gov.br" },
  comprasrj: { nome: "Compras Públicas RJ", url: "https://www.compras.rj.gov.br" },
  banrisul: { nome: "Banrisul (RS)", url: "https://ww2.banrisul.com.br/bob/link/bobw00hn_ComprasEletronicas.aspx" },
  comprasrs: { nome: "Compras RS", url: "https://compras.rs.gov.br" },
  procergs: { nome: "PROCERGS (RS)", url: "https://pregaobanrisul.com.br" },
  licitanet: { nome: "Licitanet", url: "https://www.licitanet.com.br" },
  bll: { nome: "BLL Compras", url: "https://bll.org.br" },
  portalcompras: { nome: "Portal de Compras Públicas", url: "https://www.portaldecompraspublicas.com.br" },
  // Novos portais estaduais
  "comprasnet-ba": { nome: "ComprasNet Bahia", url: "https://www.comprasnet.ba.gov.br" },
  "portal-compras-ce": { nome: "Portal Compras Ceará", url: "https://www.portalcompras.ce.gov.br" },
  "compras-pe": { nome: "PE Integrado", url: "https://peintegrado.pe.gov.br" },
  "comprasnet-go": { nome: "ComprasNet Goiás", url: "https://www.comprasnet.go.gov.br" },
  "compras-mg": { nome: "Compras MG", url: "https://compras.mg.gov.br" },
  "e-compras-am": { nome: "e-Compras Amazonas", url: "https://sistemas.sefaz.am.gov.br/e-compras" },
  "compras-pr": { nome: "Compras Paraná", url: "https://www.comprasparana.pr.gov.br" },
  "compras-sc": { nome: "Compras SC", url: "https://portaldecompras.sc.gov.br" },
  "compras-df": { nome: "e-Compras DF", url: "https://www.compras.df.gov.br" },
  "compras-es": { nome: "Compras ES", url: "https://compras.es.gov.br" },
  "compras-mt": { nome: "Compras MT", url: "https://aquisicoes.sad.mt.gov.br" },
  "compras-ms": { nome: "Compras MS", url: "https://www.centraldecompras.ms.gov.br" },
  "compras-ma": { nome: "Compras Maranhão", url: "https://www.compras.ma.gov.br" },
  "compras-to": { nome: "Compras Tocantins", url: "https://www.sgc.to.gov.br" },
  "comprasnet-ro": { nome: "ComprasNet Rondônia", url: "https://comprasnet.sistemas.ro.gov.br" },
  // Novas plataformas
  bbmnet: { nome: "BBMNet", url: "https://www.bbmnet.com.br" },
  comprasbr: { nome: "ComprasBR", url: "https://comprasbr.com.br" },
  "compras-me": { nome: "Compras.ME", url: "https://compras.me" },
  "licitar-digital": { nome: "Licitar Digital", url: "https://licitardigital.com.br" },
  "lance-eletronico": { nome: "Lance Eletrônico", url: "https://www.lanceeletronico.com.br" },
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

// Format date to yyyyMMdd
function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function gerarDadosPorPortal(
  portalId: string,
  query: string,
  uf: string,
  modalidade: string,
  dataInicio?: string,
  dataFim?: string,
) {
  const info = PORTAIS_INFO[portalId] || { nome: portalId, url: "" };

  const orgaosBase = [
    "Prefeitura Municipal", "Secretaria de Educação", "Tribunal de Justiça",
    "Universidade Federal", "Secretaria de Saúde", "Instituto Federal",
    "SEDUC", "Câmara Municipal", "Ministério Público", "Governo do Estado",
  ];
  const municipios: Record<string, string[]> = {
    PA: ["Belém", "Marabá", "Ananindeua", "Santarém", "Castanhal", "Parauapebas"],
    SP: ["São Paulo", "Campinas", "Santos", "Sorocaba", "Ribeirão Preto"],
    RJ: ["Rio de Janeiro", "Niterói", "Petrópolis", "Volta Redonda"],
    MG: ["Belo Horizonte", "Uberlândia", "Juiz de Fora", "Montes Claros"],
    BA: ["Salvador", "Feira de Santana", "Vitória da Conquista"],
    CE: ["Fortaleza", "Juazeiro do Norte", "Sobral"],
    AM: ["Manaus", "Parintins", "Itacoatiara"],
    GO: ["Goiânia", "Anápolis", "Aparecida de Goiânia"],
    PR: ["Curitiba", "Londrina", "Maringá"],
    RS: ["Porto Alegre", "Caxias do Sul", "Pelotas"],
  };
  const statusList = ["Aberto", "Em andamento", "Publicado"];
  const ufEfetivo = uf || "PA";
  const munis = municipios[ufEfetivo] || municipios["PA"];

  const count = 3 + Math.floor(Math.random() * 5);
  const items = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const daysOffset = Math.floor(Math.random() * 60) - 10;
    const dataAbertura = new Date(now.getTime() + daysOffset * 86400000);

    if (dataInicio && dataAbertura < new Date(dataInicio)) continue;
    if (dataFim && dataAbertura > new Date(dataFim)) continue;

    const valor = Math.floor(Math.random() * 5000000) + 50000;
    const orgao = orgaosBase[Math.floor(Math.random() * orgaosBase.length)];
    const muni = munis[Math.floor(Math.random() * munis.length)];

    items.push({
      numero: `PE ${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}/${now.getFullYear()}`,
      orgao: `${orgao} de ${muni}`,
      objeto: query
        ? `${["Aquisição de", "Contratação de serviços de", "Fornecimento de", "Registro de preços para"][Math.floor(Math.random() * 4)]} ${query}`
        : "Aquisição de materiais e serviços diversos",
      modalidade: modalidade || "Pregão Eletrônico",
      status: statusList[Math.floor(Math.random() * statusList.length)],
      valor_estimado: valor,
      uf: ufEfetivo,
      municipio: muni,
      data_abertura: dataAbertura.toISOString().split("T")[0],
      portal: info.nome,
      url: info.url,
      // Mock data doesn't have real identifiers
      pncpNumero: null,
      cnpjOrgao: null,
      isMock: true,
    });
  }
  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { query, uf, modalidade, pagina, portal, dataInicio, dataFim } = body;

    // Determinar quais portais buscar
    const portaisParaBuscar = portal && portal !== "all"
      ? [portal]
      : Object.keys(PORTAIS_INFO);

    let allItems: any[] = [];

    // Tentar API real do PNCP se ele estiver na lista
    if (portaisParaBuscar.includes("pncp")) {
      try {
        const now = new Date();
        const dataInicialDate = dataInicio ? new Date(dataInicio) : new Date(now.getTime() - 90 * 86400000);
        const dataFinalDate = dataFim ? new Date(dataFim) : new Date(now.getTime() + 90 * 86400000);

        const params = new URLSearchParams();
        params.set("dataInicial", formatDatePNCP(dataInicialDate));
        params.set("dataFinal", formatDatePNCP(dataFinalDate));
        params.set("pagina", String(pagina || 1));
        params.set("tamanhoPagina", "20");

        // codigoModalidadeContratacao is required - default to Pregão Eletrônico (6)
        let codModalidade = 6;
        if (modalidade) {
          const key = modalidade.toLowerCase().trim();
          codModalidade = MODALIDADES_PNCP[key] || 6;
        }
        params.set("codigoModalidadeContratacao", String(codModalidade));

        if (uf) params.set("uf", uf);

        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;
        console.log(`PNCP API: ${url}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
          headers: { 
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const pncpArray = data.data || [];

          console.log(`PNCP: ${pncpArray.length} resultados reais (total: ${data.totalRegistros})`);

          // Filter by query term if provided
          let filtered = pncpArray;
          if (query) {
            const q = query.toLowerCase();
            filtered = pncpArray.filter((item: any) => {
              const obj = (item.objetoCompra || "").toLowerCase();
              const org = (item.orgaoEntidade?.razaoSocial || "").toLowerCase();
              return obj.includes(q) || org.includes(q);
            });
            // If filter is too aggressive, use all results
            if (filtered.length === 0) filtered = pncpArray;
          }

          const pncpItems = filtered.map((item: any) => ({
            numero: item.numeroCompra || item.numeroControlePNCP || "-",
            orgao: item.orgaoEntidade?.razaoSocial || "-",
            objeto: item.objetoCompra || "-",
            modalidade: item.modalidadeNome || "Pregão - Eletrônico",
            status: item.situacaoCompraNome || "Publicado",
            valor_estimado: item.valorTotalEstimado || item.valorTotalHomologado || null,
            uf: item.unidadeOrgao?.ufSigla || uf || null,
            municipio: item.unidadeOrgao?.municipioNome || null,
            data_abertura: item.dataEncerramentoProposta?.split("T")[0] || item.dataAberturaProposta?.split("T")[0] || null,
            portal: "PNCP",
            url: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.numeroControlePNCP || ""}`,
            pncpNumero: item.numeroControlePNCP || null,
            cnpjOrgao: item.orgaoEntidade?.cnpj || null,
            anoCompra: item.anoCompra || null,
            sequencialCompra: item.sequencialCompra || null,
            isMock: false,
          }));
          allItems.push(...pncpItems);
        } else {
          const errorText = await response.text();
          console.log(`PNCP API error ${response.status}: ${errorText.substring(0, 300)}`);
          // Fallback para dados simulados
          allItems.push(...gerarDadosPorPortal("pncp", query || "", uf || "", modalidade || "", dataInicio, dataFim));
        }
      } catch (e) {
        console.log("PNCP API error:", e);
        allItems.push(...gerarDadosPorPortal("pncp", query || "", uf || "", modalidade || "", dataInicio, dataFim));
      }
    }

    // Para os demais portais, gerar dados de demonstração
    for (const pid of portaisParaBuscar) {
      if (pid === "pncp") continue;
      allItems.push(...gerarDadosPorPortal(pid, query || "", uf || "", modalidade || "", dataInicio, dataFim));
    }

    // Adicionar id único
    const itemsComId = allItems.map((item, idx) => ({ ...item, id: `busca-${idx}` }));

    const fonte = portaisParaBuscar.length === 1
      ? PORTAIS_INFO[portaisParaBuscar[0]]?.nome || portaisParaBuscar[0]
      : `${portaisParaBuscar.length} portais`;

    return new Response(JSON.stringify({
      items: itemsComId,
      total: itemsComId.length,
      pagina: pagina || 1,
      fonte,
      portais_consultados: portaisParaBuscar.map(p => PORTAIS_INFO[p]?.nome || p),
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
