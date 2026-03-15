import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto_pdf, tipo_documento } = await req.json();
    if (!texto_pdf || texto_pdf.trim().length < 30) {
      return new Response(JSON.stringify({ error: "Texto do documento muito curto ou vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncated = texto_pdf.slice(0, 60000);
    const tipoLabel = tipo_documento || "Ordem de Fornecimento / Empenho / PRD";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em documentos de licitações e contratos públicos brasileiros. Extraia TODAS as informações de pedidos/ordens de fornecimento, notas de empenho (global, ordinário, estimativo), PRDs e documentos similares. Identifique o tipo de documento, número, data, itens com descrição completa, quantidades, unidades, valores unitários e totais. Se houver múltiplos itens numa tabela, extraia CADA linha. Se uma informação não estiver disponível, retorne null.`
          },
          {
            role: "user",
            content: `Extraia TODAS as informações deste documento (${tipoLabel}):\n\n${truncated}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_pedido",
              description: "Extrai dados estruturados de uma Ordem de Fornecimento, Nota de Empenho ou PRD",
              parameters: {
                type: "object",
                properties: {
                  tipo_documento: {
                    type: "string",
                    description: "Tipo do documento identificado: ordem_fornecimento, empenho_global, empenho_ordinario, empenho_estimativo, prd, outro"
                  },
                  numero_documento: { type: "string", description: "Número do documento (OF, NE, PRD)" },
                  data_documento: { type: "string", description: "Data do documento no formato YYYY-MM-DD" },
                  orgao_emissor: { type: "string", description: "Órgão que emitiu o documento" },
                  numero_contrato_ref: { type: "string", description: "Número do contrato de referência, se mencionado" },
                  observacoes: { type: "string", description: "Observações ou informações adicionais relevantes" },
                  valor_total: { type: "number", description: "Valor total do documento em reais" },
                  data_entrega: { type: "string", description: "Data de entrega prevista no formato YYYY-MM-DD" },
                  nota_fiscal: { type: "string", description: "Número da nota fiscal, se mencionada" },
                  itens: {
                    type: "array",
                    description: "Itens do pedido/empenho",
                    items: {
                      type: "object",
                      properties: {
                        codigo_item: { type: "string", description: "Código ou número do item" },
                        descricao: { type: "string", description: "Descrição completa do item" },
                        quantidade: { type: "number", description: "Quantidade solicitada" },
                        unidade: { type: "string", description: "Unidade de medida (UN, KG, CX, etc.)" },
                        valor_unitario: { type: "number", description: "Valor unitário em reais" },
                        valor_total: { type: "number", description: "Valor total do item em reais" },
                      },
                      required: ["descricao"],
                      additionalProperties: false,
                    }
                  }
                },
                required: ["tipo_documento", "numero_documento"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extrair_pedido" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extrair-pedido-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
