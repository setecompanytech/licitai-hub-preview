// =============================================================================
// PRAEFECTUS — Edge Function: emitir-nfse
// Emissão de NFS-e (serviços) via Focus NFe.
// Adaptado ao schema user_id/empresa_id do Praefectus.
// =============================================================================
// Secrets necessários:
//   FOCUS_NFE_API_TOKEN
//   FOCUS_NFE_AMBIENTE  ('homologacao' | 'producao')
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API_HOMOLOG = "https://homologacao.focusnfe.com.br";
const FOCUS_API_PROD = "https://api.focusnfe.com.br";

function focusBase(): string {
  return Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao" ? FOCUS_API_PROD : FOCUS_API_HOMOLOG;
}
function focusAuth(): string {
  return "Basic " + btoa((Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "") + ":");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
};

interface EmitirNFSeRequest {
  cnpj_prestador: string;
  inscricao_municipal_prestador?: string;
  empresa_id?: string;
  tomador: {
    cnpj?: string; cpf?: string; razao_social: string;
    inscricao_municipal?: string; email?: string;
    endereco: {
      logradouro: string; numero: string; complemento?: string;
      bairro: string; municipio: string; codigo_municipio: string;
      uf: string; cep: string;
    };
  };
  servico: {
    codigo_lc116: string;
    descricao: string;
    valor_servicos: number;
    aliquota_iss: number;
    iss_retido?: boolean;
    deducoes?: number;
    valor_pis?: number;
    valor_cofins?: number;
    valor_inss?: number;
    valor_ir?: number;
    valor_csll?: number;
    base_calculo?: number;
    natureza_operacao?: string;
  };
  observacoes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "emitir";

  try {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!Deno.env.get("FOCUS_NFE_API_TOKEN")) {
      return error(503, "FOCUS_NFE_API_TOKEN não configurado.");
    }

    switch (action) {
      case "emitir":     return await handleEmitir(req, supabase, userId);
      case "consultar":  return await handleConsultar(req, supabase, userId);
      case "cancelar":   return await handleCancelar(req, supabase, userId);
      default:           return error(400, "invalid_action");
    }
  } catch (e) {
    console.error("[emitir-nfse]", e);
    return error(500, e instanceof Error ? e.message : String(e));
  }
});

async function handleEmitir(req: Request, supabase: any, userId: string): Promise<Response> {
  const body: EmitirNFSeRequest = await req.json();
  const refUnico = crypto.randomUUID();
  const ambiente = Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao" ? "producao" : "homologacao";

  const { data: nfeLocal, error: localErr } = await supabase
    .from("financeiro_nfes_emitidas")
    .insert({
      user_id: userId,
      empresa_id: body.empresa_id ?? null,
      modelo: "nfse",
      uuid_provedor: refUnico,
      status: "em_processamento",
      ambiente,
      natureza_operacao: body.servico.natureza_operacao ?? "Prestação de serviços",
      destinatario_dados: body.tomador,
      itens: [body.servico],
      valor_servicos: body.servico.valor_servicos,
      valor_iss: body.servico.valor_servicos * (body.servico.aliquota_iss / 100),
      valor_total: body.servico.valor_servicos,
      nfse_codigo_servico: body.servico.codigo_lc116,
      nfse_aliquota_iss: body.servico.aliquota_iss,
      nfse_municipio: body.tomador.endereco.municipio,
      nfse_iss_retido: body.servico.iss_retido ?? false,
      provedor: "focus_nfe",
    })
    .select()
    .single();

  if (localErr) throw new Error(`criar_local: ${localErr.message}`);

  const payload = {
    data_emissao: new Date().toISOString(),
    prestador: {
      cnpj: body.cnpj_prestador.replace(/\D/g, ""),
      inscricao_municipal: body.inscricao_municipal_prestador,
      codigo_municipio: body.tomador.endereco.codigo_municipio,
    },
    tomador: {
      cnpj: body.tomador.cnpj?.replace(/\D/g, ""),
      cpf: body.tomador.cpf?.replace(/\D/g, ""),
      razao_social: body.tomador.razao_social,
      email: body.tomador.email,
      endereco: {
        logradouro: body.tomador.endereco.logradouro,
        numero: body.tomador.endereco.numero,
        complemento: body.tomador.endereco.complemento,
        bairro: body.tomador.endereco.bairro,
        codigo_municipio: body.tomador.endereco.codigo_municipio,
        uf: body.tomador.endereco.uf,
        cep: body.tomador.endereco.cep.replace(/\D/g, ""),
      },
    },
    servico: {
      aliquota: body.servico.aliquota_iss,
      discriminacao: body.servico.descricao,
      iss_retido: body.servico.iss_retido ?? false,
      item_lista_servico: body.servico.codigo_lc116,
      codigo_tributario_municipio: body.servico.codigo_lc116.replace(/\./g, ""),
      valor_servicos: body.servico.valor_servicos,
      valor_deducoes: body.servico.deducoes ?? 0,
      valor_pis: body.servico.valor_pis ?? 0,
      valor_cofins: body.servico.valor_cofins ?? 0,
      valor_inss: body.servico.valor_inss ?? 0,
      valor_ir: body.servico.valor_ir ?? 0,
      valor_csll: body.servico.valor_csll ?? 0,
    },
  };

  const res = await fetch(`${focusBase()}/v2/nfse?ref=${refUnico}`, {
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
    return error(res.status, `focus_nfse_rejeitou: ${JSON.stringify(respData)}`);
  }

  return ok({
    nfse_id: nfeLocal.id,
    ref: refUnico,
    status: respData.status ?? "em_processamento",
    mensagem: "NFS-e enviada à prefeitura. Use ?action=consultar para acompanhar.",
  });
}

async function handleConsultar(req: Request, supabase: any, userId: string): Promise<Response> {
  const { ref, nfse_id } = await req.json();
  const query = ref
    ? supabase.from("financeiro_nfes_emitidas").select("*").eq("uuid_provedor", ref)
    : supabase.from("financeiro_nfes_emitidas").select("*").eq("id", nfse_id);
  const { data: nfeLocal } = await query.eq("user_id", userId).single();
  if (!nfeLocal) return error(404, "nfse_nao_encontrada");

  const res = await fetch(`${focusBase()}/v2/nfse/${nfeLocal.uuid_provedor}`, {
    headers: { Authorization: focusAuth() },
  });
  if (!res.ok) return error(res.status, `focus_consulta_falhou: ${await res.text()}`);

  const data = await res.json();
  const novoStatus = mapStatusFocus(data.status);

  await supabase.from("financeiro_nfes_emitidas").update({
    status: novoStatus,
    numero: data.numero ? parseInt(data.numero, 10) : null,
    chave_acesso: data.codigo_verificacao,
    motivo: data.mensagem_retorno_prefeitura,
    data_autorizacao: data.data_emissao,
    xml_url: data.caminho_xml_nota_fiscal,
    danfe_url: data.url,
  }).eq("id", nfeLocal.id);

  return ok({
    nfse_id: nfeLocal.id, status: novoStatus,
    numero: data.numero, codigo_verificacao: data.codigo_verificacao,
    url: data.url, mensagem: data.mensagem_retorno_prefeitura,
  });
}

async function handleCancelar(req: Request, supabase: any, userId: string): Promise<Response> {
  const { nfse_id, justificativa } = await req.json();
  const { data: nfeLocal } = await supabase
    .from("financeiro_nfes_emitidas").select("uuid_provedor")
    .eq("id", nfse_id).eq("user_id", userId).single();
  if (!nfeLocal) return error(404, "nfse_nao_encontrada");

  const res = await fetch(`${focusBase()}/v2/nfse/${nfeLocal.uuid_provedor}`, {
    method: "DELETE",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ justificativa: justificativa ?? "Cancelamento solicitado pelo emitente" }),
  });
  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));

  await supabase.from("financeiro_nfes_emitidas")
    .update({ status: "cancelada", motivo: justificativa }).eq("id", nfse_id);
  return ok({ cancelada: true });
}

function mapStatusFocus(s: string): string {
  const m: Record<string, string> = {
    autorizado: "autorizada",
    cancelado: "cancelada",
    erro_autorizacao: "rejeitada",
    processando_autorizacao: "em_processamento",
  };
  return m[s] ?? "em_processamento";
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
