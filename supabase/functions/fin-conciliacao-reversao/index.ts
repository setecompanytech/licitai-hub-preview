// Edge: fin-conciliacao-reversao
// Reverte uma conciliação (auto ou manual) mantendo o histórico no fin_conciliacao_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conciliacao_id, motivo } = await req.json();
    if (!conciliacao_id) {
      return new Response(JSON.stringify({ error: "conciliacao_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca conciliação
    const { data: conc, error: errConc } = await supabase
      .from("financeiro_conciliacoes")
      .select("id, empresa_id, extrato_movimento_id, lancamento_id, score, metodo, motivos")
      .eq("id", conciliacao_id)
      .single();
    if (errConc || !conc) {
      return new Response(JSON.stringify({ error: "Conciliação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase.rpc("is_empresa_member", {
      _user_id: user.id, _empresa_id: conc.empresa_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reverte: marca movimento como não conciliado e devolve lançamento ao status previsto
    if (conc.extrato_movimento_id) {
      await supabase.from("financeiro_extrato_movimentos")
        .update({ conciliado: false, lancamento_id: null })
        .eq("id", conc.extrato_movimento_id);
    }
    if (conc.lancamento_id) {
      await supabase.from("financeiro_lancamentos")
        .update({ status: "previsto", data_conciliado: null })
        .eq("id", conc.lancamento_id);
    }
    await supabase.from("financeiro_conciliacoes").delete().eq("id", conciliacao_id);

    // Log de auditoria reversível
    await supabase.from("fin_conciliacao_log").insert({
      empresa_id: conc.empresa_id,
      movimento_id: conc.extrato_movimento_id,
      lancamento_id: conc.lancamento_id,
      acao: "revert",
      confianca: conc.score,
      metodo: conc.metodo === "ia" ? "ia_descritor" : "deterministico",
      detalhes: { motivo: motivo || null, motivos_originais: conc.motivos, conciliacao_id },
      revertido: true,
      revertido_por: user.id,
      revertido_em: new Date().toISOString(),
      user_id: user.id,
    });

    return new Response(JSON.stringify({ ok: true, revertido: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fin-conciliacao-reversao:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
