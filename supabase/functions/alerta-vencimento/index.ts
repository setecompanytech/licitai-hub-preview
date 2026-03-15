import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find subscriptions expiring in 7, 3 or 1 days
    const now = new Date();
    const alertDays = [7, 3, 1];

    const results: Array<{ empresa_id: string; dias: number; canal: string; sucesso: boolean }> = [];

    for (const dias of alertDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dias);
      const targetStart = new Date(targetDate);
      targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetDate);
      targetEnd.setHours(23, 59, 59, 999);

      const { data: assinaturas, error: assError } = await supabase
        .from("assinaturas")
        .select("id, empresa_id, data_fim, status, plano_id")
        .eq("status", "ativa")
        .gte("data_fim", targetStart.toISOString())
        .lte("data_fim", targetEnd.toISOString());

      if (assError) {
        console.error("Erro ao buscar assinaturas:", assError);
        continue;
      }

      if (!assinaturas || assinaturas.length === 0) continue;

      for (const ass of assinaturas) {
        // Get empresa info
        const { data: empresa } = await supabase
          .from("empresas")
          .select("razao_social, cnpj")
          .eq("id", ass.empresa_id)
          .single();

        // Get plano info
        const { data: plano } = await supabase
          .from("planos")
          .select("nome")
          .eq("id", ass.plano_id)
          .single();

        // Get all members of the empresa
        const { data: membros } = await supabase
          .from("empresa_membros")
          .select("user_id")
          .eq("empresa_id", ass.empresa_id);

        if (!membros || membros.length === 0) continue;

        const empresaNome = empresa?.razao_social || "Sua empresa";
        const planoNome = plano?.nome || "seu plano";
        const dataFim = new Date(ass.data_fim!).toLocaleDateString("pt-BR");

        const urgencia = dias === 1 ? "🚨 URGENTE" : dias === 3 ? "⚠️ Atenção" : "📋 Aviso";
        const mensagem = `${urgencia}: O plano ${planoNome} da empresa ${empresaNome} vence em ${dias} dia(s) (${dataFim}). Renove para não perder o acesso.`;

        for (const membro of membros) {
          // 1. IN-SYSTEM NOTIFICATION
          try {
            await supabase.from("notificacoes").insert({
              user_id: membro.user_id,
              titulo: `Plano vence em ${dias} dia(s)`,
              mensagem,
              tipo: dias === 1 ? "urgente" : "alerta",
              link: "/configuracoes",
            });
            results.push({ empresa_id: ass.empresa_id, dias, canal: "sistema", sucesso: true });
          } catch (e) {
            console.error("Erro notificação sistema:", e);
            results.push({ empresa_id: ass.empresa_id, dias, canal: "sistema", sucesso: false });
          }

          // Get user profile for email and phone
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome_completo, user_id")
            .eq("user_id", membro.user_id)
            .single();

          // Get user email from auth (via service role)
          const { data: authUser } = await supabase.auth.admin.getUserById(membro.user_id);
          const userEmail = authUser?.user?.email;

          // 2. EMAIL NOTIFICATION
          if (resendApiKey && userEmail) {
            try {
              const resend = new Resend(resendApiKey);
              const nomeUsuario = profile?.nome_completo || userEmail;

              const html = `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"/></head>
              <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <div style="max-width:600px;margin:0 auto;padding:20px;">
                  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 30px;border-radius:12px 12px 0 0;">
                    <h1 style="color:#ffffff;margin:0;font-size:22px;">⚡ PRAEFECTUS</h1>
                    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:14px;">Alerta de Vencimento de Plano</p>
                  </div>
                  <div style="background:#ffffff;padding:24px 30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <p style="color:#333;font-size:15px;">Olá, <strong>${nomeUsuario}</strong>!</p>
                    
                    <div style="background:${dias === 1 ? '#fef2f2' : dias === 3 ? '#fffbeb' : '#f0f9ff'};border-left:4px solid ${dias === 1 ? '#ef4444' : dias === 3 ? '#f59e0b' : '#3b82f6'};padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
                      <strong style="color:${dias === 1 ? '#dc2626' : dias === 3 ? '#d97706' : '#2563eb'};font-size:16px;">
                        ${urgencia}: Seu plano vence em ${dias} dia(s)
                      </strong>
                      <p style="color:#555;margin:8px 0 0;font-size:14px;">
                        Plano <strong>${planoNome}</strong> • Empresa: ${empresaNome}<br/>
                        Data de vencimento: <strong>${dataFim}</strong>
                      </p>
                    </div>

                    <p style="color:#555;font-size:14px;line-height:1.6;">
                      Para manter acesso contínuo a todas as funcionalidades da plataforma, renove seu plano antes do vencimento.
                    </p>

                    <div style="text-align:center;margin:24px 0;">
                      <a href="#" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                        Renovar Plano
                      </a>
                    </div>
                  </div>
                  <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;">
                    PRAEFECTUS — Plataforma inteligente de licitações
                  </p>
                </div>
              </body>
              </html>`;

              await resend.emails.send({
                from: "PRAEFECTUS <noreply@resend.dev>",
                to: [userEmail],
                subject: `${urgencia} — Plano ${planoNome} vence em ${dias} dia(s)`,
                html,
              });

              results.push({ empresa_id: ass.empresa_id, dias, canal: "email", sucesso: true });
            } catch (e) {
              console.error("Erro envio email:", e);
              results.push({ empresa_id: ass.empresa_id, dias, canal: "email", sucesso: false });
            }
          }

          // 3. WHATSAPP NOTIFICATION (simulated)
          const { data: whatsPrefs } = await supabase
            .from("whatsapp_preferencias")
            .select("telefone, ativo, setor_financeiro")
            .eq("user_id", membro.user_id)
            .eq("ativo", true)
            .single();

          if (whatsPrefs?.telefone) {
            try {
              // Simulated WhatsApp send — replace with real gateway
              console.log(`[SIMULADO] WhatsApp vencimento para ${whatsPrefs.telefone}: ${mensagem}`);

              await supabase.from("whatsapp_envios").insert({
                user_id: membro.user_id,
                telefone: whatsPrefs.telefone,
                setor: "financeiro",
                mensagem: `💳 VENCIMENTO DE PLANO\n\n${mensagem}\n\n👉 Acesse a plataforma para renovar.`,
                status: "simulado",
              });

              results.push({ empresa_id: ass.empresa_id, dias, canal: "whatsapp", sucesso: true });
            } catch (e) {
              console.error("Erro envio WhatsApp:", e);
              results.push({ empresa_id: ass.empresa_id, dias, canal: "whatsapp", sucesso: false });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Verificação de vencimentos concluída",
        alertas_enviados: results.length,
        detalhes: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no alerta de vencimento:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
