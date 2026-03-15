import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BoletimRequest {
  tipo: "manha" | "meiodia" | "tarde";
  user_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tipo, user_id }: BoletimRequest = await req.json();

    const prefColumn = tipo === "manha" ? "boletim_manha" : tipo === "meiodia" ? "boletim_meiodia" : "boletim_tarde";

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

    // Fetch recent licitacoes
    let licitacoesQuery = supabase
      .from("monitoramento_editais")
      .select("titulo, orgao, valor_estimado, uf, municipio, data_abertura, status")
      .order("created_at", { ascending: false })
      .limit(20);

    if (tipo === "manha") {
      licitacoesQuery = licitacoesQuery.eq("status", "novo");
    } else if (tipo === "meiodia") {
      licitacoesQuery = licitacoesQuery.in("status", ["suspenso", "cancelado", "adiado", "alterado"]);
    } else {
      licitacoesQuery = licitacoesQuery.in("status", ["adjudicado", "homologado", "encerrado"]);
    }

    const { data: licitacoes } = await licitacoesQuery;

    const tipoLabel = tipo === "manha" ? "Novas Licitações — Manhã" : tipo === "meiodia" ? "Alterações e Avisos — Meio-dia" : "Resultados do Dia — Tarde";

    // Send via transactional email queue
    const results = [];
    for (const sub of subscribers) {
      try {
        const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            template: 'boletim-diario',
            to: sub.email,
            subject: `${tipoLabel} — ${new Date().toLocaleDateString("pt-BR")}`,
            label: `boletim-${tipo}`,
            data: {
              tipo,
              data: new Date().toLocaleDateString("pt-BR"),
              licitacoes: (licitacoes || []).map(l => ({
                titulo: l.titulo,
                orgao: l.orgao,
                municipio: l.municipio,
                uf: l.uf,
                valor: l.valor_estimado ? `R$ ${Number(l.valor_estimado).toLocaleString("pt-BR")}` : '–',
              })),
            },
          },
        });

        // Log the send
        await supabase.from("boletim_envios").insert({
          user_id: sub.user_id,
          tipo,
          email: sub.email,
          status: invokeErr ? "erro" : "enviado",
          erro: invokeErr?.message || null,
        });

        results.push({ email: sub.email, success: !invokeErr });
      } catch (err: any) {
        results.push({ email: sub.email, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter((r) => r.success).length, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no envio de boletim:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
