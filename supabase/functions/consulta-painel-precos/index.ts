import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PNCP_BASE = "https://pncp.gov.br/api/pncp/v1";
// A busca TEXTUAL oficial vive em outra base (a mesma que serve o app do
// portal); a de cima é a de detalhe (orgaos/compras/itens/resultados).
const CONSULTA_BASE = "https://pncp.gov.br/api/consulta/v1";
const FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Praefectus/1.0 (licitacoes@praefectus.com.br)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req, { functionName: "consulta-painel-precos", maxRequests: 20, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { termo, anoInicio, anoFim, uf, municipio, excluir } = await req.json();
    if (!termo) {
      return json({ error: "Termo de busca é obrigatório" }, 400);
    }

    const filtro: FiltroLocal = {
      uf: String(uf || "").trim().toUpperCase(),
      municipio: String(municipio || "").trim(),
    };

    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_KEY) {
      return json({ error: "Chave Firecrawl não configurada" }, 500);
    }

    const now = new Date();
    const yearEnd = anoFim || now.getFullYear();
    const yearStart = anoInicio || yearEnd - 2;

    const escopo = escopoLabel(filtro);
    console.log(`[painel-precos] Buscando "${termo}" de ${yearStart} a ${yearEnd} em ${escopo}`);

    // Phase 0 — A BASE responde por ela mesma: /contratacoes/publicacao?q=
    // é a busca oficial do PNCP (a mesma que serve pncp.gov.br/app). Perguntar
    // ao Google onde a base está (Firecrawl) virou COMPLEMENTO, não fonte
    // primária — o confronto de 03/09 mostrou a diferença de precisão.
    const linksOficiais = await buscaOficial(termo, filtro);
    console.log(`[painel-precos] ${linksOficiais.length} links pela API oficial`);

    // Phase 1 (complemento): Firecrawl/Google, só quando a oficial rendeu pouco
    const pncpLinksWeb = linksOficiais.length >= 3
      ? []
      : await findPncpLinks(termo, yearStart, yearEnd, FIRECRAWL_KEY, filtro);
    const vistosOficial = new Set(linksOficiais.map((l) => `${l.cnpj}/${l.ano}/${Number(l.seq)}`));
    const pncpLinksBrutos = [
      ...linksOficiais,
      ...pncpLinksWeb.filter((l) => !vistosOficial.has(`${l.cnpj}/${l.ano}/${Number(l.seq)}`)),
    ].slice(0, 24);
    // A contratação que ORIGINOU a cotação não pode cotar a si mesma: sem este
    // filtro, os estimados do próprio edital voltavam como "referência" e a
    // mediana virava a média das estimativas da própria Administração
    // (circular, e ainda misturando os demais itens do edital).
    const exc = excluir?.cnpj && excluir?.ano && excluir?.seq
      ? {
          cnpj: String(excluir.cnpj).replace(/\D/g, ""),
          ano: String(excluir.ano),
          seq: String(Number(excluir.seq)),
        }
      : null;
    const pncpLinks = exc
      ? pncpLinksBrutos.filter(
          (l) => !(l.cnpj === exc.cnpj && l.ano === exc.ano && String(Number(l.seq)) === exc.seq),
        )
      : pncpLinksBrutos;
    console.log(
      `[painel-precos] ${pncpLinks.length} links PNCP (oficial + web)` +
      (exc ? ` (${pncpLinksBrutos.length - pncpLinks.length} da própria contratação excluídos)` : ""),
    );

    if (pncpLinks.length === 0) {
      return json({
        success: true,
        termo,
        filtros: filtro,
        resultados: [],
        resumo: null,
        total_sem_filtro: 0,
        mensagem: "Nenhuma contratação encontrada para esse termo no período.",
      });
    }

    // Phase 2: Fetch items from PNCP API, mantendo só os da localidade pedida
    const { itens: allItems, totalSemFiltro } = await fetchAllItems(pncpLinks, termo, filtro);
    console.log(
      `[painel-precos] ${allItems.length} itens em ${escopo} (${totalSemFiltro} antes do filtro de localidade)`
    );

    // Sort by date descending
    const sorted = allItems.sort(
      (a, b) => new Date(b.data_compra || "2020-01-01").getTime() - new Date(a.data_compra || "2020-01-01").getTime()
    );

    // Fase 2 — resultado por item: fornecedor vencedor e valor homologado
    // REAL para os primeiros itens com resultado. Marca só quando o órgão
    // preencheu (em regra o PNCP não a registra — ressalva do dono, 03/09):
    // ausente vira null e a tela diz "não informada", nunca um palpite.
    await enriquecerComResultados(sorted);

    // Calculate stats
    const precos = sorted.filter((r) => r.preco_unitario > 0).map((r) => r.preco_unitario);
    // A mediana-âncora usa SÓ preços homologados: estimativa de edital não é
    // preço praticado (IN 65/2021, art. 5º, I — contratações CONCLUÍDAS).
    // Estimados continuam listados como contexto, com o selo dizendo o que são.
    const homologados = sorted
      .filter((r) => r.situacao === "Homologado" && r.preco_unitario > 0)
      .map((r) => r.preco_unitario);
    const resumo =
      precos.length > 0
        ? {
            menor_preco: Math.min(...precos),
            maior_preco: Math.max(...precos),
            preco_medio: +(precos.reduce((a, b) => a + b, 0) / precos.length).toFixed(2),
            mediana: homologados.length > 0 ? calcMediana(homologados) : null,
            total_homologados: homologados.length,
            total_registros: sorted.length,
            periodo: `${yearStart}-${yearEnd}`,
            escopo,
            fontes: ["PNCP - Portal Nacional de Contratações Públicas"],
          }
        : null;

    return json({
      success: true,
      termo,
      filtros: filtro,
      resultados: sorted.slice(0, 100),
      resumo,
      total_sem_filtro: totalSemFiltro,
      mensagem:
        sorted.length === 0 && totalSemFiltro > 0
          ? `Nenhum registro em ${escopo}. ${totalSemFiltro} registros existem em outras localidades.`
          : undefined,
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

type FiltroLocal = {
  uf: string;
  municipio: string;
};

/** Texto legível do escopo geográfico, para logs e mensagens ao usuário. */
function escopoLabel(filtro: FiltroLocal): string {
  if (filtro.municipio && filtro.uf) return `${filtro.municipio}/${filtro.uf}`;
  if (filtro.municipio) return filtro.municipio;
  if (filtro.uf) return filtro.uf;
  return "todo o Brasil";
}

/** Normaliza para comparar nomes de município (sem acento, sem caixa). */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .trim();
}

/** Mantém apenas contratações da UF/município pedidos. */
function matchLocal(item: any, filtro: FiltroLocal): boolean {
  if (filtro.uf && String(item.uf || "").toUpperCase() !== filtro.uf) return false;
  if (filtro.municipio && norm(item.municipio) !== norm(filtro.municipio)) return false;
  return true;
}

async function findPncpLinks(
  termo: string,
  yearStart: number,
  yearEnd: number,
  apiKey: string,
  filtro: FiltroLocal
): Promise<PncpLink[]> {
  // Direciona a busca para a localidade pedida (o filtro rígido vem depois, na API do PNCP)
  const local = [filtro.municipio, filtro.uf].filter(Boolean).join(" ");
  const comLocal = (q: string) => (local ? `${q} ${local}` : q);

  // Run multiple search queries in parallel for better coverage
  const queries = [
    comLocal(`"${termo}" site:pncp.gov.br/app/editais`),
    comLocal(`"${termo}" preço unitário ata registro preços site:pncp.gov.br`),
    comLocal(`"${termo}" pregão eletrônico site:pncp.gov.br`),
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
async function fetchAllItems(
  links: PncpLink[],
  termo: string,
  filtro: FiltroLocal
): Promise<{ itens: any[]; totalSemFiltro: number }> {
  const termoLower = termo.toLowerCase();
  const termoWords = termoLower.split(/\s+/).filter((w) => w.length > 2);
  const results: any[] = [];
  let totalSemFiltro = 0;

  // Process in parallel batches of 8
  const batchSize = 8;
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    const promises = batch.map((link) => fetchPncpItems(link, termoWords, termoLower));
    const batchResults = await Promise.allSettled(promises);

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value.length > 0) {
        totalSemFiltro += r.value.length;
        // O corte por localidade acontece antes do teto de 80, para não
        // encher a cota com registros de outros estados.
        results.push(...r.value.filter((item) => matchLocal(item, filtro)));
      }
    }

    if (results.length >= 80) break;
  }

  return { itens: results, totalSemFiltro };
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

      const municipio =
        contratacao?.unidadeOrgao?.municipioNome ||
        contratacao?.unidadeOrgao?.municipio?.nome ||
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
        municipio,
        fonte: "PNCP",
        url: `https://pncp.gov.br/app/editais/${link.cnpj}/${link.ano}/${link.seq}`,
        numero_compra: contratacao?.numeroCompra || `${link.ano}/${link.seq}`,
        tipo_registro: tipoRegistro,
        situacao: isHomologado ? "Homologado" : "Estimado",
        match_score: matchScore,
        numero_item: item.numeroItem ?? null,
        tem_resultado: Boolean(item.temResultado),
        _coords: { cnpj: link.cnpj, ano: link.ano, seq: link.seq },
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


// ============================================================
// Fase 0: busca oficial por texto na API de consulta do PNCP
// ============================================================
async function buscaOficial(termo: string, filtro: FiltroLocal): Promise<PncpLink[]> {
  // Modalidades com volume de fornecimento: pregão-e, dispensa,
  // concorrência-e, inexigibilidade. 3 janelas anuais (limite do endpoint).
  const MODS = [6, 8, 4, 9];
  const hoje = new Date();
  const janelas: Array<[string, string]> = [];
  for (let a = 0; a < 3; a++) {
    const fim = new Date(hoje);
    fim.setFullYear(hoje.getFullYear() - a);
    const ini = new Date(fim);
    ini.setFullYear(fim.getFullYear() - 1);
    ini.setDate(ini.getDate() + 1);
    janelas.push([
      ini.toISOString().slice(0, 10).replace(/-/g, ""),
      fim.toISOString().slice(0, 10).replace(/-/g, ""),
    ]);
  }
  const links: PncpLink[] = [];
  for (const [ini, fim] of janelas) {
    for (const m of MODS) {
      const p = new URLSearchParams({
        q: termo,
        codigoModalidadeContratacao: String(m),
        dataInicial: ini,
        dataFinal: fim,
        pagina: "1",
        tamanhoPagina: "50",
      });
      if (filtro.uf) p.set("uf", filtro.uf.toUpperCase());
      try {
        const r = await fetch(`${CONSULTA_BASE}/contratacoes/publicacao?${p}`, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(12_000),
        });
        if (r.ok) {
          const d = await r.json();
          for (const raw of (d?.data || []) as Record<string, any>[]) {
            const o = raw?.orgaoEntidade || {};
            if (o.cnpj && raw.anoCompra && raw.sequencialCompra) {
              links.push({
                cnpj: String(o.cnpj),
                ano: String(raw.anoCompra),
                seq: String(raw.sequencialCompra),
                title: raw.objetoCompra || "",
                orgao: o.razaoSocial || "",
                dataPublicacao: raw.dataPublicacaoPncp || "",
              });
            }
          }
        }
      } catch (_) { /* janela indisponível: as demais seguem */ }
      // Espaçamento anti-429 — regra operacional do portal.
      await new Promise((res) => setTimeout(res, 400));
    }
  }
  return links;
}

// ============================================================
// Fase 2: resultado por item — fornecedor vencedor e marca (quando houver)
// ============================================================
async function enriquecerComResultados(sorted: any[]): Promise<void> {
  const alvos = sorted
    .filter((r) => r.tem_resultado && r._coords && r.numero_item != null)
    .slice(0, 8);
  for (const r of alvos) {
    try {
      const url = `${PNCP_BASE}/orgaos/${r._coords.cnpj}/compras/${r._coords.ano}/${r._coords.seq}/itens/${r.numero_item}/resultados`;
      const resp = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!resp.ok) continue;
      const resultados = await resp.json();
      const res = Array.isArray(resultados) ? resultados[0] : null;
      if (!res) continue;
      r.fornecedor = res.nomeRazaoSocialFornecedor || null;
      r.marca = res.marca || res.marcaItem || null;
      if (res.valorUnitarioHomologado) {
        r.preco_unitario = Number(res.valorUnitarioHomologado);
        r.situacao = "Homologado";
      }
      r.data_resultado = String(res.dataResultado || "").slice(0, 10) || null;
    } catch (_) { /* item sem resultado alcançável: segue sem enriquecer */ }
    await new Promise((res) => setTimeout(res, 300));
  }
  // _coords é andaime interno — não vaza na resposta.
  for (const r of sorted) delete r._coords;
}
