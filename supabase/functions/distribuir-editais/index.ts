import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: distribute a specific edital to a specific contact (test mode)
    let testMode = false;
    let testEditalId: string | null = null;
    let testWhatsapp: string | null = null;
    let testEmail: string | null = null;
    try {
      const body = await req.json();
      testEditalId = body?.edital_id || null;
      testWhatsapp = body?.whatsapp_teste || null;
      testEmail = body?.email_teste || null;
      testMode = !!(testEditalId && (testWhatsapp || testEmail));
    } catch { /* no body */ }

    // Fetch undistributed editais from the last 12h
    let editaisQuery = supabase
      .from("editais_coletados")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (testEditalId) {
      editaisQuery = editaisQuery.eq("id", testEditalId);
    } else {
      editaisQuery = editaisQuery
        .eq("distribuido", false)
        .gte("created_at", new Date(Date.now() - 43200000).toISOString());
    }

    const { data: editais, error: editaisError } = await editaisQuery;
    if (editaisError) throw editaisError;

    let totalDistribuidos = 0;
    let totalEnvios = 0;

    for (const edital of editais ?? []) {
      // In test mode, use the provided contacts
      if (testMode) {
        let pdfSignedUrl = await obterPdfUrl(edital, supabase);

        if (testWhatsapp) {
          await enviarWhatsApp(edital, testWhatsapp, pdfSignedUrl, supabase, "teste");
          totalEnvios++;
        }
        if (testEmail) {
          await enviarEmailEdital(edital, testEmail, pdfSignedUrl, supabase, "teste");
          totalEnvios++;
        }
        totalDistribuidos++;
        continue;
      }

      // Fetch users with matching preferences
      const { data: prefs } = await supabase
        .from("preferencias_alertas")
        .select("*")
        .eq("ativo", true)
        .eq("receber_editais", true);

      // Filter by segment match
      const prefsComSegmento = (prefs ?? []).filter((p: any) => {
        if (!p.segmentos || p.segmentos.length === 0) return true;
        return p.segmentos.some((s: string) => {
          // Match by exact code or by prefix (e.g., "TI" matches "TI-001")
          if (s === edital.segmento_codigo) return true;
          if (edital.segmento_codigo?.startsWith(s)) return true;
          return false;
        });
      });

      // Filter by UF match
      const prefsComUF = prefsComSegmento.filter((p: any) => {
        if (!p.ufs || p.ufs.length === 0) return true;
        if (p.ufs.includes("TODOS")) return true;
        return p.ufs.includes(edital.uf);
      });

      if (prefsComUF.length === 0) {
        await supabase
          .from("editais_coletados")
          .update({ distribuido: true })
          .eq("id", edital.id);
        continue;
      }

      // Download PDF if available
      let pdfSignedUrl = await obterPdfUrl(edital, supabase);

      // Distribute to each matching user
      for (const pref of prefsComUF) {
        // WhatsApp channel
        if (pref.canal_whatsapp && pref.whatsapp_notificacao) {
          await enviarWhatsApp(edital, pref.whatsapp_notificacao, pdfSignedUrl, supabase, pref.user_id);
          totalEnvios++;
        }

        // Email channel
        if (pref.canal_email && pref.email_notificacao) {
          await enviarEmailEdital(edital, pref.email_notificacao, pdfSignedUrl, supabase, pref.user_id);
          totalEnvios++;
        }

        // Insert in-app alert
        await supabase.from("alertas_gerados").insert({
          user_id: pref.user_id,
          tipo: "novo_edital",
          titulo: formatarTitulo(edital),
          descricao: edital.objeto,
          orgao: edital.orgao,
          uf: edital.uf,
          segmento: edital.segmento_nome,
          numero_processo: edital.numero,
          valor_estimado: edital.valor_estimado,
          data_abertura: edital.data_abertura,
          url_edital: edital.url_edital,
          fonte: "distribuicao_automatica",
          urgente: false,
        });
      }

      // Mark as distributed
      await supabase
        .from("editais_coletados")
        .update({ distribuido: true })
        .eq("id", edital.id);

      totalDistribuidos++;
    }

    console.log(`[DISTRIBUIR] ${totalDistribuidos} editais distribuidos, ${totalEnvios} envios realizados`);

    return new Response(
      JSON.stringify({
        ok: true,
        editais_distribuidos: totalDistribuidos,
        envios_realizados: totalEnvios,
        test_mode: testMode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DISTRIBUIR] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function obterPdfUrl(edital: any, supabase: any): Promise<string | null> {
  if (edital.pdf_storage_path) {
    const { data } = await supabase.storage
      .from("documentos-publicos")
      .createSignedUrl(edital.pdf_storage_path, 60 * 60 * 24 * 7);
    return data?.signedUrl || null;
  }

  if (edital.url_pdf) {
    try {
      const pdfResp = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/baixar-pdf-edital`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ edital_id: edital.id, url_pdf: edital.url_pdf }),
        }
      );
      const pdfData = await pdfResp.json();
      return pdfData?.signed_url || null;
    } catch (e) {
      console.warn("[PDF] Falha ao baixar:", e);
      return null;
    }
  }

  return null;
}

// ── ENVIO WHATSAPP (Z-API) ───────────────────────────────────
async function enviarWhatsApp(
  edital: any,
  telefone: string,
  pdfUrl: string | null,
  supabase: any,
  userId: string
) {
  const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE_ID");
  const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
  const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

  const mensagem =
    `*PRAEFECTUS — Aviso de Licitação*\n\n` +
    `*${edital.modalidade || "Pregão Eletrônico"} nº ${edital.numero || "—"}*\n` +
    `${edital.orgao} — ${edital.municipio || ""}/${edital.uf || ""}\n\n` +
    `*OBJETO:* ${edital.objeto}\n\n` +
    (edital.valor_estimado
      ? `*Valor Estimado:* R$ ${Number(edital.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n`
      : "") +
    (edital.data_abertura
      ? `*Abertura:* ${new Date(edital.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasilia)\n`
      : "") +
    (edital.url_edital ? `*Edital:* ${edital.url_edital}\n` : "") +
    `\n_Enviado por PRAEFECTUS_`;

  let status = "enviado";
  let wamid = null;
  let erro = null;

  if (!ZAPI_INSTANCE || !ZAPI_TOKEN) {
    // Simulated send
    console.log(`[WHATSAPP-SIMULADO] Para ${telefone}: ${edital.numero || edital.objeto?.substring(0, 50)}`);
    status = "simulado";
  } else {
    try {
      const phone = telefone.replace(/\D/g, "");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

      // Send text
      const respTexto = await fetch(
        `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ phone, message: mensagem }),
        }
      );
      const data = await respTexto.json();
      wamid = data.messageId;

      // Send PDF if available
      if (pdfUrl) {
        await fetch(
          `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-document`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              phone,
              document: pdfUrl,
              fileName: `EDITAL_${(edital.numero || "AVISO").replace(/\//g, "-")}.pdf`,
              caption: `Edital em anexo — ${edital.numero || ""}`,
            }),
          }
        );
      }
    } catch (e) {
      status = "falhou";
      erro = String(e);
      console.error("[WHATSAPP] Erro:", e);
    }
  }

  await supabase.from("distribuicoes_realizadas").insert({
    edital_id: edital.id,
    user_id: userId,
    canal: "whatsapp",
    status,
    wamid,
    erro,
  });
}

// ── ENVIO E-MAIL via send-transactional-email ────────────────
async function enviarEmailEdital(
  edital: any,
  email: string,
  pdfUrl: string | null,
  supabase: any,
  userId: string
) {
  let status = "enviado";
  let erro = null;

  try {
    // Use the existing boletim-diario template via send-transactional-email
    const templateData = {
      tipo: "manha",
      data: new Date().toLocaleDateString("pt-BR"),
      numero_pregao: `${edital.modalidade || "Pregão Eletrônico"} Nº ${edital.numero || "—"}`,
      orgao: edital.orgao,
      objeto: edital.objeto,
      municipio: edital.municipio,
      uf: edital.uf,
      valor_estimado: edital.valor_estimado
        ? `R$ ${Number(edital.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
        : undefined,
      data_abertura: edital.data_abertura
        ? `${new Date(edital.data_abertura).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasilia)`
        : undefined,
      modalidade: edital.modalidade,
      portal: edital.url_edital,
    };

    // Calculate urgency
    if (edital.data_abertura) {
      const horasRestantes = Math.max(
        0,
        Math.round((new Date(edital.data_abertura).getTime() - Date.now()) / (1000 * 60 * 60))
      );
      if (horasRestantes <= 24) {
        templateData.urgencia = "critica" as any;
        templateData.horas_restantes = horasRestantes as any;
      } else if (horasRestantes <= 72) {
        templateData.urgencia = "alta" as any;
        templateData.horas_restantes = horasRestantes as any;
      }
    }

    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          templateName: "boletim-diario",
          recipientEmail: email,
          idempotencyKey: `dist-edital-${edital.id}-${userId}`,
          templateData,
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Email API ${resp.status}: ${errText}`);
    }
  } catch (e) {
    status = "falhou";
    erro = String(e);
    console.error("[EMAIL] Erro:", e);
  }

  await supabase.from("distribuicoes_realizadas").insert({
    edital_id: edital.id,
    user_id: userId,
    canal: "email",
    status,
    erro,
  });
}

function formatarTitulo(edital: any): string {
  return (
    `${edital.modalidade || "Pregão"} nº ${edital.numero || "—"} — ` +
    edital.objeto.substring(0, 70) +
    (edital.objeto.length > 70 ? "..." : "")
  ).substring(0, 120);
}
