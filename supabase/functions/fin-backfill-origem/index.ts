// Backfill loop para origem_tipo em financeiro_lancamentos (e demais tabelas no futuro).
// Chama public.backfill_origem_lancamentos(5000) repetidamente até zerar (ou bater limite).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize ?? 5000), 10000);
    const maxIter = Math.min(Number(body.maxIter ?? 50), 200);

    let total = 0;
    let iter = 0;
    const inicio = Date.now();
    while (iter < maxIter) {
      const { data, error } = await supabase.rpc("backfill_origem_lancamentos", { p_limite: batchSize });
      if (error) throw error;
      const n = Number(data ?? 0);
      total += n;
      iter++;
      if (n === 0) break;
      // proteção contra timeout do edge runtime (~150s)
      if (Date.now() - inicio > 120_000) break;
    }

    return new Response(
      JSON.stringify({ ok: true, total_atualizado: total, iteracoes: iter, batchSize }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[fin-backfill-origem]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
