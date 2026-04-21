// Edge Function: processo-auto-prepare
// Orquestra a "preparação automática" da Pasta do Processo:
//   1) localiza/identifica o edital de origem (editais_coletados)
//   2) baixa o PDF do edital (via baixar-pdf-edital) e o copia para
//      o bucket privado `processo-arquivos` numa pasta dedicada do usuário
//   3) dispara a auto-ingestão de itens (edital-auto-ingest)
// É IDEMPOTENTE: se já houver um registro de sucesso para a licitação,
// retorna imediatamente sem reprocessar (a menos que `force=true`).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const licitacaoId: string | undefined = body?.licitacao_id;
    const force: boolean = !!body?.force;
    if (!licitacaoId) {
      return new Response(JSON.stringify({ error: "licitacao_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica licitação pertence ao usuário
    const { data: lic } = await admin
      .from("licitacoes")
      .select("id, user_id, numero, orgao, url_edital")
      .eq("id", licitacaoId)
      .maybeSingle();
    if (!lic || lic.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Licitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência: já rodou com sucesso?
    if (!force) {
      const { data: prev } = await admin
        .from("processos_ingest_status")
        .select("status, arquivos_baixados")
        .eq("user_id", userId)
        .eq("licitacao_id", licitacaoId)
        .maybeSingle();
      const arquivos = (prev?.arquivos_baixados ?? {}) as Record<string, unknown>;
      if (prev?.status === "success" && arquivos["edital_pdf_path"]) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            message: "Já preparado.",
            edital_pdf_path: arquivos["edital_pdf_path"],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Marca como running
    await admin.from("processos_ingest_status").upsert(
      {
        user_id: userId,
        licitacao_id: licitacaoId,
        status: "running",
        etapa: "preparação automática",
        mensagem: "Baixando edital e extraindo itens em paralelo…",
      },
      { onConflict: "user_id,licitacao_id" },
    );

    // Tenta localizar o edital original em editais_coletados
    let editalRow: { id: string; url_pdf: string | null; url_edital: string | null } | null = null;
    if (lic.url_edital) {
      const { data } = await admin
        .from("editais_coletados")
        .select("id, url_pdf, url_edital")
        .eq("url_edital", lic.url_edital)
        .maybeSingle();
      editalRow = data ?? null;
    }
    if (!editalRow && lic.numero && lic.orgao) {
      const { data } = await admin
        .from("editais_coletados")
        .select("id, url_pdf, url_edital")
        .eq("numero", lic.numero)
        .eq("orgao", lic.orgao)
        .limit(1)
        .maybeSingle();
      editalRow = data ?? null;
    }

    // Dispara em paralelo: baixar-pdf-edital + edital-auto-ingest
    const tasks: Promise<{ kind: string; ok: boolean; data?: any; error?: string }>[] = [];

    // Task 1: baixar PDF (se temos URL)
    const urlPdf = editalRow?.url_pdf || editalRow?.url_edital || lic.url_edital;
    if (editalRow?.id && urlPdf) {
      tasks.push(
        fetch(`${SUPABASE_URL}/functions/v1/baixar-pdf-edital`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ edital_id: editalRow.id, url_pdf: urlPdf }),
        })
          .then(async (r) => ({ kind: "pdf", ok: r.ok, data: await r.json() }))
          .catch((e) => ({ kind: "pdf", ok: false, error: String(e) })),
      );
    } else {
      tasks.push(Promise.resolve({ kind: "pdf", ok: false, error: "url_pdf indisponível" }));
    }

    // Task 2: auto-ingest (extração de itens)
    tasks.push(
      fetch(`${SUPABASE_URL}/functions/v1/edital-auto-ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ licitacao_id: licitacaoId, replace: false }),
      })
        .then(async (r) => ({ kind: "ingest", ok: r.ok, data: await r.json() }))
        .catch((e) => ({ kind: "ingest", ok: false, error: String(e) })),
    );

    const results = await Promise.all(tasks);
    const pdfRes = results.find((r) => r.kind === "pdf");
    const ingestRes = results.find((r) => r.kind === "ingest");

    // Se PDF foi baixado, copia para processo-arquivos/<user>/<licitacao>/edital/edital-original.pdf
    let editalPdfPath: string | null = null;
    if (pdfRes?.ok && pdfRes.data?.path) {
      try {
        const sourcePath: string = pdfRes.data.path; // "editais/<edital_id>.pdf"
        const { data: pdfBlob, error: dlErr } = await admin.storage
          .from("documentos-publicos")
          .download(sourcePath);
        if (!dlErr && pdfBlob) {
          const destPath = `${userId}/${licitacaoId}/edital/edital-original.pdf`;
          const buf = new Uint8Array(await pdfBlob.arrayBuffer());
          const { error: upErr } = await admin.storage
            .from("processo-arquivos")
            .upload(destPath, buf, {
              contentType: "application/pdf",
              upsert: true,
            });
          if (!upErr) {
            editalPdfPath = destPath;
          } else {
            console.error("[auto-prepare] upload destino:", upErr);
          }
        }
      } catch (e) {
        console.error("[auto-prepare] copy pdf:", e);
      }
    }

    const success = !!editalPdfPath || !!ingestRes?.ok;
    const totalItens = ingestRes?.data?.total ?? 0;

    await admin.from("processos_ingest_status").upsert(
      {
        user_id: userId,
        licitacao_id: licitacaoId,
        status: success ? "success" : "failed",
        etapa: "preparação automática",
        mensagem: success
          ? `Pasta preparada: ${editalPdfPath ? "PDF baixado" : "PDF indisponível"} · ${totalItens} itens.`
          : "Falha na preparação automática.",
        total_itens: totalItens || null,
        fonte: ingestRes?.data?.fonte ?? null,
        arquivos_baixados: {
          edital_pdf_path: editalPdfPath,
          edital_id: editalRow?.id ?? null,
          ingest_ok: !!ingestRes?.ok,
          pdf_ok: !!editalPdfPath,
        },
        finalizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,licitacao_id" },
    );

    return new Response(
      JSON.stringify({
        success,
        edital_pdf_path: editalPdfPath,
        total_itens: totalItens,
        ingest: ingestRes?.data ?? null,
        pdf: pdfRes?.data ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[processo-auto-prepare]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
