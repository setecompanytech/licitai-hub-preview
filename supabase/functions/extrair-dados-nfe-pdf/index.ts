// v2
import { chamarClaude, parsearJson } from "../_shared/claude-client.ts";
import { requireAuth } from "../_shared/auth-rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SISTEMA = `Você é especialista em NF-e brasileira (NF-e 4.0).
Seu trabalho é extrair dados de um DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) em PDF.
Retorne APENAS JSON válido, sem markdown, sem comentários, sem texto fora do JSON.
Se um campo não estiver legível, use string vazia "" para texto e 0 para números.
Chave de acesso: código de 44 dígitos numéricos impresso no topo, após "CHAVE DE ACESSO" ou como código de barras. Remova todos os espaços.`;

const INSTRUCAO = `Extraia os dados deste DANFE e retorne exatamente neste formato JSON:
{
  "chave_acesso": "",
  "numero_nf": 0,
  "serie": 1,
  "nat_op": "",
  "data_emissao": "",
  "crt_emitente": 1,
  "cnpj_emitente": "",
  "nome_emitente": "",
  "ie_emitente": "",
  "uf_emitente": "",
  "logradouro_emitente": "",
  "numero_emitente": "",
  "bairro_emitente": "",
  "cep_emitente": "",
  "municipio_emitente": "",
  "fone_emitente": "",
  "cnpj_dest": "",
  "cpf_dest": "",
  "nome_dest": "",
  "ie_dest": "",
  "uf_dest": "",
  "v_prod": 0,
  "v_frete": 0,
  "v_seg": 0,
  "v_desc": 0,
  "v_ipi": 0,
  "v_icms": 0,
  "v_pis": 0,
  "v_cofins": 0,
  "v_nf": 0,
  "inf_compl": "",
  "itens": [
    {
      "n_item": 1,
      "c_prod": "",
      "c_ean": "",
      "x_prod": "",
      "ncm": "",
      "cfop": "",
      "u_com": "UN",
      "q_com": 0,
      "v_un_com": 0,
      "v_prod": 0,
      "v_desc": 0,
      "cst_icms": "",
      "csosn": "",
      "cst_pis": "07",
      "cst_cofins": "07",
      "p_icms": 0,
      "p_pis": 0,
      "p_cofins": 0,
      "v_pis": 0,
      "v_cofins": 0,
      "inf_ad_prod": ""
    }
  ]
}

Regras:
- chave_acesso: apenas os 44 dígitos, sem espaços ou pontos
- cnpj_emitente, cnpj_dest, cpf_dest: apenas dígitos, sem pontuação
- cep_emitente: apenas dígitos, sem hífen
- data_emissao: formato YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DD
- crt_emitente: 1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal
- v_nf é o valor total da nota fiscal
- Extraia todos os itens da tabela de produtos do DANFE`;

function norm(v: unknown, digits = false): string {
  const s = String(v ?? "").trim();
  return digits ? s.replace(/\D/g, "") : s;
}
function n(v: unknown): number {
  const x = Number(String(v ?? "0").replace(",", "."));
  return isFinite(x) ? x : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try {
      await requireAuth(req, { functionName: "extrair-dados-nfe-pdf", maxRequests: 10, windowMinutes: 5 });
    } catch (authResp) {
      if (authResp instanceof Response) return authResp;
      throw authResp;
    }

    const { pdf_base64 } = await req.json().catch(() => ({}));
    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: "pdf_base64 obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = await chamarClaude(
      INSTRUCAO,
      { pdfBase64: pdf_base64 },
      { sistema: SISTEMA, maxTokens: 4000 }
    );

    const p = parsearJson<any>(resultado);

    const data = {
      chave_acesso: norm(p.chave_acesso, true).slice(0, 44),
      numero_nf: n(p.numero_nf),
      serie: n(p.serie) || 1,
      modelo: 55,
      nat_op: norm(p.nat_op),
      data_emissao: norm(p.data_emissao),
      tipo_nf: "entrada" as const,
      crt_emitente: n(p.crt_emitente) || 1,
      cnpj_emitente: norm(p.cnpj_emitente, true),
      nome_emitente: norm(p.nome_emitente),
      ie_emitente: norm(p.ie_emitente),
      uf_emitente: norm(p.uf_emitente),
      logradouro_emitente: norm(p.logradouro_emitente),
      numero_emitente: norm(p.numero_emitente),
      bairro_emitente: norm(p.bairro_emitente),
      cep_emitente: norm(p.cep_emitente, true),
      municipio_emitente: norm(p.municipio_emitente),
      fone_emitente: norm(p.fone_emitente),
      cnpj_dest: norm(p.cnpj_dest, true),
      cpf_dest: norm(p.cpf_dest, true),
      nome_dest: norm(p.nome_dest),
      ie_dest: norm(p.ie_dest),
      uf_dest: norm(p.uf_dest),
      email_dest: "",
      ind_ie_dest: 9,
      v_bc: 0,
      v_icms: n(p.v_icms),
      v_pis: n(p.v_pis),
      v_cofins: n(p.v_cofins),
      v_ipi: n(p.v_ipi),
      v_prod: n(p.v_prod),
      v_frete: n(p.v_frete),
      v_seg: n(p.v_seg),
      v_desc: n(p.v_desc),
      v_nf: n(p.v_nf),
      v_ibs: 0,
      v_cbs: 0,
      ir_retido: 0,
      csll_retido: 0,
      pis_retido: 0,
      cofins_retido: 0,
      inss_retido: 0,
      inf_compl: norm(p.inf_compl),
      protocolo_auth: "",
      data_autorizacao: "",
      status_sefaz: "",
      codigo_status: 0,
      motivo_status: "",
      itens: Array.isArray(p.itens) ? p.itens.map((item: any, i: number) => ({
        n_item: n(item.n_item) || (i + 1),
        c_prod: norm(item.c_prod),
        c_ean: norm(item.c_ean),
        x_prod: norm(item.x_prod),
        ncm: norm(item.ncm),
        cest: norm(item.cest),
        cfop: norm(item.cfop),
        u_com: norm(item.u_com) || "UN",
        q_com: n(item.q_com),
        v_un_com: n(item.v_un_com),
        v_prod: n(item.v_prod),
        v_desc: n(item.v_desc),
        cst_icms: norm(item.cst_icms),
        csosn: norm(item.csosn),
        cst_pis: norm(item.cst_pis) || "07",
        cst_cofins: norm(item.cst_cofins) || "07",
        p_icms: n(item.p_icms),
        p_pis: n(item.p_pis),
        p_cofins: n(item.p_cofins),
        v_pis: n(item.v_pis),
        v_cofins: n(item.v_cofins),
        cst_ibs_cbs: norm(item.cst_ibs_cbs),
        c_class_trib: norm(item.c_class_trib),
        v_ibs: 0,
        v_cbs: 0,
        inf_ad_prod: norm(item.inf_ad_prod),
      })) : [],
    };

    console.log(`[extrair-dados-nfe-pdf] chave=${data.chave_acesso} nf=${data.numero_nf} itens=${data.itens.length}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[extrair-dados-nfe-pdf]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
