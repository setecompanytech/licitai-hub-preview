// =============================================================================
// PRAEFECTUS — Edge Function: manifestacao-destinatario
// Manifestação do Destinatário (Evento E110.111 NF-e) via Focus NFe.
// Adaptado ao schema user_id do Praefectus.
// =============================================================================
// Códigos:
//   210210 — Ciência da Operação (default automático)
//   210200 — Confirmação da Operação (impede cancelamento posterior)
//   210220 — Desconhecimento da Operação (NF fraudulenta)
//   210240 — Operação Não Realizada
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API = Deno.env.get("FOCUS_NFE_AMBIENTE") === "producao"
  ? "https://api.focusnfe.com.br"
  : "https://homologacao.focusnfe.com.br";

function focusAuth(): string {
  return "Basic " + btoa((Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "") + ":");
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TIPO_EVENTO: Record<string, { codigo: string; descricao: string; focusKey: string }> = {
  ciencia: { codigo: "210210", descricao: "Ciência da Operação", focusKey: "ciencia" },
  confirmacao: { codigo: "210200", descricao: "Confirmação da Operação", focusKey: "confirmacao" },
  desconhecimento: { codigo: "210220", descricao: "Desconhecimento da Operação", focusKey: "desconhecimento" },
  nao_realizada: { codigo: "210240", descricao: "Operação Não Realizada", focusKey: "nao_realizada" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "manifestar";

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
      case "manifestar": return await handleManifestar(req, supabase, userId);
      case "listar":     return await handleListar(req, supabase, userId);
      default:           return error(400, "invalid_action");
    }
  } catch (e) {
    console.error("[manifestacao-destinatario]", e);
    return error(500, e instanceof Error ? e.message : String(e));
  }
});

async function handleManifestar(req: Request, supabase: any, userId: string): Promise<Response> {
  const { chave_nfe, tipo, motivo, empresa_id } = await req.json() as {
    chave_nfe: string;
    tipo: keyof typeof TIPO_EVENTO;
    motivo?: string;
    empresa_id?: string;
  };

  if (!chave_nfe || chave_nfe.length !== 44) return error(400, "chave_nfe_invalida");
  if (!TIPO_EVENTO[tipo]) return error(400, "tipo_invalido");

  const evento = TIPO_EVENTO[tipo];

  if ((tipo === "desconhecimento" || tipo === "nao_realizada") && (!motivo || motivo.length < 15)) {
    return error(400, "motivo_obrigatorio_min_15_chars");
  }

  // POST Focus NFe
  const res = await fetch(`${FOCUS_API}/v2/nfes_recebidas/${chave_nfe}/manifestacao`, {
    method: "POST",
    headers: { Authorization: focusAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: evento.focusKey, justificativa: motivo }),
  });
  const data = await res.json();
  if (!res.ok) return error(res.status, JSON.stringify(data));

  // Persiste localmente
  await supabase.from("financeiro_manifestacoes").insert({
    user_id: userId,
    empresa_id: empresa_id ?? null,
    chave_nfe,
    tipo,
    motivo,
    protocolo: data.numero_protocolo,
    realizado_por: userId,
    automatica: false,
  });

  return ok({
    manifestada: true,
    chave_nfe,
    tipo,
    codigo_evento: evento.codigo,
    descricao: evento.descricao,
    protocolo: data.numero_protocolo,
  });
}

async function handleListar(_req: Request, supabase: any, userId: string): Promise<Response> {
  const { data, error: err } = await supabase
    .from("financeiro_manifestacoes")
    .select("*")
    .eq("user_id", userId)
    .order("data_manifestacao", { ascending: false })
    .limit(200);

  if (err) return error(500, err.message);
  return ok({ total: data?.length ?? 0, manifestacoes: data ?? [] });
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
