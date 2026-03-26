import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
};

const MODALIDADE_MAP: Record<string, string> = {
  "1": "Leilão Eletrônico", "2": "Diálogo Competitivo", "3": "Concurso",
  "4": "Concorrência Eletrônica", "5": "Concorrência Presencial",
  "6": "Pregão Eletrônico", "7": "Pregão Presencial",
  "8": "Dispensa de Licitação", "9": "Inexigibilidade",
  "10": "Manifestação de Interesse", "11": "Pré-qualificação",
  "12": "Credenciamento", "13": "Leilão Presencial",
};

// Mapa de DOEs por UF (URLs dos diários oficiais estaduais)
const DOE_URLS: Record<string, { nome: string; dominio: string }> = {
  AC: { nome: "DOE Acre", dominio: "diario.ac.gov.br" },
  AL: { nome: "DOE Alagoas", dominio: "imprensaoficialdealagoas.com.br" },
  AM: { nome: "DOE Amazonas", dominio: "diario.imprensaoficial.am.gov.br" },
  AP: { nome: "DOE Amapá", dominio: "diariooficial.ap.gov.br" },
  BA: { nome: "DOE Bahia", dominio: "diariooficial.egba.ba.gov.br" },
  CE: { nome: "DOE Ceará", dominio: "doe.seplag.ce.gov.br" },
  DF: { nome: "DODF", dominio: "dodf.df.gov.br" },
  ES: { nome: "DOE Espírito Santo", dominio: "ioes.dio.es.gov.br" },
  GO: { nome: "DOE Goiás", dominio: "diariooficial.abc.go.gov.br" },
  MA: { nome: "DOE Maranhão", dominio: "diariooficial.ma.gov.br" },
  MG: { nome: "DOE Minas Gerais", dominio: "iof.mg.gov.br" },
  MS: { nome: "DOE Mato Grosso do Sul", dominio: "diariooficial.ms.gov.br" },
  MT: { nome: "DOE Mato Grosso", dominio: "iomat.mt.gov.br" },
  PA: { nome: "IOEPA", dominio: "ioepa.com.br" },
  PB: { nome: "DOE Paraíba", dominio: "diariooficial.pb.gov.br" },
  PE: { nome: "DOE Pernambuco", dominio: "cepe.com.br" },
  PI: { nome: "DOE Piauí", dominio: "diariooficial.pi.gov.br" },
  PR: { nome: "DOE Paraná", dominio: "dioe.pr.gov.br" },
  RJ: { nome: "IOERJ", dominio: "ioerj.com.br" },
  RN: { nome: "DOE Rio Grande do Norte", dominio: "diariooficial.rn.gov.br" },
  RO: { nome: "DOE Rondônia", dominio: "diof.ro.gov.br" },
  RR: { nome: "DOE Roraima", dominio: "imprensaoficial.rr.gov.br" },
  RS: { nome: "DOE Rio Grande do Sul", dominio: "diariooficial.rs.gov.br" },
  SC: { nome: "DOE Santa Catarina", dominio: "doe.sea.sc.gov.br" },
  SE: { nome: "DOE Sergipe", dominio: "segrase.se.gov.br" },
  SP: { nome: "DOE São Paulo", dominio: "doe.sp.gov.br" },
  TO: { nome: "DOE Tocantins", dominio: "diariooficial.to.gov.br" },
};

function classificarTipoPncp(situacao: string, titulo: string): string {
  const sit = (situacao || "").toLowerCase();
  const tit = (titulo || "").toLowerCase();
  if (sit.includes("suspens")) return "suspensao";
  if (sit.includes("revogad")) return "revogacao";
  if (sit.includes("anulad") || sit.includes("cancelad")) return "cancelamento";
  if (sit.includes("homolog")) return "homologacao";
  if (sit.includes("adjudic")) return "adjudicacao";
  if (tit.includes("errata") || tit.includes("retifica")) return "errata";
  if (tit.includes("resultado")) return "resultado";
  if (tit.includes("contrato")) return "contrato";
  if (tit.includes("ata de registro")) return "ata_registro_precos";
  if (tit.includes("adiament") || tit.includes("prorroga")) return "adiamento";
  if (tit.includes("aditiv")) return "aditivamento";
  if (sit.includes("aberta") || sit.includes("publicad")) return "aviso_licitacao";
  return "edital";
}

function formatDatePNCP(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// ── PNCP API ──
async function buscarPNCP(ufs: string[], palavrasChave: string[], diasRetroativos: number): Promise<any[]> {
  const resultados: any[] = [];
  const agora = new Date();
  const dataInicial = formatDatePNCP(new Date(agora.getTime() - diasRetroativos * 86400000));
  const dataFinal = formatDatePNCP(agora);
  const modalidades = ["6", "4", "8", "5", "9", "1"];

  for (const modalidade of modalidades) {
    try {
      const params = new URLSearchParams({
        dataInicial, dataFinal,
        codigoModalidadeContratacao: modalidade,
        pagina: "1", tamanhoPagina: "50",
      });
      if (palavrasChave.length > 0) params.set("q", palavrasChave.slice(0, 3).join(" "));

      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) { await resp.text(); continue; }

      const data = await resp.json();
      const items = data.data || data || [];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const ufItem = item.unidadeOrgao?.ufSigla || item.orgaoEntidade?.ufSigla || "";
        if (ufs.length > 0 && !ufs.includes(ufItem) && ufItem !== "DF" && ufs[0] !== "TODOS") continue;

        const situacao = item.situacaoCompraItem || item.situacaoCompra || "";
        const titulo = item.objetoCompra || item.descricao || "Sem título";
        const orgaoNome = item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || "Órgão não identificado";
        const municipio = item.unidadeOrgao?.municipioNome || null;
        const cnpjOrgao = item.orgaoEntidade?.cnpj || "";
        const anoCompra = item.anoCompra || "";
        const seqCompra = item.sequencialCompra || "";
        const numControlePncp = item.numeroControlePNCP || "";
        const modalidadeNome = MODALIDADE_MAP[modalidade] || `Modalidade ${modalidade}`;
        const valorEstimado = item.valorTotalEstimado || item.valorTotalHomologado || null;
        const dataPublicacao = item.dataPublicacaoPncp || item.dataInclusao || new Date().toISOString();

        let urlPncp = "";
        if (cnpjOrgao && anoCompra && seqCompra) {
          urlPncp = `https://pncp.gov.br/app/editais/${cnpjOrgao}/${anoCompra}/${seqCompra}`;
        }
        const linkOrigem = item.linkSistemaOrigem || urlPncp;

        resultados.push({
          titulo: titulo.substring(0, 500), orgao: orgaoNome,
          tipo: classificarTipoPncp(situacao, titulo),
          data_publicacao: dataPublicacao.split("T")[0],
          valor_estimado: valorEstimado, municipio, uf: ufItem,
          url: linkOrigem || urlPncp, relevancia: 80,
          palavras_chave_encontradas: palavrasChave.filter(kw => titulo.toLowerCase().includes(kw.toLowerCase())),
          modalidade: modalidadeNome, portal: "PNCP",
          cnpj_orgao: cnpjOrgao, ano_compra: anoCompra, seq_compra: seqCompra,
          pncp_numero: numControlePncp, fonte_real: true,
        });
      }
    } catch (e) {
      console.error(`PNCP mod=${modalidade} error:`, e);
    }
  }
  return resultados;
}

// ── Compras Governamentais API ──
async function buscarComprasGov(palavrasChave: string[], diasRetroativos: number): Promise<any[]> {
  const resultados: any[] = [];
  try {
    const agora = new Date();
    const dataInicial = new Date(agora.getTime() - diasRetroativos * 86400000);
    const dataInicialStr = `${String(dataInicial.getDate()).padStart(2, "0")}/${String(dataInicial.getMonth() + 1).padStart(2, "0")}/${dataInicial.getFullYear()}`;
    const url = `https://compras.dados.gov.br/licitacoes/v1/licitacoes.json?data_publicacao_min=${dataInicialStr}&offset=0&limit=50`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return resultados;
    const data = await resp.json();
    const items = data._embedded?.licitacoes || [];
    for (const item of items) {
      const objeto = item.objeto || "Sem objeto";
      const matched = palavrasChave.some(kw => objeto.toLowerCase().includes(kw.toLowerCase()));
      if (!matched && palavrasChave.length > 0) continue;
      resultados.push({
        titulo: objeto.substring(0, 500), orgao: item.informacoes_gerais || `UASG ${item.uasg}`,
        tipo: "aviso_licitacao", data_publicacao: item.data_publicacao || new Date().toISOString().split("T")[0],
        valor_estimado: item.valor_estimado || null, municipio: null, uf: "DF",
        url: `https://www.gov.br/compras/pt-br`, relevancia: 65,
        palavras_chave_encontradas: palavrasChave.filter(kw => objeto.toLowerCase().includes(kw.toLowerCase())),
        modalidade: item.modalidade || "Pregão Eletrônico", portal: "Compras Governamentais", fonte_real: true,
      });
    }
  } catch (e) { console.error("ComprasGov error:", e); }
  return resultados;
}

// ── DOU - Imprensa Nacional ──
async function buscarDOU(palavrasChave: string[], diasRetroativos: number): Promise<any[]> {
  const resultados: any[] = [];
  try {
    const query = palavrasChave.slice(0, 3).join("+");
    const url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(query)}&s=0&sortType=0&delta=20&newPage=true&currentPage=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      headers: { ...FETCH_HEADERS, Accept: "text/html,application/xhtml+xml,*/*" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return resultados;
    const html = await resp.text();

    const jsonMatch = html.match(/var\s+jsonArray\s*=\s*(\[[\s\S]*?\]);/);
    if (jsonMatch) {
      try {
        const items = JSON.parse(jsonMatch[1]);
        for (const item of items.slice(0, 20)) {
          resultados.push({
            titulo: (item.title || item.titulo || "Publicação DOU").substring(0, 500),
            orgao: item.artCategory || item.orgao || "Diário Oficial da União",
            tipo: "edital", data_publicacao: item.pubDate || new Date().toISOString().split("T")[0],
            valor_estimado: null, municipio: null, uf: "DF",
            url: item.urlTitle ? `https://www.in.gov.br/web/dou/-/${item.urlTitle}` : null,
            relevancia: 70,
            palavras_chave_encontradas: palavrasChave.filter(kw => (item.title || "").toLowerCase().includes(kw.toLowerCase())),
            modalidade: null, portal: "Diário Oficial da União", fonte_real: true,
          });
        }
      } catch { /* parse error */ }
    }

    // Fallback: scrape links
    if (resultados.length === 0) {
      const linkRegex = /<a[^>]*href=["'](\/web\/dou\/-\/[^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
      const titleRegex = /<p[^>]*class=["']title-marker["'][^>]*>([\s\S]*?)<\/p>/gi;
      const links: string[] = [];
      const titles: string[] = [];
      let m;
      while ((m = linkRegex.exec(html)) !== null && links.length < 20) links.push(m[1]);
      while ((m = titleRegex.exec(html)) !== null && titles.length < 20) titles.push(m[1].replace(/<[^>]+>/g, "").trim());

      for (let i = 0; i < Math.min(links.length, titles.length); i++) {
        resultados.push({
          titulo: titles[i].substring(0, 500), orgao: "Diário Oficial da União",
          tipo: "edital", data_publicacao: new Date().toISOString().split("T")[0],
          valor_estimado: null, municipio: null, uf: "DF",
          url: `https://www.in.gov.br${links[i]}`, relevancia: 60,
          palavras_chave_encontradas: [], modalidade: null,
          portal: "Diário Oficial da União", fonte_real: true,
        });
      }
    }
  } catch (e) { console.error("DOU error:", e); }
  return resultados;
}

// ── Diários Oficiais Estaduais via Firecrawl ──
async function buscarDOEsFirecrawl(
  ufs: string[],
  palavrasChave: string[],
  firecrawlApiKey: string
): Promise<any[]> {
  const resultados: any[] = [];
  const ufsParaBuscar = ufs[0] === "TODOS"
    ? Object.keys(DOE_URLS)
    : ufs.filter(uf => DOE_URLS[uf]);

  // Build targeted Google search queries for each UF's DOE
  const searchTasks = ufsParaBuscar.map(uf => async () => {
    const doe = DOE_URLS[uf];
    if (!doe) return [];

    const termos = palavrasChave.slice(0, 3).join(" ");
    // Comprehensive Google Alerts-style search across all relevant publication types
    const termosOficiais = [
      '"licitação"', '"pregão"', '"edital"', '"aviso de licitação"',
      '"aviso de cancelamento"', '"aviso de republicação"', '"aviso de suspensão"',
      '"aviso de revogação"', '"aviso de adiamento"', '"extrato de contrato"',
      '"extrato de termo aditivo"', '"designação de fiscal"', '"ata de registro de preços"',
      '"resultado de julgamento"', '"homologação"', '"adjudicação"',
      '"dispensa de licitação"', '"inexigibilidade"', '"chamamento público"',
      '"tomada de preços"', '"concorrência pública"', '"errata"', '"retificação"',
    ];
    const termosQuery = termosOficiais.slice(0, 8).join(" OR ");
    const query = `site:${doe.dominio} OR site:.${uf.toLowerCase()}.gov.br ${termosQuery} ${termos}`;

    try {
      const resp = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 15,
          lang: "pt",
          country: "br",
          tbs: "qdr:w", // Last week
        }),
      });

      if (!resp.ok) {
        if (resp.status === 402) {
          console.warn("Firecrawl: créditos insuficientes");
          return [];
        }
        console.warn(`Firecrawl search for ${uf} failed: ${resp.status}`);
        return [];
      }

      const data = await resp.json();
      const items = data.data || [];
      const ufResults: any[] = [];

      for (const r of items) {
        const titulo = r.title || r.description || "Publicação DOE";
        const content = (r.markdown || r.description || "").toLowerCase();

        // Extract value if present
        let valor: number | null = null;
        const valorMatch = (r.markdown || r.description || "").match(/R\$\s*([\d.,]+)/);
        if (valorMatch) {
          valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
          if (isNaN(valor)) valor = null;
        }

        // Classify the type based on content
        let tipo = "edital";
        if (content.includes("suspens")) tipo = "suspensao";
        else if (content.includes("cancel") || content.includes("revog")) tipo = "cancelamento";
        else if (content.includes("homolog")) tipo = "homologacao";
        else if (content.includes("adjudic")) tipo = "adjudicacao";
        else if (content.includes("errata") || content.includes("retific")) tipo = "errata";
        else if (content.includes("resultado")) tipo = "resultado";
        else if (content.includes("contrato")) tipo = "contrato";
        else if (content.includes("pregão") || content.includes("aviso")) tipo = "aviso_licitacao";

        // Extract municipality from content
        let municipio: string | null = null;
        const munMatch = (r.title || "").match(/(?:prefeitura|município|câmara)\s+(?:de|do|da|dos|das)\s+([^,.\-–]+)/i);
        if (munMatch) municipio = munMatch[1].trim();

        ufResults.push({
          titulo: titulo.substring(0, 500),
          orgao: r.title?.match(/^([^–\-|]+)/)?.[1]?.trim() || doe.nome,
          tipo, data_publicacao: new Date().toISOString().split("T")[0],
          valor_estimado: valor, municipio, uf,
          url: r.url || null, relevancia: 65,
          palavras_chave_encontradas: palavrasChave.filter(kw =>
            titulo.toLowerCase().includes(kw.toLowerCase()) || content.includes(kw.toLowerCase())
          ),
          modalidade: null, portal: doe.nome, fonte_real: true,
        });
      }

      console.log(`DOE ${uf} (${doe.nome}): ${ufResults.length} resultados via Firecrawl`);
      return ufResults;
    } catch (e) {
      console.error(`DOE ${uf} Firecrawl error:`, e);
      return [];
    }
  });

  // Run in batches of 3 to respect rate limits
  for (let i = 0; i < searchTasks.length; i += 3) {
    const batch = searchTasks.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(t => t()));
    for (const r of batchResults) resultados.push(...r);
  }

  return resultados;
}

// ── Google-style search across all .gov.br sites ──
async function buscarGovBrFirecrawl(
  palavrasChave: string[],
  firecrawlApiKey: string
): Promise<any[]> {
  const resultados: any[] = [];
  try {
    const termos = palavrasChave.slice(0, 4).join(" ");
    // Replicates Google Alerts: site:.gov.br "licitação" "produto" "PDF"
    const query = `site:.gov.br "licitação" OR "pregão" OR "edital" ${termos} filetype:pdf OR "aviso de licitação"`;

    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 20,
        lang: "pt",
        country: "br",
        tbs: "qdr:d", // Last 24 hours — like Google Alerts "once a day"
      }),
    });

    if (!resp.ok) {
      console.warn(`Firecrawl gov.br search failed: ${resp.status}`);
      return resultados;
    }

    const data = await resp.json();
    for (const r of (data.data || [])) {
      const titulo = r.title || r.description || "Publicação Gov.br";
      const content = (r.markdown || r.description || "").toLowerCase();

      let valor: number | null = null;
      const valorMatch = (r.markdown || r.description || "").match(/R\$\s*([\d.,]+)/);
      if (valorMatch) {
        valor = parseFloat(valorMatch[1].replace(/\./g, "").replace(",", "."));
        if (isNaN(valor)) valor = null;
      }

      // Try to extract UF from URL
      let uf = "DF";
      const ufMatch = (r.url || "").match(/\.([a-z]{2})\.gov\.br/i);
      if (ufMatch) uf = ufMatch[1].toUpperCase();

      let tipo = "edital";
      if (content.includes("pregão") || content.includes("aviso")) tipo = "aviso_licitacao";
      else if (content.includes("dispensa")) tipo = "edital";
      else if (content.includes("resultado")) tipo = "resultado";

      resultados.push({
        titulo: titulo.substring(0, 500),
        orgao: r.title?.match(/^([^–\-|]+)/)?.[1]?.trim() || "Portal Gov.br",
        tipo, data_publicacao: new Date().toISOString().split("T")[0],
        valor_estimado: valor, municipio: null, uf,
        url: r.url || null, relevancia: 60,
        palavras_chave_encontradas: palavrasChave.filter(kw =>
          titulo.toLowerCase().includes(kw.toLowerCase()) || content.includes(kw.toLowerCase())
        ),
        modalidade: null, portal: "Diário Oficial (.gov.br)", fonte_real: true,
      });
    }
    console.log(`Gov.br search: ${resultados.length} resultados`);
  } catch (e) {
    console.error("Gov.br Firecrawl error:", e);
  }
  return resultados;
}

// ── AI Classification ──
async function classificarComIA(resultados: any[], apiKey: string): Promise<any[]> {
  if (resultados.length === 0) return resultados;
  const paraClassificar = resultados.filter(r => !r.tipo || r.tipo === "edital").slice(0, 30);
  if (paraClassificar.length === 0) return resultados;

  const resumos = paraClassificar.map((r, i) => `${i}: "${r.titulo}" - ${r.orgao}`).join("\n");
  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Você classifica atos licitatórios. Para cada item, retorne o tipo e score de relevância (0-100). Retorne APENAS JSON." },
          { role: "user", content: `Classifique cada ato. Tipos: aviso_licitacao, edital, suspensao, cancelamento, adiamento, revogacao, homologacao, adjudicacao, aditivamento, errata, resultado, contrato, ata_registro_precos.\n\n${resumos}\n\nRetorne JSON: [{"i": 0, "tipo": "aviso_licitacao", "rel": 85}, ...]` },
        ],
        temperature: 0.2,
      }),
    });
    if (!aiResponse.ok) return resultados;
    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const classificacoes = JSON.parse(content);
    if (Array.isArray(classificacoes)) {
      for (const c of classificacoes) {
        if (typeof c.i === "number" && c.i < paraClassificar.length) {
          if (c.tipo) paraClassificar[c.i].tipo = c.tipo;
          if (c.rel) paraClassificar[c.i].relevancia = c.rel;
        }
      }
    }
  } catch (e) { console.error("AI classification error:", e); }
  return resultados;
}

function montarTextoIntegral(r: any): string {
  const tipoLabel: Record<string, string> = {
    aviso_licitacao: "AVISO DE LICITAÇÃO", edital: "EDITAL DE LICITAÇÃO",
    suspensao: "AVISO DE SUSPENSÃO DE LICITAÇÃO", cancelamento: "AVISO DE CANCELAMENTO DE LICITAÇÃO",
    adiamento: "AVISO DE ADIAMENTO DE LICITAÇÃO", revogacao: "AVISO DE REVOGAÇÃO DE LICITAÇÃO",
    homologacao: "TERMO DE HOMOLOGAÇÃO", adjudicacao: "TERMO DE ADJUDICAÇÃO",
    aditivamento: "EXTRATO DE TERMO ADITIVO", errata: "ERRATA DE EDITAL",
    resultado: "RESULTADO DE JULGAMENTO", contrato: "EXTRATO DE CONTRATO",
    ata_registro_precos: "ATA DE REGISTRO DE PREÇOS",
  };
  const linhas: string[] = [];
  const tipoTitulo = tipoLabel[r.tipo] || "PUBLICAÇÃO OFICIAL";
  if (r.modalidade) { linhas.push(tipoTitulo); linhas.push(r.modalidade.toUpperCase()); }
  else linhas.push(tipoTitulo);
  if (r.orgao) linhas.push(`${r.orgao}, comunica:`);
  if (r.titulo) linhas.push(`OBJETO: ${r.titulo}`);
  if (r.valor_estimado) {
    linhas.push(`VALOR ESTIMADO: ${Number(r.valor_estimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  }
  if (r.data_publicacao) {
    const d = new Date(r.data_publicacao + "T12:00:00");
    linhas.push(`DATA DA ABERTURA: ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
  }
  if (r.municipio && r.uf) linhas.push(`LOCAL: ${r.municipio}/${r.uf}`);
  else if (r.uf) linhas.push(`UF: ${r.uf}`);
  if (r.portal) linhas.push(`FONTE: ${r.portal}`);
  if (r.url) { linhas.push(`ENTREGA DO EDITAL: Os interessados poderão retirar o edital no sítio:`); linhas.push(r.url); }
  return linhas.join("\n");
}

// ── Main Handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Não autorizado");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const {
      palavras_chave = ["licitação", "pregão", "obra", "construção", "pavimentação", "infraestrutura"],
      ufs = ["PA"],
      dias_retroativos = 7,
    } = body;

    console.log(`Busca diários: UFs=${ufs.join(",")}, dias=${dias_retroativos}, palavras=${palavras_chave.join(",")}`);

    // Run all API queries in parallel
    const promises: Promise<any[]>[] = [
      buscarPNCP(ufs, palavras_chave, dias_retroativos),
      buscarComprasGov(palavras_chave, dias_retroativos),
      buscarDOU(palavras_chave, dias_retroativos),
    ];

    // Add DOE + Gov.br scraping if Firecrawl is available
    if (FIRECRAWL_API_KEY) {
      promises.push(buscarDOEsFirecrawl(ufs, palavras_chave, FIRECRAWL_API_KEY));
      promises.push(buscarGovBrFirecrawl(palavras_chave, FIRECRAWL_API_KEY));
    }

    const [pncpResults, comprasGovResults, douResults, ...extraResults] = await Promise.all(promises);
    const doeResults = extraResults[0] || [];
    const govBrResults = extraResults[1] || [];

    let todosResultados = [...pncpResults, ...comprasGovResults, ...douResults, ...doeResults, ...govBrResults];
    console.log(`Total: ${todosResultados.length} (PNCP:${pncpResults.length} ComprasGov:${comprasGovResults.length} DOU:${douResults.length} DOE:${doeResults.length} Gov.br:${govBrResults.length})`);

    // Classify with AI
    if (LOVABLE_API_KEY && todosResultados.length > 0) {
      todosResultados = await classificarComIA(todosResultados, LOVABLE_API_KEY);
    }

    // Deduplicate
    const vistos = new Set<string>();
    todosResultados = todosResultados.filter(r => {
      const chave = `${r.titulo.substring(0, 60).toLowerCase()}_${r.orgao.substring(0, 30).toLowerCase()}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    todosResultados.sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0));
    todosResultados = todosResultados.slice(0, 150);

    // Prepare records
    const registros = todosResultados.map(r => ({
      user_id: user.id,
      titulo: r.titulo || "Sem título",
      orgao: r.orgao || "Órgão não identificado",
      tipo: r.tipo || "aviso_licitacao",
      portal: r.portal || "PNCP",
      data_publicacao: r.data_publicacao || new Date().toISOString().split("T")[0],
      valor_estimado: r.valor_estimado || null,
      municipio: r.municipio || null,
      uf: r.uf || null,
      url: r.url || null,
      relevancia_score: r.relevancia || 50,
      palavras_chave: r.palavras_chave_encontradas || [],
      cnae_compativel: true,
      lido: false,
      status: r.tipo || "novo",
      texto_integral: montarTextoIntegral(r),
    }));

    if (registros.length > 0) {
      const { error: deleteError } = await supabase
        .from("monitoramento_editais")
        .delete()
        .eq("user_id", user.id);
      if (deleteError) console.error("Delete old records error:", deleteError);

      const { error: insertError } = await supabase
        .from("monitoramento_editais")
        .insert(registros);
      if (insertError) console.error("Insert error:", insertError);
    }

    const fontes: string[] = [];
    if (pncpResults.length > 0) fontes.push(`PNCP (${pncpResults.length})`);
    if (comprasGovResults.length > 0) fontes.push(`Compras Gov (${comprasGovResults.length})`);
    if (douResults.length > 0) fontes.push(`DOU (${douResults.length})`);
    if (doeResults.length > 0) fontes.push(`DOE Estaduais (${doeResults.length})`);
    if (govBrResults.length > 0) fontes.push(`Gov.br (${govBrResults.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        total: todosResultados.length,
        fontes_reais: true,
        diarios_pesquisados: fontes,
        detalhes: {
          pncp: pncpResults.length,
          compras_gov: comprasGovResults.length,
          dou: douResults.length,
          doe_estaduais: doeResults.length,
          gov_br: govBrResults.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro busca-diarios-oficiais:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
