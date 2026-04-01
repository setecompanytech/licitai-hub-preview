import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

const PNCP_ITEMS_PAGE_SIZE = 100;
const PNCP_ITEMS_MAX_PAGES = 10;

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PNCP ${response.status} em ${url}: ${body.slice(0, 300)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry(url: string, timeoutMs = 12000, retries = 2): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJsonWithTimeout(url, timeoutMs);
    } catch (err) {
      const isLast = attempt === retries;
      if (isLast) throw err;
      const delay = 1000 * (attempt + 1);
      console.warn(`PNCP tentativa ${attempt + 1} falhou, retrying em ${delay}ms...`, (err as Error).message);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

function extractItensArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;

    if (Array.isArray(data.data)) {
      return data.data.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }

    if (Array.isArray(data.itens)) {
      return data.itens.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }

  return [];
}

async function fetchPncpItens(cnpj: string, ano: string, seq: string) {
  const baseUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`;

  try {
    const collected: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= PNCP_ITEMS_MAX_PAGES; page += 1) {
      const pageUrl = `${baseUrl}?pagina=${page}&tamanhoPagina=${PNCP_ITEMS_PAGE_SIZE}`;
      const pageItems = extractItensArray(await fetchJsonWithRetry(pageUrl, 12000, 1));

      if (pageItems.length === 0) break;

      for (const item of pageItems) {
        const dedupKey = String(item.numeroItem ?? item.id ?? `${page}-${collected.length}`);
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        collected.push(item);
      }

      if (pageItems.length < PNCP_ITEMS_PAGE_SIZE) break;
    }

    if (collected.length > 0) {
      return collected;
    }
  } catch (error) {
    console.warn("Falha ao paginar itens do PNCP, usando fallback simples:", error);
  }

  return extractItensArray(await fetchJsonWithRetry(baseUrl, 10000, 1));
}

function formatFonteOrcamentaria(fontes: unknown): string | null {
  if (!Array.isArray(fontes) || fontes.length === 0) return null;

  const formatted = fontes
    .map((fonte) => {
      if (!fonte) return null;
      if (typeof fonte === "string") return fonte;
      if (typeof fonte !== "object") return String(fonte);

      const item = fonte as Record<string, unknown>;
      const parts = [
        item.codigoFonte ? String(item.codigoFonte) : null,
        item.descricao ? String(item.descricao) : null,
        item.nome ? String(item.nome) : null,
        item.fonte ? String(item.fonte) : null,
      ].filter(Boolean);

      return parts.length > 0 ? parts.join(" - ") : JSON.stringify(item);
    })
    .filter(Boolean);

  return formatted.length > 0 ? formatted.join(" • ") : null;
}

function resolveFonteSistema(detalhe: Record<string, unknown>): string | null {
  if (typeof detalhe.usuarioNome === "string" && detalhe.usuarioNome.trim()) {
    return detalhe.usuarioNome.trim();
  }

  if (typeof detalhe.linkSistemaOrigem === "string" && detalhe.linkSistemaOrigem) {
    try {
      const hostname = new URL(detalhe.linkSistemaOrigem).hostname.toLowerCase();
      if (hostname.includes("comprasnet") || hostname.includes("compras.gov")) return "Compras.gov.br";
      return hostname.replace(/^www\./, "");
    } catch {
      return detalhe.linkSistemaOrigem;
    }
  }

  return null;
}

function resolveUnidadeOrgao(unidade: unknown): string {
  if (!unidade || typeof unidade !== "object") return "";

  const unidadeData = unidade as Record<string, unknown>;
  const codigo = typeof unidadeData.codigoUnidade === "string" || typeof unidadeData.codigoUnidade === "number"
    ? String(unidadeData.codigoUnidade)
    : "";
  const nome = typeof unidadeData.nomeUnidade === "string" ? unidadeData.nomeUnidade : "";

  return [codigo, nome].filter(Boolean).join(" - ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAuth(req, { functionName: "detalhe-licitacao-pncp", maxRequests: 30, windowMinutes: 5 });
  } catch (authResp) {
    if (authResp instanceof Response) return authResp;
    throw authResp;
  }

  try {
    const { cnpjOrgao, anoCompra, sequencialCompra } = await req.json();

    if (!cnpjOrgao || !anoCompra || !sequencialCompra) {
      return new Response(JSON.stringify({ error: "cnpjOrgao, anoCompra e sequencialCompra são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpj = String(cnpjOrgao).replace(/\D/g, "");
    const ano = String(anoCompra);
    const seq = String(sequencialCompra);

    console.log(`Buscando detalhes PNCP: ${cnpj}/${ano}/${seq}`);

    const detalheUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;

    const [detalheResult, itensResult] = await Promise.allSettled([
      fetchJsonWithTimeout(detalheUrl, 15000),
      fetchPncpItens(cnpj, ano, seq),
    ]);

    if (detalheResult.status !== "fulfilled") {
      console.error("Erro ao buscar detalhe principal do PNCP:", detalheResult.reason);
      return new Response(JSON.stringify({
        success: false,
        error: "Não foi possível obter os detalhes desta licitação no PNCP.",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detalhe = detalheResult.value as Record<string, unknown>;

    let itens: Record<string, unknown>[] = [];
    if (itensResult.status === "fulfilled") {
      itens = itensResult.value;
    } else {
      console.warn("Itens PNCP indisponíveis para esta contratação:", itensResult.reason);
    }

    const valorTotalEstimado = typeof detalhe.valorTotalEstimado === "number" && detalhe.valorTotalEstimado > 0
      ? detalhe.valorTotalEstimado
      : null;
    const valorTotalHomologado = typeof detalhe.valorTotalHomologado === "number" && detalhe.valorTotalHomologado > 0
      ? detalhe.valorTotalHomologado
      : null;

    const resultado = {
      success: true,
      numero_compra: detalhe.numeroCompra || detalhe.numeroControlePNCP || "",
      numero_controle_pncp: detalhe.numeroControlePNCP || "",
      objeto: detalhe.objetoCompra || detalhe.objeto || "",

      orgao: (detalhe.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial || "",
      cnpj_orgao: (detalhe.orgaoEntidade as Record<string, unknown> | undefined)?.cnpj || cnpj,
      orgao_sub_rogado: (detalhe.orgaoSubRogado as Record<string, unknown> | undefined)?.razaoSocial || null,
      unidade_orgao: resolveUnidadeOrgao(detalhe.unidadeOrgao),

      modalidade: detalhe.modalidadeNome || (detalhe.modalidade as Record<string, unknown> | undefined)?.descricao || "",
      modalidade_id: detalhe.modalidadeId || detalhe.codigoModalidadeContratacao || null,
      modo_disputa: detalhe.modoDisputaNome || (detalhe.modoDisputa as Record<string, unknown> | undefined)?.descricao || null,
      modo_disputa_id: detalhe.modoDisputaId || null,
      criterio_julgamento: detalhe.criterioJulgamentoNome || (detalhe.criterioJulgamento as Record<string, unknown> | undefined)?.descricao || null,
      criterio_julgamento_id: detalhe.criterioJulgamentoId || null,
      tipo_contratacao: detalhe.tipoContratacao || null,
      tipo_instrumento_convocatorio: detalhe.tipoInstrumentoConvocatorioNome || null,
      srp: detalhe.srp || false,
      amparo_legal: (detalhe.amparoLegal as Record<string, unknown> | undefined)?.nome
        || (detalhe.amparoLegal as Record<string, unknown> | undefined)?.descricao
        || detalhe.amparoLegalNome
        || null,
      fonte_orcamentaria: formatFonteOrcamentaria(detalhe.fontesOrcamentarias || detalhe.fonteOrcamentaria),
      fonte_sistema: resolveFonteSistema(detalhe),
      informacao_complementar: detalhe.informacaoComplementar || null,
      processo_administrativo: detalhe.processo || detalhe.processoAdministrativo || null,

      situacao: detalhe.situacaoCompraNome || (detalhe.situacao as Record<string, unknown> | undefined)?.descricao || "",
      situacao_id: detalhe.situacaoCompraId || null,
      justificativa: detalhe.justificativa || null,

      valor_total_estimado: valorTotalEstimado,
      valor_total_homologado: valorTotalHomologado,

      data_publicacao_pncp: detalhe.dataPublicacaoPncp || null,
      data_abertura_proposta: detalhe.dataAberturaProposta || null,
      data_encerramento_proposta: detalhe.dataEncerramentoProposta || null,
      data_inclusao: detalhe.dataInclusao || null,
      data_atualizacao: detalhe.dataAtualizacao || null,

      uf: (detalhe.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla
        || (detalhe.orgaoEntidade as Record<string, unknown> | undefined)?.ufSigla
        || "",
      municipio: (detalhe.unidadeOrgao as Record<string, unknown> | undefined)?.municipioNome || "",

      link_sistema_origem: detalhe.linkSistemaOrigem || null,
      link_edital: detalhe.linkEdital || null,

      itens: itens.map((item: Record<string, unknown>, idx: number) => ({
        numero: item.numeroItem || (idx + 1),
        descricao: item.descricao || (item.materialServico as Record<string, unknown> | undefined)?.descricao || "",
        quantidade: item.quantidade || 0,
        unidade_medida: item.unidadeMedida || "",
        valor_unitario_estimado: item.valorUnitarioEstimado || 0,
        valor_total: item.valorTotal || (Number(item.quantidade || 0) * Number(item.valorUnitarioEstimado || 0)),
        criterio_julgamento_item: item.criterioJulgamentoNome || item.criterioJulgamento || null,
        situacao: item.situacaoCompraItemNome || item.situacao || "",
        tipo_beneficio: item.tipoBeneficioNome || null,
        fornecedor_nome: item.nomeRazaoSocialFornecedor || null,
        marca: item.marca || null,
      })),

      total_itens: itens.length,
      fonte: "PNCP API Oficial",
      url_pncp: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
      consultado_em: new Date().toISOString(),
    };

    console.log(`PNCP detalhe OK: ${String(resultado.numero_controle_pncp)} | itens=${resultado.total_itens} | fonte=${resultado.fonte_sistema}`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro detalhe PNCP:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Erro ao consultar PNCP",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});