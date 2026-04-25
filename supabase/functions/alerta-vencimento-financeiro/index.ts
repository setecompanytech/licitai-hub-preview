import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const hoje = new Date();
    const targets = [3, 1, 0]; // D-3, D-1, D0
    const resultados: any[] = [];

    for (const dias of targets) {
      const alvo = new Date(hoje);
      alvo.setDate(alvo.getDate() + dias);
      const ini = new Date(alvo); ini.setHours(0, 0, 0, 0);
      const fim = new Date(alvo); fim.setHours(23, 59, 59, 999);

      const { data: lancs, error } = await supabase
        .from("fin_lancamentos")
        .select("id, empresa_id, tipo, descricao, valor, data_competencia, status")
        .in("status", ["previsto", "pendente"])
        .gte("data_competencia", ini.toISOString().slice(0, 10))
        .lte("data_competencia", fim.toISOString().slice(0, 10));

      if (error) {
        console.error("Erro lancamentos:", error);
        continue;
      }
      if (!lancs || lancs.length === 0) continue;

      for (const l of lancs) {
        const tipoLabel = l.tipo === "a_pagar" ? "PAGAR" : "RECEBER";
        const urgencia = dias === 0 ? "🚨 VENCE HOJE" : dias === 1 ? "⚠️ VENCE AMANHÃ" : "📋 Vence em 3 dias";
        const valor = Number(l.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const msg = `${urgencia} · ${tipoLabel} · ${l.descricao} · ${valor}`;

        const { data: membros } = await supabase
          .from("empresa_membros")
          .select("user_id")
          .eq("empresa_id", l.empresa_id);

        if (!membros) continue;

        for (const m of membros) {
          // 1) Notificação in-app
          await supabase.from("notificacoes").insert({
            user_id: m.user_id,
            titulo: `Vencimento ${dias === 0 ? "hoje" : `em ${dias} dia(s)`}`,
            mensagem: msg,
            tipo: dias === 0 ? "urgente" : "alerta",
            link: "/financeiro",
          });

          // 2) Email
          const { data: auth } = await supabase.auth.admin.getUserById(m.user_id);
          const email = auth?.user?.email;
          if (email) {
            try {
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "alerta-vencimento-financeiro",
                  recipientEmail: email,
                  idempotencyKey: `fin-venc-${l.id}-${dias}`,
                  templateData: { descricao: l.descricao, valor, tipo: tipoLabel, dias, dataVencimento: l.data_competencia },
                },
              });
            } catch (e) {
              console.error("Erro email:", e);
            }
          }

          // 3) WhatsApp (setor financeiro ativo)
          const { data: wpref } = await supabase
            .from("whatsapp_preferencias")
            .select("telefone, ativo, setor_financeiro")
            .eq("user_id", m.user_id)
            .eq("ativo", true)
            .eq("setor_financeiro", true)
            .maybeSingle();

          if (wpref?.telefone) {
            await supabase.from("whatsapp_envios").insert({
              user_id: m.user_id,
              telefone: wpref.telefone,
              setor: "financeiro",
              mensagem: `💰 ${msg}`,
              status: "simulado",
            });
          }

          resultados.push({ lancamento_id: l.id, dias, user_id: m.user_id });
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, alertas_disparados: resultados.length, detalhes: resultados }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
