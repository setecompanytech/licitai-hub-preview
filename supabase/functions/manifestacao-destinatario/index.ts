// ============================================================================
// PRAEFECTUS — Edge Function: manifestacao-destinatario
// Path no Lovable: supabase/functions/manifestacao-destinatario/index.ts
// ============================================================================
// Manifestação do Destinatário (Evento E110.111 do Manual NF-e):
// permite à empresa responder à SEFAZ sobre NF-es emitidas contra seu CNPJ.
//
// Tipos:
//   210210 — Ciência da Operação (default automático para todas as NFs novas)
//   210200 — Confirmação da Operação (recebi e validei)
//   210220 — Desconhecimento da Operação (não conheço, possível fraude!)
//   210240 — Operação Não Realizada (cancelei a transação)
//
// IMPORTANTE: Após "Confirmação da Operação", o emitente NÃO PODE mais
// cancelar a NF-e. Use com cuidado.
//
// Modos:
//   ?action=manifestar    → manifesta uma NFe específica
//   ?action=ciencia-lote  → dá ciência em todas as NFes pendentes (cron)
//   ?action=consultar-pendentes → lista NFes que ainda não tiveram ciência
//   ?action=baixar-xml    → baixa XML completo de uma NFe destinada
//
// Provedor: Focus NFe (mesma API usada para emissão).
// Requer certificado A1 da empresa configurado no painel Focus NFe.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API = Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao"
  ? "https://api.focusnfe.com.br"
  : "https://homologacao.focusnfe.com.br";

function focusAuth(): string {
  return "Basic " + btoa((Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "") + ":");
}

// ============================================================================
// MAPEAMENTO TIPOS
// ============================================================================

const TIPO_EVENTO: Record<string, { codigo: string; descricao: string; focusKey: string }> = {
  ciencia: {
    codigo: "210210",
    descricao: "Ciência da Operação",
    focusKey: "ciencia",
  },
  confirmacao: {
    codigo: "210200",
    descricao: "Confirmação da Operação",
    focusKey: "confirmacao",
  },
  desconhecimento: {
    codigo: "210220",
    descricao: "Desconhecimento da Operação",
    focusKey: "desconhecimento",
  },
  nao_realizada: {
    codigo: "210240",
    descricao: "Operação Não Realizada",
    focusKey: "nao_realizada",
  },
};

// ============================================================================
// HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "manifestar";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (action) {
      case "manifestar":           return await handleManifestar(req, supabase);
      case "ciencia-lote":         return await handleCienciaLote(req, supabase);
      case "consultar-pendentes":  return await handleConsultarPendentes(req, supabase);
      case "baixar-xml":           return await handleBaixarXml(req, supabase);
      case "cron":                 return await handleCron(supabase);
      default:                     return error(400, "invalid_action");
    }
  } catch (e) {
    console.error("[manifestacao-destinatario]", e);
    return error(500, e instanceof Error ? e.message : String(e));
  }
});

// ============================================================================
// ACTION: MANIFESTAR (manual ou unitária)
// ============================================================================

interface ManifestarRequest {
  org_id: string;
  documento_fiscal_id: string;
  tipo: "ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada";
  justificativa?: string;          // obrigatório para desconhecimento e nao_realizada (15-255 chars)
  cnpj_manifestante: string;       // CNPJ que está manifestando (deve bater com certificado)
}

async function handleManifestar(req: Request, supabase: any): Promise<Response> {
  const body: ManifestarRequest = await req.json();

  // Valida tipo
  const evento = TIPO_EVENTO[body.tipo];
  if (!evento) return error(400, `tipo_invalido: ${body.tipo}`);

  // Justificativa obrigatória para alguns eventos
  if (
    (body.tipo === "desconhecimento" || body.tipo === "nao_realizada") &&
    (!body.justificativa || body.justificativa.length < 15 || body.justificativa.length > 255)
  ) {
    return error(400, "justificativa_obrigatoria_15_a_255_caracteres");
  }

  // Carrega documento fiscal
  const { data: doc } = await supabase
    .from("financeiro_documentos_fiscais")
    .select("chave_acesso, org_id")
    .eq("id", body.documento_fiscal_id)
    .eq("org_id", body.org_id)
    .single();

  if (!doc?.chave_acesso) return error(404, "nfe_sem_chave_acesso");

  // Verifica se já manifestou este tipo
  const { data: existente } = await supabase
    .from("financeiro_manifestacoes")
    .select("id, protocolo")
    .eq("documento_fiscal_id", body.documento_fiscal_id)
    .eq("tipo", body.tipo)
    .maybeSingle();

  if (existente) {
    return ok({
      ja_manifestada: true,
      protocolo: existente.protocolo,
      mensagem: `${evento.descricao} já foi registrada anteriormente`,
    });
  }

  // Chama Focus NFe (manifestação do destinatário)
  const focusUrl = `${FOCUS_API}/v2/nfes_recebidas/${doc.chave_acesso}/manifestacao`;
  const res = await fetch(focusUrl, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      cnpj: body.cnpj_manifestante.replace(/\D/g, ""),
      tipo: evento.focusKey,
      justificativa: body.justificativa,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return error(res.status, `focus_manifestacao_falhou: ${JSON.stringify(data)}`);
  }

  // Persiste manifestação
  const { data: manif } = await supabase
    .from("financeiro_manifestacoes")
    .insert({
      org_id: body.org_id,
      documento_fiscal_id: body.documento_fiscal_id,
      tipo: body.tipo,
      motivo: body.justificativa,
      protocolo: data.numero_protocolo,
      automatica: false,
    })
    .select()
    .single();

  // Registra evento
  await supabase.from("financeiro_nfe_eventos").insert({
    nfe_id: body.documento_fiscal_id,
    org_id: body.org_id,
    tipo_evento: "manifestacao",
    motivo: `${evento.descricao}${body.justificativa ? ` — ${body.justificativa}` : ""}`,
    protocolo: data.numero_protocolo,
  });

  return ok({
    manifestacao_id: manif.id,
    tipo: evento.descricao,
    codigo: evento.codigo,
    protocolo: data.numero_protocolo,
    aviso: body.tipo === "confirmacao"
      ? "ATENÇÃO: NF-e não pode mais ser cancelada pelo emitente após confirmação"
      : undefined,
  });
}

// ============================================================================
// ACTION: CIÊNCIA EM LOTE (chamado pelo cron diário)
// ============================================================================

async function handleCienciaLote(req: Request, supabase: any): Promise<Response> {
  const { org_id, cnpj } = await req.json();

  // Busca NFs sem nenhuma manifestação registrada
  const { data: pendentes } = await supabase
    .from("financeiro_documentos_fiscais")
    .select("id, chave_acesso, valor_total")
    .eq("org_id", org_id)
    .eq("tipo", "nfe")
    .eq("origem", "sefaz_nfe")
    .not("chave_acesso", "is", null)
    .not("id", "in", `(SELECT documento_fiscal_id FROM financeiro_manifestacoes WHERE org_id = '${org_id}')`)
    .limit(100);

  if (!pendentes?.length) {
    return ok({ processadas: 0, mensagem: "Nenhuma NF-e pendente de ciência" });
  }

  let sucesso = 0;
  let erros = 0;

  for (const nf of pendentes) {
    try {
      const res = await fetch(
        `${FOCUS_API}/v2/nfes_recebidas/${nf.chave_acesso}/manifestacao`,
        {
          method: "POST",
          headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
          body: JSON.stringify({
            cnpj: cnpj.replace(/\D/g, ""),
            tipo: "ciencia",
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        await supabase.from("financeiro_manifestacoes").insert({
          org_id,
          documento_fiscal_id: nf.id,
          tipo: "ciencia",
          protocolo: data.numero_protocolo,
          automatica: true,
        });
        sucesso++;
      } else {
        erros++;
      }
    } catch (e) {
      console.error(`ciencia_${nf.chave_acesso}`, e);
      erros++;
    }
  }

  return ok({ processadas: pendentes.length, sucesso, erros });
}

// ============================================================================
// ACTION: CONSULTAR PENDENTES
// ============================================================================

async function handleConsultarPendentes(req: Request, supabase: any): Promise<Response> {
  const { org_id } = await req.json();

  const { data: pendentes } = await supabase
    .from("financeiro_documentos_fiscais")
    .select(`
      id, numero, chave_acesso, valor_total, data_emissao,
      emissor:financeiro_pessoas!emissor_id(nome, documento)
    `)
    .eq("org_id", org_id)
    .eq("tipo", "nfe")
    .eq("origem", "sefaz_nfe")
    .not("chave_acesso", "is", null)
    .order("data_emissao", { ascending: false })
    .limit(200);

  // Cruza com manifestações já feitas
  const ids = (pendentes ?? []).map((p) => p.id);
  const { data: manifestacoes } = await supabase
    .from("financeiro_manifestacoes")
    .select("documento_fiscal_id, tipo, protocolo")
    .in("documento_fiscal_id", ids);

  const manifMap = new Map<string, any[]>();
  for (const m of manifestacoes ?? []) {
    const arr = manifMap.get(m.documento_fiscal_id) ?? [];
    arr.push(m);
    manifMap.set(m.documento_fiscal_id, arr);
  }

  const resultado = (pendentes ?? []).map((p) => ({
    ...p,
    manifestacoes: manifMap.get(p.id) ?? [],
    sem_manifestacao: !manifMap.has(p.id),
  }));

  return ok({
    total: resultado.length,
    sem_manifestacao: resultado.filter((r) => r.sem_manifestacao).length,
    documentos: resultado,
  });
}

// ============================================================================
// ACTION: BAIXAR XML
// ============================================================================

async function handleBaixarXml(req: Request, supabase: any): Promise<Response> {
  const { org_id, chave_acesso, cnpj } = await req.json();

  // Para baixar XML, é necessário ter dado pelo menos "ciência"
  const { data: doc } = await supabase
    .from("financeiro_documentos_fiscais")
    .select("id")
    .eq("org_id", org_id)
    .eq("chave_acesso", chave_acesso)
    .single();

  if (!doc) return error(404, "nfe_nao_encontrada");

  // Garante ciência primeiro (se ainda não tem)
  const { data: temCiencia } = await supabase
    .from("financeiro_manifestacoes")
    .select("id")
    .eq("documento_fiscal_id", doc.id)
    .in("tipo", ["ciencia", "confirmacao"])
    .maybeSingle();

  if (!temCiencia) {
    // Dá ciência automaticamente
    await fetch(`${FOCUS_API}/v2/nfes_recebidas/${chave_acesso}/manifestacao`, {
      method: "POST",
      headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, ""), tipo: "ciencia" }),
    });
  }

  // Baixa XML completo
  const xmlRes = await fetch(`${FOCUS_API}/v2/nfes_recebidas/${chave_acesso}.xml`, {
    headers: { Authorization: focusAuth() },
  });

  if (!xmlRes.ok) {
    return error(xmlRes.status, "nao_foi_possivel_baixar_xml");
  }

  const xml = await xmlRes.text();

  // Salva no Storage
  const path = `${org_id}/nfe-recebidas/${chave_acesso}.xml`;
  const { error: stErr } = await supabase.storage
    .from("nfes-xml")
    .upload(path, xml, { contentType: "application/xml", upsert: true });

  if (stErr) console.warn("storage:", stErr.message);

  await supabase
    .from("financeiro_documentos_fiscais")
    .update({
      arquivo_xml: xml.substring(0, 100000),
      arquivo_url: path,
    })
    .eq("id", doc.id);

  return ok({ chave: chave_acesso, salvo: true, storage_path: path });
}

// ============================================================================
// ACTION: CRON DIÁRIO (ciência automática para todas as orgs)
// ============================================================================

async function handleCron(supabase: any): Promise<Response> {
  // Busca todas as orgs ativas com CNPJ cadastrado
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, cnpj")
    .not("cnpj", "is", null);

  let totalProcessadas = 0;
  let totalSucesso = 0;

  for (const org of orgs ?? []) {
    try {
      const cnpjClean = org.cnpj.replace(/\D/g, "");
      if (cnpjClean.length !== 14) continue;

      const fakeReq = new Request("http://internal", {
        method: "POST",
        body: JSON.stringify({ org_id: org.id, cnpj: cnpjClean }),
      });
      const r = await handleCienciaLote(fakeReq, supabase);
      const j = await r.json();
      totalProcessadas += j.processadas ?? 0;
      totalSucesso += j.sucesso ?? 0;
    } catch (e) {
      console.error(`cron_org_${org.id}:`, e);
    }
  }

  return ok({
    orgs_processadas: orgs?.length ?? 0,
    nfes_processadas: totalProcessadas,
    nfes_sucesso: totalSucesso,
  });
}

// ============================================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
