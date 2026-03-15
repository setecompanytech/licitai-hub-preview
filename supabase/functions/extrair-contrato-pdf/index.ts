import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto_pdf } = await req.json();
    if (!texto_pdf || texto_pdf.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Texto do PDF muito curto ou vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncated = texto_pdf.slice(0, 30000);

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
            content: `Você é um especialista em contratos públicos brasileiros. Extraia as informações do contrato a partir do texto fornecido. Se uma informação não estiver disponível, retorne null. Para itens do contrato, extraia todos os itens encontrados com descrição, quantidade, unidade, valor unitário e valor total.`
          },
          {
            role: "user",
            content: `Extraia as informações deste contrato público:\n\n${truncated}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_contrato",
              description: "Extrai dados estruturados de um contrato público brasileiro",
              parameters: {
                type: "object",
                properties: {
                  numero_contrato: { type: "string", description: "Número do contrato (ex: CT-001/2025)" },
                  objeto: { type: "string", description: "Objeto/descrição do contrato" },
                  orgao_contratante: { type: "string", description: "Nome do órgão contratante" },
                  valor_global: { type: "number", description: "Valor global do contrato em reais" },
                  data_assinatura: { type: "string", description: "Data de assinatura no formato YYYY-MM-DD" },
                  data_inicio: { type: "string", description: "Data de início da vigência no formato YYYY-MM-DD" },
                  data_fim: { type: "string", description: "Data de fim da vigência no formato YYYY-MM-DD" },
                  vigencia_meses: { type: "number", description: "Vigência em meses" },
                  modalidade: { type: "string", description: "Modalidade da licitação (Pregão Eletrônico, Concorrência, etc.)" },
                  uf: { type: "string", description: "UF do órgão contratante (2 letras)" },
                  municipio: { type: "string", description: "Município do órgão contratante" },
                  fiscal_nome: { type: "string", description: "Nome do fiscal do contrato" },
                  fiscal_email: { type: "string", description: "E-mail do fiscal" },
                  fiscal_telefone: { type: "string", description: "Telefone do fiscal" },
                  observacoes: { type: "string", description: "Observações relevantes extraídas" },
                  itens: {
                    type: "array",
                    description: "Itens do contrato",
                    items: {
                      type: "object",
                      properties: {
                        codigo_item: { type: "string", description: "Código ou número do item" },
                        descricao: { type: "string", description: "Descrição do item" },
                        quantidade: { type: "number", description: "Quantidade contratada" },
                        unidade: { type: "string", description: "Unidade de medida" },
                        valor_unitario: { type: "number", description: "Valor unitário em reais" },
                        valor_total: { type: "number", description: "Valor total do item em reais" },
                      },
                      required: ["descricao"],
                      additionalProperties: false,
                    }
                  }
                },
                required: ["numero_contrato", "objeto", "orgao_contratante"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extrair_contrato" } },
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
    console.error("extrair-contrato-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
