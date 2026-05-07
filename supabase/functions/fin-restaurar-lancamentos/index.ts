// Restaura em lote os lançamentos financeiros excluídos nas últimas 48h via audit log
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const deadline = Date.now() + 55_000;
    let total = 0;
    let iter = 0;
    while (Date.now() < deadline) {
      iter++;
      const { data, error } = await supabase.rpc("restaurar_lancamentos_audit", { p_limite: 5000 });
      if (error) throw error;
      const n = Number(data ?? 0);
      total += n;
      if (n === 0) break;
    }
    const { count } = await supabase
      .from("financeiro_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("tabela", "financeiro_lancamentos")
      .eq("operacao", "DELETE")
      .gte("created_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString());
    return new Response(JSON.stringify({ ok: true, restaurados_nesta_chamada: total, iteracoes: iter, deletes_audit_total_48h: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
