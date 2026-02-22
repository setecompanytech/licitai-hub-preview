import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BoletimRequest {
  tipo: "manha" | "meiodia" | "tarde";
  user_id?: string; // optional: send to specific user
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { tipo, user_id }: BoletimRequest = await req.json();

    // Determine which preference column to check
    const prefColumn = tipo === "manha" ? "boletim_manha" : tipo === "meiodia" ? "boletim_meiodia" : "boletim_tarde";

    // Get users with this bulletin enabled
    let query = supabase
      .from("boletim_preferencias")
      .select("user_id, email")
      .eq(prefColumn, true);

    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    const { data: subscribers, error: subError } = await query;
    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum assinante para este boletim", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recent licitacoes based on type
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    let licitacoesQuery = supabase
      .from("monitoramento_editais")
      .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, status")
      .order("created_at", { ascending: false })
      .limit(20);

    if (tipo === "novas" || tipo === "manha") {
      licitacoesQuery = licitacoesQuery.eq("status", "novo");
    } else if (tipo === "alteracoes" || tipo === "meiodia") {
      licitacoesQuery = licitacoesQuery.in("status", ["suspenso", "cancelado", "adiado", "alterado"]);
    } else {
      licitacoesQuery = licitacoesQuery.in("status", ["adjudicado", "homologado", "encerrado"]);
    }

    const { data: licitacoes } = await licitacoesQuery;

    const tipoLabel = tipo === "manha" ? "Novas Licitações – Manhã" : tipo === "meiodia" ? "Alterações e Avisos – Meio-dia" : "Resultados do Dia – Tarde";
    const tipoColor = tipo === "manha" ? "#22c55e" : tipo === "meiodia" ? "#f59e0b" : "#3b82f6";

    // Build HTML email
    const itemsHtml = (licitacoes || []).map((l) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
          <strong style="color:#1a1a2e;font-size:14px;">${l.titulo}</strong><br/>
          <span style="color:#666;font-size:12px;">${l.orgao} ${l.municipio ? `• ${l.municipio}/${l.uf}` : ""}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
          <span style="color:#1a1a2e;font-weight:600;font-size:14px;">
            ${l.valor_estimado ? `R$ ${Number(l.valor_estimado).toLocaleString("pt-BR")}` : "–"}
          </span>
        </td>
      </tr>
    `).join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/></head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 30px;border-radius:12px 12px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">📋 Boletim Diário</h1>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px;">${tipoLabel} • ${new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <div style="background:#ffffff;padding:24px 30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div style="background:${tipoColor}15;border-left:4px solid ${tipoColor};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
            <strong style="color:${tipoColor};font-size:15px;">${licitacoes?.length || 0} itens encontrados</strong>
          </div>
          ${licitacoes && licitacoes.length > 0 ? `
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f8f9fa;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;">Licitação</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;">Valor Est.</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          ` : `<p style="color:#666;text-align:center;padding:20px;">Nenhum item encontrado para este período.</p>`}
          <div style="text-align:center;margin-top:24px;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "")}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
              Ver na Plataforma
            </a>
          </div>
        </div>
        <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;">
          Você recebe este boletim pois está inscrito na plataforma ConLicitação.<br/>
          Para alterar suas preferências, acesse a seção Boletins na plataforma.
        </p>
      </div>
    </body>
    </html>`;

    // Send emails
    const results = [];
    for (const sub of subscribers) {
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: "ConLicitação <noreply@resend.dev>",
          to: [sub.email],
          subject: `${tipoLabel} – ${new Date().toLocaleDateString("pt-BR")}`,
          html,
        });

        // Log the send
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo,
          email: sub.email,
          status: emailError ? "erro" : "enviado",
          resend_id: emailData?.id || null,
          erro: emailError?.message || null,
        });

        results.push({ email: sub.email, success: !emailError });
      } catch (err) {
        results.push({ email: sub.email, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.success).length, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no envio de boletim:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
