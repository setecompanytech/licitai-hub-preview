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

    // ── Fetch contratação details + itens in parallel ──
    const baseUrl = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const [detalheResp, itensResp] = await Promise.allSettled([
      fetch(baseUrl, { headers: FETCH_HEADERS, signal: controller.signal }),
      fetch(`${baseUrl}/itens`, { headers: FETCH_HEADERS, signal: controller.signal }),
    ]);

    clearTimeout(timeout);

    // ── Parse detalhes ──
    let detalhe: any = null;
    if (detalheResp.status === "fulfilled" && detalheResp.value.ok) {
      detalhe = await detalheResp.value.json();
    } else {
      // Try alternative endpoint
      try {
        const altResp = await fetch(
          `https://pncp.gov.br/api/consulta/v1/contratacoes/${cnpj}/${ano}/${seq}`,
          { headers: FETCH_HEADERS }
        );
        if (altResp.ok) detalhe = await altResp.json();
      } catch { /* ignore */ }
    }

    if (!detalhe) {
      return new Response(JSON.stringify({
        success: false,
        error: "Não foi possível obter os detalhes desta licitação no PNCP.",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse itens ──
    let itens: any[] = [];
    if (itensResp.status === "fulfilled" && itensResp.value.ok) {
      const itensData = await itensResp.value.json();
      itens = Array.isArray(itensData) ? itensData : (itensData?.data || itensData?.itens || []);
    }

    // ── Normalize response ──
    const resultado = {
      success: true,
      // Dados básicos
      numero_compra: detalhe.numeroCompra || detalhe.numeroControlePNCP || "",
      numero_controle_pncp: detalhe.numeroControlePNCP || "",
      objeto: detalhe.objetoCompra || detalhe.objeto || "",
      
      // Órgão
      orgao: detalhe.orgaoEntidade?.razaoSocial || detalhe.nomeUnidadeCompradora || "",
      cnpj_orgao: detalhe.orgaoEntidade?.cnpj || cnpj,
      orgao_sub_rogado: detalhe.orgaoSubRogado?.razaoSocial || null,
      unidade_orgao: detalhe.unidadeOrgao?.nomeUnidade || "",
      
      // Modalidade e tipo
      modalidade: detalhe.modalidadeNome || detalhe.modalidade?.descricao || "",
      modalidade_id: detalhe.modalidadeId || detalhe.codigoModalidadeContratacao || null,
      
      // ── DADOS CRÍTICOS QUE FALTAVAM ──
      modo_disputa: detalhe.modoDisputaNome || detalhe.modoDisputa?.descricao || null,
      modo_disputa_id: detalhe.modoDisputaId || null,
      criterio_julgamento: detalhe.criterioJulgamentoNome || detalhe.criterioJulgamento?.descricao || null,
      criterio_julgamento_id: detalhe.criterioJulgamentoId || null,
      tipo_contratacao: detalhe.tipoContratacao || null,
      tipo_instrumento_convocatorio: detalhe.tipoInstrumentoConvocatorioNome || null,
      srp: detalhe.srp || false,
      amparo_legal: detalhe.amparoLegal?.descricao || detalhe.amparoLegalNome || null,
      fonte_orcamentaria: detalhe.fonteOrcamentaria || null,
      fonte_sistema: detalhe.linkSistemaOrigem ? 'Compras.gov.br' : null,
      informacao_complementar: detalhe.informacaoComplementar || null,
      processo_administrativo: detalhe.processo || detalhe.processoAdministrativo || null,
      
      // Situação
      situacao: detalhe.situacaoCompraNome || detalhe.situacao?.descricao || "",
      situacao_id: detalhe.situacaoCompraId || null,
      justificativa: detalhe.justificativa || null,
      
      // Valores
      valor_total_estimado: detalhe.valorTotalEstimado || null,
      valor_total_homologado: detalhe.valorTotalHomologado || null,
      
      // Datas REAIS do PNCP
      data_publicacao_pncp: detalhe.dataPublicacaoPncp || null,
      data_abertura_proposta: detalhe.dataAberturaProposta || null,
      data_encerramento_proposta: detalhe.dataEncerramentoProposta || null,
      data_inclusao: detalhe.dataInclusao || null,
      data_atualizacao: detalhe.dataAtualizacao || null,
      
      // Localização
      uf: detalhe.unidadeOrgao?.ufSigla || detalhe.orgaoEntidade?.ufSigla || "",
      municipio: detalhe.unidadeOrgao?.municipioNome || "",
      
      // Links
      link_sistema_origem: detalhe.linkSistemaOrigem || null,
      link_edital: detalhe.linkEdital || null,
      
      // Itens (dados reais extraídos da API, NÃO da IA)
      itens: itens.map((item: any, idx: number) => ({
        numero: item.numeroItem || (idx + 1),
        descricao: item.descricao || item.materialServico?.descricao || "",
        quantidade: item.quantidade || 0,
        unidade_medida: item.unidadeMedida || "",
        valor_unitario_estimado: item.valorUnitarioEstimado || 0,
        valor_total: item.valorTotal || (item.quantidade || 0) * (item.valorUnitarioEstimado || 0),
        criterio_julgamento_item: item.criterioJulgamento || null,
        situacao: item.situacaoCompraItemNome || item.situacao || "",
        tipo_beneficio: item.tipoBeneficioNome || null,
        incentivoProdutivoBasico: item.incentivoProdutivoBasico || false,
        // Dados do fornecedor vencedor (se homologado)
        fornecedor_nome: item.nomeRazaoSocialFornecedor || null,
        fornecedor_cnpj: item.cnpjCpfFornecedor || null,
        valor_unitario_homologado: item.valorUnitarioHomologado || null,
        marca: item.marca || null,
        fabricante: item.fabricante || null,
        modelo: item.modelo || null,
      })),
      
      total_itens: itens.length,
      
      // Metadados
      fonte: "PNCP API Oficial",
      url_pncp: `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${seq}`,
      consultado_em: new Date().toISOString(),
    };

    console.log(`PNCP detalhe: ${resultado.objeto.substring(0, 80)} | ${resultado.total_itens} itens | modo=${resultado.modo_disputa} | criterio=${resultado.criterio_julgamento}`);

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
