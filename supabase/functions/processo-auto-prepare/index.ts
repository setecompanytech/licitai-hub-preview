// @ts-nocheck
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

    // Validate user — getUser, e não getClaims: o runtime das Edge Functions
    // carrega uma versão do supabase-js sem getClaims, e a chamada estourava
    // "userClient.auth.getClaims is not a function" (500) em toda requisição.
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const userId = userData?.user?.id;
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

    // Acesso via RLS por empresa (Onda 4): colega da empresa também pode
    // preparar a pasta do processo — a checagem por user_id devolvia 404.
    const { data: lic } = await userClient
      .from("licitacoes")
      .select("id, user_id, numero, orgao, url_edital")
      .eq("id", licitacaoId)
      .maybeSingle();
    if (!lic) {
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

    // Task 1: baixar PDF
    const urlPdf = editalRow?.url_pdf || editalRow?.url_edital || lic.url_edital;

    if (editalRow?.id && urlPdf) {
      // Caminho normal: usa a Edge Function baixar-pdf-edital (que salva em documentos-publicos)
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
    } else if (lic.url_edital) {
      // Caminho PNCP: busca arquivos direto na API pública e faz upload para processo-arquivos
      tasks.push(
        (async () => {
          try {
            // Tenta extrair CNPJ/ano/seq da URL do PNCP
            const m = lic.url_edital!.match(/editais\/(\d{14})\/(\d{4})\/(\d+)/);
            if (!m) return { kind: "pdf", ok: false, error: "URL PNCP não reconhecida" };
            const [, cnpj, ano, seq] = m;

            const rArqs = await fetch(
              `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos?pagina=1&tamanhoPagina=100`,
              {
                headers: {
                  Accept: "application/json",
                  "User-Agent": "Mozilla/5.0 (compatible; LicitAI/1.0)",
                },
                signal: AbortSignal.timeout(20_000),
              },
            );
            if (!rArqs.ok) return { kind: "pdf", ok: false, error: `PNCP arquivos HTTP ${rArqs.status}` };

            const payload = await rArqs.json();
            const arr: any[] = Array.isArray(payload) ? payload : (payload?.data ?? []);

            // Prefere arquivo com "EDITAL" no título/nome e extensão PDF.
            // A API do PNCP nem sempre traz a extensão na URL (várias vêm como
            // .../arquivos/1), então o PDF também é reconhecido pelo nome do arquivo.
            const ehPdf = (a: any) =>
              /\.pdf($|\?)/i.test(a.url ?? "") || /\.pdf$/i.test(a.nomeArquivo ?? "");
            const ehEdital = (a: any) =>
              /edital/i.test(a.titulo ?? "") || /edital/i.test(a.nomeArquivo ?? "");

            const arq = arr.find((a: any) => ehEdital(a) && ehPdf(a))
              ?? arr.find((a: any) => ehPdf(a))
              ?? arr.find((a: any) => ehEdital(a))
              ?? arr[0];

            if (!arq) return { kind: "pdf", ok: false, error: "Nenhum arquivo listado no PNCP" };

            // Quando a listagem não traz URL, monta o endpoint por sequencial
            const seqArq = arq.sequencialDocumento ?? arq.sequencialArquivo ?? 1;
            const urlArquivo = arq.url
              ?? `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos/${seqArq}`;

            // Download direto do PDF (timeout conservador para caber dentro do limite da edge function)
            const rPdf = await fetch(urlArquivo, {
              redirect: "follow",
              headers: { "User-Agent": "Mozilla/5.0 (compatible; LicitAI/1.0)" },
              signal: AbortSignal.timeout(40_000),
            });
            if (!rPdf.ok) return { kind: "pdf", ok: false, error: `Download PDF HTTP ${rPdf.status}` };

            const pdfBuf = new Uint8Array(await rPdf.arrayBuffer());
            const destPath = `${userId}/${licitacaoId}/edital/edital-original.pdf`;
            const { error: upErr } = await admin.storage
              .from("processo-arquivos")
              .upload(destPath, pdfBuf, { contentType: "application/pdf", upsert: true });

            if (upErr) return { kind: "pdf", ok: false, error: `Upload: ${upErr.message}` };

            // Retorna path direto (já salvo no destino, sem precisar de cópia)
            return { kind: "pdf", ok: true, data: { path: destPath, direct: true } };
          } catch (e) {
            return { kind: "pdf", ok: false, error: String(e) };
          }
        })(),
      );
    } else {
      tasks.push(Promise.resolve({ kind: "pdf", ok: false, error: "url_pdf indisponível" }));
    }

    // Task 2: auto-ingest (extração de itens) — timeout de 50s para caber no budget total
    tasks.push(
      fetch(`${SUPABASE_URL}/functions/v1/edital-auto-ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ licitacao_id: licitacaoId, replace: false }),
        signal: AbortSignal.timeout(50_000),
      })
        .then(async (r) => ({ kind: "ingest", ok: r.ok, data: await r.json() }))
        .catch((e) => ({ kind: "ingest", ok: false, error: String(e) })),
    );

    const results = await Promise.all(tasks);
    const pdfRes = results.find((r) => r.kind === "pdf");
    const ingestRes = results.find((r) => r.kind === "ingest");

    // Se PDF foi baixado, determina o destino final
    let editalPdfPath: string | null = null;

    if (pdfRes?.ok && pdfRes.data?.direct) {
      // Download PNCP direto — já foi salvo em processo-arquivos pela task
      editalPdfPath = pdfRes.data.path;
    } else if (pdfRes?.ok && pdfRes.data?.path) {
      // Download via baixar-pdf-edital — copia de documentos-publicos para processo-arquivos
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

    const totalItens = ingestRes?.data?.total ?? 0;
    // Sucesso real = PDF baixado OU itens extraídos com sucesso
    const ingestSuccess = !!ingestRes?.ok && !!ingestRes?.data?.success && totalItens > 0;
    const success = !!editalPdfPath || ingestSuccess;

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
