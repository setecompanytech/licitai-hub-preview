// =============================================================================
// PRAEFECTUS — Edge Function: baixar-danfe
// Proxy autenticado para download do DANFE (PDF) emitido via Focus NFe.
// Resolve o problema do `caminho_danfe` exigir Basic Auth — aqui devolvemos
// o binário diretamente para o browser, com cabeçalhos de download.
// =============================================================================
// Body JSON: { nfe_id: string }   ou   { ref: string }
// Resposta: application/pdf (stream)  ou  JSON de erro
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const FOCUS_API_HOMOLOG = "https://homologacao.focusnfe.com.br";
const FOCUS_API_PROD = "https://api.focusnfe.com.br";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function focusBase(): string {
  const amb = Deno.env.get("FOCUS_NFE_AMBIENTE") ?? "homologacao";
  return amb === "producao" ? FOCUS_API_PROD : FOCUS_API_HOMOLOG;
}
function focusAuth(): string {
  const token = Deno.env.get("FOCUS_NFE_API_TOKEN") ?? "";
  return "Basic " + btoa(token + ":");
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError(401, "missing_auth");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) return jsonError(401, "invalid_auth");
    const userId = userData.user.id;

    if (!Deno.env.get("FOCUS_NFE_API_TOKEN")) {
      return jsonError(503, "FOCUS_NFE_API_TOKEN não configurado.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { nfe_id, ref } = await req.json().catch(() => ({}));
    if (!nfe_id && !ref) return jsonError(400, "informe nfe_id ou ref");

    const query = nfe_id
      ? supabase.from("financeiro_nfes_emitidas").select("*").eq("id", nfe_id)
      : supabase.from("financeiro_nfes_emitidas").select("*").eq("uuid_provedor", ref);

    const { data: nfeLocal, error: qErr } = await query.eq("user_id", userId).maybeSingle();
    if (qErr) return jsonError(500, qErr.message);
    if (!nfeLocal) return jsonError(404, "NF-e não encontrada");
    if (nfeLocal.status !== "autorizada") {
      return jsonError(409, `NF-e ainda não autorizada (status atual: ${nfeLocal.status})`);
    }

    let danfeUrl: string | null = nfeLocal.danfe_url ?? null;

    // Se ainda não temos a URL, consulta o Focus para obtê-la
    if (!danfeUrl) {
      const modelo = nfeLocal.modelo === "nfe" ? "nfe" : "nfce";
      const consult = await fetch(`${focusBase()}/v2/${modelo}/${nfeLocal.uuid_provedor}`, {
        headers: { Authorization: focusAuth() },
      });
      if (!consult.ok) return jsonError(consult.status, "falha_consulta_focus");
      const cdata = await consult.json();
      danfeUrl = cdata.caminho_danfe ?? null;
      if (danfeUrl) {
        await supabase.from("financeiro_nfes_emitidas")
          .update({ danfe_url: danfeUrl, xml_url: cdata.caminho_xml_nota_fiscal })
          .eq("id", nfeLocal.id);
      }
    }

    if (!danfeUrl) return jsonError(404, "DANFE indisponível para esta NF-e");

    // O Focus retorna um caminho relativo — montamos a URL absoluta
    const fullUrl = danfeUrl.startsWith("http") ? danfeUrl : `${focusBase()}${danfeUrl}`;

    const pdfRes = await fetch(fullUrl, {
      headers: { Authorization: focusAuth() },
    });
    if (!pdfRes.ok) {
      const txt = await pdfRes.text();
      return jsonError(pdfRes.status, `falha_download_pdf: ${txt.substring(0, 200)}`);
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const fileName = `DANFE-${nfeLocal.chave_acesso || nfeLocal.numero || nfeLocal.id}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[baixar-danfe]", e);
    return jsonError(500, e instanceof Error ? e.message : String(e));
  }
});
