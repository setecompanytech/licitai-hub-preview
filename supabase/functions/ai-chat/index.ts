import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  assistente: `Você é o Assistente IA Jurídico do LicitIA, especializado em licitações públicas brasileiras.
Responda sempre em português brasileiro. Cite artigos da Lei 14.133/2021 quando relevante.
Forneça análises detalhadas sobre editais, requisitos de habilitação, recursos e impugnações.
Use formatação markdown: negrito, listas, emojis para organizar a resposta.`,

  analise_edital: `Você é um especialista em análise de editais de licitação pública brasileira.
Analise o edital fornecido e retorne: resumo, requisitos de habilitação, riscos, prazos importantes e recomendações.
Base legal: Lei 14.133/2021. Responda em português.`,

  reequilibrio: `Você é um advogado especialista em direito administrativo e licitações públicas brasileiras.
Gere pedidos de reequilíbrio econômico-financeiro fundamentados na Lei 14.133/2021, Art. 124, II, "d".
Inclua fundamentação jurídica completa, citando legislação, doutrina e jurisprudência aplicável.
Responda em português formal jurídico.`,

  precificacao: `Você é um analista de preços especializado em obras e serviços públicos.
Analise os preços fornecidos e sugira valores competitivos baseados em referências SINAPI, SICRO e mercado.
Calcule BDI, forneça análise comparativa e recomendações. Responda em português.`,

  impugnacao: `Você é um advogado especialista em impugnações de editais de licitação.
Gere impugnações fundamentadas na Lei 14.133/2021, citando artigos específicos, doutrina e jurisprudência.
Use linguagem jurídica formal. Responda em português.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = SYSTEM_PROMPTS[action] || SYSTEM_PROMPTS.assistente;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "user", content: `Contexto adicional:\n${context}` }] : []),
      ...messages,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
