import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) throw new Error("OPENAI_API_KEY não configurada");

    const { itens } = await req.json();
    if (!itens?.length) {
      return new Response(JSON.stringify({ error: "itens obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Avalie cada item de licitação abaixo com base no produto encontrado na cotação.

Para cada item, retorne:
- score (0-100): confiança geral na cotação
  * 80-100: produto alinhado ao edital, preço bom, fonte confiável, com avaliações
  * 60-79: produto compatível, pequenas divergências de especificação ou preço
  * 40-59: produto genérico ou sem confirmação suficiente
  * 0-39: produto suspeito, preço atípico ou sem aderência ao edital
- nivel: "alto" (>=80), "medio" (>=60), "baixo" (<60)
- justificativa: 1 frase explicando o score, mencionando pontos concretos (alinhamento com edital, preço vs referência, número de avaliações)

Itens:
${itens.map((it: any) => `
Item ${it.item_numero}: ${it.descricao}
  Qtd: ${it.quantidade} ${it.unidade}
  Preço ref: ${it.preco_ref ? `R$ ${it.preco_ref}` : "não informado"}
  Produto cotado: ${it.produto?.titulo || "não encontrado"}
  Preço cotado: ${it.produto?.preco ? `R$ ${it.produto.preco}` : "—"}
  Fonte: ${it.produto?.fonte || "—"}
  Nota da loja: ${it.produto?.nota_loja != null ? `${it.produto.nota_loja}/5` : "sem avaliação"}
  Total avaliações: ${it.produto?.total_avaliacoes ?? "desconhecido"}
`).join("\n")}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em avaliação de cotações para licitações públicas brasileiras. Seja objetivo e criterioso.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "retornar_avaliacoes",
            description: "Retorna avaliações de cada item cotado",
            parameters: {
              type: "object",
              properties: {
                avaliacoes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item_numero: { type: "number" },
                      score: { type: "number", minimum: 0, maximum: 100 },
                      nivel: { type: "string", enum: ["alto", "medio", "baixo"] },
                      justificativa: { type: "string" },
                    },
                    required: ["item_numero", "score", "nivel", "justificativa"],
                  },
                },
              },
              required: ["avaliacoes"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "retornar_avaliacoes" } },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", response.status, err);
      throw new Error("Erro ao avaliar cotações");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou avaliações");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, avaliacoes: parsed.avaliacoes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("avaliar-cotacoes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
