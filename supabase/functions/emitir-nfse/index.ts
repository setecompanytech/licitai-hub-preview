// ============================================================================
// PRAEFECTUS — Edge Function: emitir-nfse
// Path no Lovable: supabase/functions/emitir-nfse/index.ts
// ============================================================================
// Emissão de NFS-e (serviços) via Focus NFe.
//
// Diferenças vs NF-e:
//   - Competência da PREFEITURA (não SEFAZ estadual)
//   - Cada município tem padrão próprio (ABRASF, Ginfes, Betha, etc.)
//   - Emissão pode ser SÍNCRONA ou ASSÍNCRONA dependendo da prefeitura
//   - ISS retido na fonte é configurável (depende do tomador e LC 116/03)
//   - Código de serviço LC 116/2003 obrigatório
//
// Modos:
//   ?action=emitir          → emite NFS-e
//   ?action=consultar       → status (emissão pode levar minutos)
//   ?action=cancelar        → cancela (regras variam por município)
//   ?action=consultar-municipio → verifica suporte da prefeitura à emissão
//   ?action=webhook         → notificação de autorização
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API_HOMOLOG = "https://homologacao.focusnfe.com.br";
const FOCUS_API_PROD = "https://api.focusnfe.com.br";

function focusBase(): string {
  return Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao"
    ? FOCUS_API_PROD
    : FOCUS_API_HOMOLOG;
}

function focusAuth(): string {
  return "Basic " + btoa((Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "") + ":");
}

// ============================================================================
// TIPOS
// ============================================================================

interface EmitirNFSeRequest {
  org_id: string;
  cnpj_prestador: string;
  inscricao_municipal_prestador?: string;

  // Tomador
  tomador: {
    cnpj?: string;
    cpf?: string;
    razao_social: string;
    inscricao_municipal?: string;
    email?: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      municipio: string;            // nome
      codigo_municipio: string;     // IBGE 7 dígitos
      uf: string;
      cep: string;
    };
  };

  // Serviço
  servico: {
    descricao: string;
    codigo_tributacao_municipio?: string;  // depende da prefeitura
    item_lista_servico: string;            // LC 116/2003 (ex: "01.01")
    cnae?: string;
    valor_servicos: number;
    aliquota_iss: number;                  // percentual (5.0 = 5%)
    iss_retido: boolean;
    valor_iss?: number;
    valor_pis?: number;
    valor_cofins?: number;
    valor_inss?: number;
    valor_ir?: number;
    valor_csll?: number;
    deducoes?: number;
    descontos_incondicionados?: number;
  };

  // Municipio prestador (onde o serviço foi prestado)
  municipio_prestacao: {
    codigo: string;                        // IBGE 7 dígitos
    uf: string;
  };

  natureza_operacao?: string;              // "1"=Tributação no município, "2"=Fora, etc.
  regime_especial_tributacao?: string;
  optante_simples_nacional?: boolean;
  incentivador_cultural?: boolean;

  observacoes?: string;
  lancamento_id?: string;
}

// ============================================================================
// HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "emitir";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "emitir":              return await handleEmitir(req, supabase);
      case "consultar":           return await handleConsultar(req, supabase);
      case "cancelar":            return await handleCancelar(req, supabase);
      case "consultar-municipio": return await handleConsultarMunicipio(req);
      case "webhook":             return await handleWebhook(req, supabase);
      default:                    return error(400, "invalid_action");
    }
  } catch (e) {
    console.error("[emitir-nfse]", e);
    return error(500, e instanceof Error ? e.message : String(e));
  }
});

// ============================================================================
// EMITIR NFSE
// ============================================================================

async function handleEmitir(req: Request, supabase: any): Promise<Response> {
  const body: EmitirNFSeRequest = await req.json();
  const refUnico = crypto.randomUUID();

  // Calcula valor de ISS se não informado
  const valorIss = body.servico.valor_iss
    ?? (body.servico.valor_servicos * body.servico.aliquota_iss / 100);

  const valorTotal = body.servico.valor_servicos
    - (body.servico.deducoes ?? 0)
    - (body.servico.descontos_incondicionados ?? 0)
    - (body.servico.iss_retido ? valorIss : 0);

  // 1. Cria registro local
  const { data: nfseLocal, error: localErr } = await supabase
    .from("financeiro_nfes_emitidas")
    .insert({
      org_id: body.org_id,
      modelo: "nfse",
      uuid_provedor: refUnico,
      status: "em_processamento",
      ambiente: Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao" ? "producao" : "homologacao",
      natureza_operacao: body.natureza_operacao ?? "1",
      destinatario_dados: body.tomador,
      itens: [{
        codigo: body.servico.item_lista_servico,
        descricao: body.servico.descricao,
        quantidade: 1,
        valor_unitario: body.servico.valor_servicos,
        valor_total: body.servico.valor_servicos,
        cfop: "0000",
        ncm: "00000000",
        unidade: "UN",
      }],
      valor_servicos: body.servico.valor_servicos,
      valor_iss: valorIss,
      valor_pis: body.servico.valor_pis ?? 0,
      valor_cofins: body.servico.valor_cofins ?? 0,
      valor_total: valorTotal,
      nfse_codigo_servico: body.servico.item_lista_servico,
      nfse_aliquota_iss: body.servico.aliquota_iss,
      nfse_municipio: body.municipio_prestacao.codigo,
      nfse_iss_retido: body.servico.iss_retido,
      provedor: "focus_nfe",
      lancamento_id: body.lancamento_id,
    })
    .select()
    .single();

  if (localErr) throw new Error(`criar_local: ${localErr.message}`);

  // 2. Monta payload Focus NFe NFSe
  const payload = {
    data_emissao: new Date().toISOString(),
    prestador: {
      cnpj: body.cnpj_prestador.replace(/\D/g, ""),
      inscricao_municipal: body.inscricao_municipal_prestador,
      codigo_municipio: body.municipio_prestacao.codigo,
    },
    tomador: {
      cnpj: body.tomador.cnpj?.replace(/\D/g, ""),
      cpf: body.tomador.cpf?.replace(/\D/g, ""),
      razao_social: body.tomador.razao_social,
      inscricao_municipal: body.tomador.inscricao_municipal,
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
      iss_retido: body.servico.iss_retido,
      item_lista_servico: body.servico.item_lista_servico,
      codigo_tributario_municipio: body.servico.codigo_tributacao_municipio,
      codigo_cnae: body.servico.cnae,
      valor_servicos: body.servico.valor_servicos.toFixed(2),
      valor_iss: valorIss.toFixed(2),
      valor_pis: (body.servico.valor_pis ?? 0).toFixed(2),
      valor_cofins: (body.servico.valor_cofins ?? 0).toFixed(2),
      valor_inss: (body.servico.valor_inss ?? 0).toFixed(2),
      valor_ir: (body.servico.valor_ir ?? 0).toFixed(2),
      valor_csll: (body.servico.valor_csll ?? 0).toFixed(2),
      valor_deducoes: (body.servico.deducoes ?? 0).toFixed(2),
      descontos_incondicionados: (body.servico.descontos_incondicionados ?? 0).toFixed(2),
      municipio_prestacao_servico: body.municipio_prestacao.codigo,
    },
    natureza_operacao: body.natureza_operacao ?? "1",
    optante_simples_nacional: body.optante_simples_nacional ?? false,
    incentivador_cultural: body.incentivador_cultural ?? false,
    regime_especial_tributacao: body.regime_especial_tributacao,
    observacoes: body.observacoes,
  };

  // 3. POST Focus NFe
  const res = await fetch(`${focusBase()}/v2/nfse?ref=${refUnico}`, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const respData = await res.json();

  if (res.status >= 400) {
    await supabase
      .from("financeiro_nfes_emitidas")
      .update({
        status: "rejeitada",
        motivo: JSON.stringify(respData).substring(0, 500),
      })
      .eq("id", nfseLocal.id);

    return error(res.status, `focus_nfse_rejeitou: ${JSON.stringify(respData)}`);
  }

  return ok({
    nfse_id: nfseLocal.id,
    ref: refUnico,
    status: respData.status ?? "em_processamento",
    mensagem: "NFS-e enviada à prefeitura. A emissão pode levar alguns minutos. Use ?action=consultar para acompanhar.",
  });
}

// ============================================================================
// CONSULTAR STATUS
// ============================================================================

async function handleConsultar(req: Request, supabase: any): Promise<Response> {
  const { ref, nfse_id, org_id } = await req.json();

  const query = ref
    ? supabase.from("financeiro_nfes_emitidas").select("*").eq("uuid_provedor", ref)
    : supabase.from("financeiro_nfes_emitidas").select("*").eq("id", nfse_id);

  const { data: nfseLocal } = await query.eq("org_id", org_id).single();
  if (!nfseLocal) return error(404, "nfse_nao_encontrada");

  const res = await fetch(`${focusBase()}/v2/nfse/${nfseLocal.uuid_provedor}`, {
    headers: { Authorization: focusAuth() },
  });

  if (!res.ok) return error(res.status, `consulta_falhou: ${await res.text()}`);
  const data = await res.json();

  const novoStatus = mapStatusNFSe(data.status);

  await supabase
    .from("financeiro_nfes_emitidas")
    .update({
      status: novoStatus,
      numero: data.numero ? parseInt(data.numero, 10) : null,
      protocolo: data.codigo_verificacao,
      motivo: data.mensagem,
      data_autorizacao: data.data_emissao,
      xml_url: data.caminho_xml_nota_fiscal,
      danfe_url: data.url,
    })
    .eq("id", nfseLocal.id);

  return ok({
    nfse_id: nfseLocal.id,
    status: novoStatus,
    numero: data.numero,
    codigo_verificacao: data.codigo_verificacao,
    url: data.url,
    xml_url: data.caminho_xml_nota_fiscal,
    mensagem: data.mensagem,
  });
}

// ============================================================================
// CANCELAR (regras variam por município)
// ============================================================================

async function handleCancelar(req: Request, supabase: any): Promise<Response> {
  const { nfse_id, org_id, justificativa } = await req.json();

  const { data: nfseLocal } = await supabase
    .from("financeiro_nfes_emitidas")
    .select("uuid_provedor")
    .eq("id", nfse_id)
    .eq("org_id", org_id)
    .single();

  if (!nfseLocal) return error(404, "nfse_nao_encontrada");

  const res = await fetch(`${focusBase()}/v2/nfse/${nfseLocal.uuid_provedor}`, {
    method: "DELETE",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ justificativa }),
  });

  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));

  await supabase
    .from("financeiro_nfes_emitidas")
    .update({ status: "cancelada", motivo: justificativa })
    .eq("id", nfse_id);

  await supabase.from("financeiro_nfe_eventos").insert({
    nfe_id: nfse_id,
    org_id,
    tipo_evento: "cancelamento",
    motivo: justificativa,
  });

  return ok({ cancelada: true });
}

// ============================================================================
// CONSULTAR SUPORTE DO MUNICÍPIO
// ============================================================================

async function handleConsultarMunicipio(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const codigo = url.searchParams.get("codigo");
  if (!codigo) return error(400, "codigo_municipio_obrigatorio");

  const res = await fetch(`${focusBase()}/v2/cidades_homologadas/${codigo}`, {
    headers: { Authorization: focusAuth() },
  });

  if (!res.ok) {
    return ok({
      suportado: false,
      mensagem: "Município não homologado pela Focus NFe",
    });
  }

  const data = await res.json();
  return ok({
    suportado: true,
    nome: data.nome,
    uf: data.uf,
    homologacao: data.homologacao,
    producao: data.producao,
  });
}

// ============================================================================
// WEBHOOK
// ============================================================================

async function handleWebhook(req: Request, supabase: any): Promise<Response> {
  const body = await req.json();
  const ref = body.ref;
  if (!ref) return ok({ ignored: true });

  const { data: nfseLocal } = await supabase
    .from("financeiro_nfes_emitidas")
    .select("id, org_id, lancamento_id, valor_total")
    .eq("uuid_provedor", ref)
    .single();

  if (!nfseLocal) return ok({ ignored: true });

  const novoStatus = mapStatusNFSe(body.status);
  await supabase
    .from("financeiro_nfes_emitidas")
    .update({
      status: novoStatus,
      numero: body.numero ? parseInt(body.numero, 10) : null,
      protocolo: body.codigo_verificacao,
      data_autorizacao: body.data_emissao,
      xml_url: body.caminho_xml_nota_fiscal,
      danfe_url: body.url,
    })
    .eq("id", nfseLocal.id);

  return ok({ atualizada: true });
}

// ============================================================================
// HELPERS
// ============================================================================

function mapStatusNFSe(focusStatus: string): string {
  const map: Record<string, string> = {
    autorizado: "autorizada",
    cancelado: "cancelada",
    erro_autorizacao: "rejeitada",
    processando_autorizacao: "em_processamento",
  };
  return map[focusStatus] ?? "em_processamento";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
};

function ok(body: unknown) {
  return new Response(JSON.stringify({ ok: true, ...((body as object) ?? {}) }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function error(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
