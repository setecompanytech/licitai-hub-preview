// =============================================================================
// PRAEFECTUS — Edge Function: emitir-nfe
// Emissão de NF-e (modelo 55) e NFC-e (modelo 65) via Focus NFe.
// Adaptado ao schema user_id/empresa_id do Praefectus.
// =============================================================================
// Secrets necessários:
//   FOCUS_NFE_API_TOKEN   → token único Focus NFe
//   FOCUS_NFE_AMBIENTE    → 'homologacao' (default) | 'producao'
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API_HOMOLOG = "https://homologacao.focusnfe.com.br";
const FOCUS_API_PROD = "https://api.focusnfe.com.br";

function focusBase(): string {
  const amb = Deno.env.get("FOCUS_NFE_AMBIENTE") ?? "homologacao";
  return amb === "producao" ? FOCUS_API_PROD : FOCUS_API_HOMOLOG;
}
function focusAuth(): string {
  const token = Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "";
  return "Basic " + btoa(token + ":");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
};

interface ItemNFe {
  codigo: string;
  descricao: string;
  ncm: string;
  cest?: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms?: { origem: string; cst: string; aliquota: number; base_calculo?: number; valor?: number };
  pis?: { cst: string; aliquota: number; valor?: number };
  cofins?: { cst: string; aliquota: number; valor?: number };
  ipi?: { cst: string; aliquota: number; valor?: number };
}

interface EmitirNFeRequest {
  cnpj_emitente: string;
  natureza_operacao: string;
  finalidade?: "1" | "2" | "3" | "4";
  presenca?: "0" | "1" | "2" | "3" | "4" | "9";
  consumidor_final?: boolean;
  destinatario: {
    cnpj?: string; cpf?: string; razao_social: string;
    inscricao_estadual?: string; email?: string;
    endereco: {
      logradouro: string; numero: string; complemento?: string; bairro: string;
      municipio: string; uf: string; cep: string; codigo_municipio?: string;
    };
  };
  itens: ItemNFe[];
  pagamentos?: Array<{ forma: string; valor: number }>;
  informacoes_adicionais?: string;
  empresa_id?: string;
  transporte?: {
    modalidade_frete?: string;
    transportador_nome?: string;
    transportador_doc?: string;
    transportador_ie?: string;
    transportador_endereco?: string;
    transportador_municipio?: string;
    transportador_uf?: string;
    placa_veiculo?: string;
    uf_veiculo?: string;
    rntrc_antt?: string;
    qtd_volumes?: string | number;
    especie?: string;
    marca_volumes?: string;
    numeracao_volumes?: string;
    peso_bruto?: string | number;
    peso_liquido?: string | number;
  };
  // SEFAZ 4.00 — Sprints 1/2/3
  fiscais?: {
    tpNF?: "0" | "1";
    indFinal?: "0" | "1";
    idDest?: "1" | "2" | "3";
    tpEmis?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "9";
    refNFe?: string;
    numero_manual?: number;
    autXML?: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "emitir-nfe";

  try {
    // Auth: extrai user_id do JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return error(401, "missing_auth");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) return error(401, "invalid_auth");
    const userId = userData.user.id;

    // Service role para escritas
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!Deno.env.get("FOCUS_NFE_API_TOKEN")) {
      return error(503, "FOCUS_NFE_API_TOKEN não configurado. Adicione o secret nas configurações da Lovable Cloud.");
    }

    switch (action) {
      case "emitir-nfe":     return await handleEmitirNFe(req, supabase, userId, "55");
      case "emitir-nfce":    return await handleEmitirNFe(req, supabase, userId, "65");
      case "consultar":      return await handleConsultar(req, supabase, userId);
      case "cancelar":       return await handleCancelar(req, supabase, userId);
      case "carta-correcao": return await handleCartaCorrecao(req, supabase, userId);
      case "inutilizar":     return await handleInutilizar(req, supabase, userId);
      case "webhook":        return await handleWebhook(req, supabase);
      default:               return error(400, "invalid_action");
    }
  } catch (e) {
    console.error("[emitir-nfe]", e);
    return error(500, e instanceof Error ? e.message : String(e));
  }
});

async function handleEmitirNFe(req: Request, supabase: any, userId: string, modelo: "55" | "65"): Promise<Response> {
  const body: EmitirNFeRequest = await req.json();
  const refUnico = crypto.randomUUID();
  const ambiente = Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao" ? "producao" : "homologacao";

  const valorTotal = body.itens.reduce((s, i) => s + i.valor_total, 0);

  const { data: nfeLocal, error: localErr } = await supabase
    .from("financeiro_nfes_emitidas")
    .insert({
      user_id: userId,
      empresa_id: body.empresa_id ?? null,
      modelo: modelo === "55" ? "nfe" : "nfce",
      uuid_provedor: refUnico,
      status: "em_processamento",
      ambiente,
      cfop: body.itens[0]?.cfop,
      natureza_operacao: body.natureza_operacao,
      finalidade: body.finalidade ?? "1",
      consumidor_final: body.consumidor_final ?? true,
      presenca: body.presenca ?? "9",
      destinatario_dados: body.destinatario,
      itens: body.itens,
      valor_produtos: valorTotal,
      valor_total: valorTotal,
      provedor: "focus_nfe",
    })
    .select()
    .single();

  if (localErr) throw new Error(`criar_local: ${localErr.message}`);

  const t = body.transporte ?? {};
  const transporteFields: Record<string, unknown> = {
    modalidade_frete: t.modalidade_frete ?? "9",
  };
  if (t.transportador_nome) transporteFields.nome_transportador = t.transportador_nome;
  const docTransp = (t.transportador_doc ?? "").replace(/\D/g, "");
  if (docTransp.length === 14) transporteFields.cnpj_transportador = docTransp;
  else if (docTransp.length === 11) transporteFields.cpf_transportador = docTransp;
  if (t.transportador_ie) transporteFields.inscricao_estadual_transportador = t.transportador_ie;
  if (t.transportador_endereco) transporteFields.endereco_transportador = t.transportador_endereco;
  if (t.transportador_municipio) transporteFields.municipio_transportador = t.transportador_municipio;
  if (t.transportador_uf) transporteFields.uf_transportador = t.transportador_uf.toUpperCase();
  if (t.placa_veiculo) transporteFields.placa_veiculo_transportador = t.placa_veiculo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.uf_veiculo) transporteFields.uf_veiculo_transportador = t.uf_veiculo.toUpperCase();
  if (t.rntrc_antt) transporteFields.rntc_veiculo_transportador = t.rntrc_antt.replace(/\D/g, "");
  if (t.qtd_volumes) transporteFields.quantidade_volumes_transportados = String(t.qtd_volumes);
  if (t.especie) transporteFields.especie_volumes_transportados = t.especie;
  if (t.marca_volumes) transporteFields.marca_volumes_transportados = t.marca_volumes;
  if (t.numeracao_volumes) transporteFields.numeracao_volumes_transportados = t.numeracao_volumes;
  if (t.peso_bruto) transporteFields.peso_bruto_total = String(t.peso_bruto).replace(",", ".");
  if (t.peso_liquido) transporteFields.peso_liquido_total = String(t.peso_liquido).replace(",", ".");

  // ===== SEFAZ 4.00 — Sprints 1/2/3 =====
  const f = body.fiscais ?? {};
  const fiscaisFields: Record<string, unknown> = {};
  // tpNF — tipo de operação (entrada/saída)
  fiscaisFields.tipo_documento = f.tpNF ?? "1";
  // indFinal — consumidor final
  fiscaisFields.consumidor_final = (f.indFinal ?? "1") === "1" ? "1" : "0";
  // idDest — destino da operação
  if (f.idDest) fiscaisFields.local_destino = f.idDest;
  // tpEmis — tipo de emissão (contingência)
  if (f.tpEmis) fiscaisFields.forma_emissao = f.tpEmis;
  // refNFe — chave da NF-e referenciada (devolução)
  if (f.refNFe && /^\d{44}$/.test(f.refNFe)) {
    fiscaisFields.notas_fiscais_referenciadas = [{ chave_acesso_nfe_referenciada: f.refNFe }];
  }
  // Numeração manual (override)
  if (f.numero_manual && Number.isInteger(f.numero_manual) && f.numero_manual > 0) {
    fiscaisFields.numero = f.numero_manual;
  }
  // autXML — CNPJs autorizados a baixar XML (até 10)
  if (Array.isArray(f.autXML) && f.autXML.length > 0) {
    fiscaisFields.autorizados_baixar_xml = f.autXML
      .map((c) => c.replace(/\D/g, ""))
      .filter((c) => c.length === 14)
      .slice(0, 10)
      .map((cnpj) => ({ cnpj }));
  }

  const payload = {
    natureza_operacao: body.natureza_operacao,
    data_emissao: new Date().toISOString(),
    data_entrada_saida: new Date().toISOString(),
    finalidade_emissao: body.finalidade ?? "1",
    cnpj_emitente: body.cnpj_emitente.replace(/\D/g, ""),
    presenca_comprador: body.presenca ?? "9",
    ...fiscaisFields,
    ...transporteFields,
    nome_destinatario: body.destinatario.razao_social,
    cnpj_destinatario: body.destinatario.cnpj?.replace(/\D/g, ""),
    cpf_destinatario: body.destinatario.cpf?.replace(/\D/g, ""),
    inscricao_estadual_destinatario: body.destinatario.inscricao_estadual,
    email_destinatario: body.destinatario.email,
    logradouro_destinatario: body.destinatario.endereco.logradouro,
    numero_destinatario: body.destinatario.endereco.numero,
    complemento_destinatario: body.destinatario.endereco.complemento,
    bairro_destinatario: body.destinatario.endereco.bairro,
    municipio_destinatario: body.destinatario.endereco.municipio,
    uf_destinatario: body.destinatario.endereco.uf,
    cep_destinatario: body.destinatario.endereco.cep.replace(/\D/g, ""),
    codigo_municipio_destinatario: body.destinatario.endereco.codigo_municipio,
    items: body.itens.map((item, idx) => ({
      numero_item: idx + 1,
      codigo_produto: item.codigo,
      descricao: item.descricao,
      cfop: item.cfop,
      codigo_ncm: item.ncm,
      cest: item.cest,
      unidade_comercial: item.unidade,
      quantidade_comercial: item.quantidade.toFixed(4),
      valor_unitario_comercial: item.valor_unitario.toFixed(4),
      valor_unitario_tributavel: item.valor_unitario.toFixed(4),
      unidade_tributavel: item.unidade,
      quantidade_tributavel: item.quantidade.toFixed(4),
      valor_bruto: item.valor_total.toFixed(2),
      icms_origem: item.icms?.origem ?? "0",
      icms_situacao_tributaria: item.icms?.cst ?? "00",
      icms_aliquota: item.icms?.aliquota?.toFixed(2),
      icms_base_calculo: (item.icms?.base_calculo ?? item.valor_total).toFixed(2),
      icms_valor: item.icms?.valor?.toFixed(2),
      pis_situacao_tributaria: item.pis?.cst ?? "07",
      pis_aliquota_porcentual: item.pis?.aliquota?.toFixed(2),
      pis_valor: item.pis?.valor?.toFixed(2),
      cofins_situacao_tributaria: item.cofins?.cst ?? "07",
      cofins_aliquota_porcentual: item.cofins?.aliquota?.toFixed(2),
      cofins_valor: item.cofins?.valor?.toFixed(2),
    })),
    formas_pagamento: (body.pagamentos ?? [{ forma: "99", valor: valorTotal }]).map((p) => ({
      forma_pagamento: p.forma,
      valor_pagamento: p.valor.toFixed(2),
    })),
    informacoes_adicionais_contribuinte: body.informacoes_adicionais,
  };

  const focusUrl = modelo === "55"
    ? `${focusBase()}/v2/nfe?ref=${refUnico}`
    : `${focusBase()}/v2/nfce?ref=${refUnico}`;

  const res = await fetch(focusUrl, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const respData = await res.json();

  if (res.status >= 400) {
    await supabase.from("financeiro_nfes_emitidas").update({
      status: "rejeitada",
      motivo: JSON.stringify(respData).substring(0, 500),
    }).eq("id", nfeLocal.id);
    return error(res.status, `focus_nfe_rejeitou: ${JSON.stringify(respData)}`);
  }

  return ok({
    nfe_id: nfeLocal.id,
    ref: refUnico,
    status: respData.status ?? "em_processamento",
    mensagem: "NF-e enviada à SEFAZ. Use ?action=consultar com a ref para acompanhar.",
    focus_response: respData,
  });
}

async function handleConsultar(req: Request, supabase: any, userId: string): Promise<Response> {
  const { ref, nfe_id } = await req.json();
  const query = ref
    ? supabase.from("financeiro_nfes_emitidas").select("*").eq("uuid_provedor", ref)
    : supabase.from("financeiro_nfes_emitidas").select("*").eq("id", nfe_id);
  const { data: nfeLocal } = await query.eq("user_id", userId).single();
  if (!nfeLocal) return error(404, "nfe_nao_encontrada");

  const modelo = nfeLocal.modelo === "nfe" ? "nfe" : "nfce";
  const res = await fetch(`${focusBase()}/v2/${modelo}/${nfeLocal.uuid_provedor}`, {
    headers: { Authorization: focusAuth() },
  });
  if (!res.ok) return error(res.status, `focus_consulta_falhou: ${await res.text()}`);

  const data = await res.json();
  const novoStatus = mapStatusFocus(data.status);

  await supabase.from("financeiro_nfes_emitidas").update({
    status: novoStatus,
    numero: data.numero ? parseInt(data.numero, 10) : null,
    serie: data.serie ? parseInt(data.serie, 10) : null,
    chave_acesso: data.chave_nfe ?? data.chave_nfce,
    protocolo: data.protocolo,
    motivo: data.mensagem_sefaz,
    data_autorizacao: data.data_autorizacao,
    xml_url: data.caminho_xml_nota_fiscal,
    danfe_url: data.caminho_danfe,
  }).eq("id", nfeLocal.id);

  return ok({
    nfe_id: nfeLocal.id, status: novoStatus, numero: data.numero,
    chave: data.chave_nfe ?? data.chave_nfce, protocolo: data.protocolo,
    xml_url: data.caminho_xml_nota_fiscal, danfe_url: data.caminho_danfe,
    mensagem: data.mensagem_sefaz,
  });
}

async function handleCancelar(req: Request, supabase: any, userId: string): Promise<Response> {
  const { nfe_id, justificativa } = await req.json();
  if (!justificativa || justificativa.length < 15) return error(400, "justificativa_minima_15_caracteres");

  const { data: nfeLocal } = await supabase
    .from("financeiro_nfes_emitidas")
    .select("uuid_provedor, modelo")
    .eq("id", nfe_id).eq("user_id", userId).single();
  if (!nfeLocal) return error(404, "nfe_nao_encontrada");

  const modelo = nfeLocal.modelo === "nfe" ? "nfe" : "nfce";
  const res = await fetch(`${focusBase()}/v2/${modelo}/${nfeLocal.uuid_provedor}`, {
    method: "DELETE",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ justificativa }),
  });
  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));

  await supabase.from("financeiro_nfes_emitidas")
    .update({ status: "cancelada", motivo: justificativa }).eq("id", nfe_id);
  await supabase.from("financeiro_nfe_eventos").insert({
    nfe_id, user_id: userId, tipo_evento: "cancelamento",
    motivo: justificativa, protocolo: data.numero_protocolo,
  });

  return ok({ cancelada: true, protocolo: data.numero_protocolo });
}

async function handleCartaCorrecao(req: Request, supabase: any, userId: string): Promise<Response> {
  const { nfe_id, correcao } = await req.json();
  if (!correcao || correcao.length < 15 || correcao.length > 1000)
    return error(400, "correcao_entre_15_e_1000_caracteres");

  const { data: nfeLocal } = await supabase
    .from("financeiro_nfes_emitidas")
    .select("uuid_provedor").eq("id", nfe_id).eq("user_id", userId).single();
  if (!nfeLocal) return error(404, "nfe_nao_encontrada");

  const res = await fetch(`${focusBase()}/v2/nfe/${nfeLocal.uuid_provedor}/carta_correcao`, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ correcao }),
  });
  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));

  await supabase.from("financeiro_nfe_eventos").insert({
    nfe_id, user_id: userId, tipo_evento: "cce",
    motivo: correcao, protocolo: data.numero_protocolo,
  });

  return ok({ cce_emitida: true, protocolo: data.numero_protocolo });
}

async function handleInutilizar(req: Request, supabase: any, _userId: string): Promise<Response> {
  const { cnpj, serie, numero_inicial, numero_final, justificativa, modelo } = await req.json();
  const res = await fetch(`${focusBase()}/v2/${modelo}/inutilizacao`, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      cnpj: cnpj.replace(/\D/g, ""), serie, numero_inicial, numero_final, justificativa,
    }),
  });
  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));
  return ok({ inutilizado: true, protocolo: data.numero_protocolo });
}

async function handleWebhook(req: Request, supabase: any): Promise<Response> {
  const body = await req.json();
  const ref = body.ref;
  if (!ref) return ok({ ignored: true });

  const { data: nfeLocal } = await supabase
    .from("financeiro_nfes_emitidas")
    .select("id, user_id, valor_total, destinatario_dados")
    .eq("uuid_provedor", ref).single();
  if (!nfeLocal) return ok({ ignored: true, reason: "ref_desconhecida" });

  const novoStatus = mapStatusFocus(body.status);
  await supabase.from("financeiro_nfes_emitidas").update({
    status: novoStatus,
    numero: body.numero ? parseInt(body.numero, 10) : null,
    chave_acesso: body.chave_nfe,
    protocolo: body.protocolo,
    data_autorizacao: body.data_autorizacao,
    xml_url: body.caminho_xml_nota_fiscal,
    danfe_url: body.caminho_danfe,
  }).eq("id", nfeLocal.id);

  return ok({ atualizada: true });
}

function mapStatusFocus(focusStatus: string): string {
  const map: Record<string, string> = {
    autorizado: "autorizada",
    cancelado: "cancelada",
    denegado: "denegada",
    erro_autorizacao: "rejeitada",
    processando_autorizacao: "em_processamento",
    contingencia: "contingencia",
  };
  return map[focusStatus] ?? "em_processamento";
}

function ok(body: unknown) {
  return new Response(JSON.stringify({ ok: true, ...((body as object) ?? {}) }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
}
function error(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
