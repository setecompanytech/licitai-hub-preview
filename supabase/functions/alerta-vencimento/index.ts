// @ts-nocheck
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

          // 2. EMAIL NOTIFICATION via transactional queue
          if (userEmail) {
            try {
              const nomeUsuario = profile?.nome_completo || userEmail;
              await supabase.functions.invoke('send-transactional-email', {
                body: {
                  template: 'alerta-vencimento-plano',
                  to: userEmail,
                  subject: `${urgencia} — Plano ${planoNome} vence em ${dias} dia(s)`,
                  data: {
                    nome: nomeUsuario,
                    plano: planoNome,
                    empresa: empresaNome,
                    dias,
                    dataFim,
                  },
                },
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
