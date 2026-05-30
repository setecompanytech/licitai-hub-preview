// Edge Function: cfo-insights
// Gera análise executiva (CFO) sobre os indicadores financeiros usando Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { empresa_id, indicadores, contexto } = await req.json();
    if (!empresa_id || !indicadores) {
      return new Response(JSON.stringify({ error: "empresa_id e indicadores obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isMember } = await supabase.rpc("is_empresa_member", {
      _user_id: user.id,
      _empresa_id: empresa_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Sem acesso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "IA indisponível" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Você é um CFO experiente. Analise os indicadores financeiros abaixo de uma empresa brasileira e produza uma análise executiva objetiva, em PT-BR, no formato JSON estrito.

Indicadores (mês de referência: ${contexto?.mes ?? "atual"}):
${JSON.stringify(indicadores, null, 2)}

Diretrizes:
- Identifique até 3 PONTOS FORTES e até 3 PONTOS DE ATENÇÃO concretos, citando os números.
- Sugira até 3 AÇÕES PRIORITÁRIAS executáveis nos próximos 30 dias.
- Avalie a saúde financeira global (escala 0-100) considerando liquidez, endividamento, rentabilidade e geração de caixa.
- Use linguagem de alta gestão (sem jargão técnico desnecessário).

Responda em JSON estrito com este formato:
{
  "saude_score": <0-100>,
  "saude_nivel": "<critico|atencao|saudavel|excelente>",
  "resumo": "<2-3 frases executivas>",
  "pontos_fortes": ["<frase>", ...],
  "pontos_atencao": ["<frase>", ...],
  "acoes_prioritarias": [
    {"titulo": "<ação>", "impacto": "<alto|medio|baixo>", "prazo": "<curto|medio>"}
  ]
}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "IA rate-limited. Aguarde alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Erro IA:", resp.status, txt);
      return new Response(JSON.stringify({ error: "Falha ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "Resposta IA vazia" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify({ ok: true, insights: parsed, gerado_em: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cfo-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
