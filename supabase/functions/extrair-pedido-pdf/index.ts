import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto_pdf, tipo_documento, images } = await req.json();

    const hasText = texto_pdf && texto_pdf.trim().length >= 30;
    const hasImages = Array.isArray(images) && images.length > 0;

    if (!hasText && !hasImages) {
      return new Response(JSON.stringify({ error: "Texto do documento muito curto ou vazio. Se o PDF for escaneado, o sistema tentará via visão automáticamente." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const tipoLabel = tipo_documento || "Ordem de Fornecimento / Empenho / PRD";
    const systemContent = `Você é um especialista em documentos de licitações e contratos públicos brasileiros. Extraia TODAS as informações de pedidos/ordens de fornecimento, notas de empenho, PRDs e documentos similares. A ESPÉCIE do empenho (ordinário, global ou estimativo) é um campo ROTULADO na nota — leia o rótulo, não deduza pelo conteúdo; sem rótulo, devolva null. Itens divididos em COTA PRINCIPAL e COTA RESERVADA (LC 123/2006) devem vir como linhas separadas, cada uma com a sua cota marcada. Identifique o tipo de documento, número, data, itens com descrição completa, quantidades, unidades, valores unitários e totais. Se houver múltiplos itens numa tabela, extraia CADA linha. Se uma informação não estiver disponível, retorne null.`;

    // Build user message — text or vision
    let userContent: any;
    if (hasImages) {
      // PDF escaneado: usa visão (gpt-4o)
      userContent = [
        { type: "text", text: `Extraia TODAS as informações deste documento (${tipoLabel}). Retorne os dados via tool call 'extrair_pedido'.` },
        ...images.slice(0, 5).map((img: any) => ({
          type: "image_url",
          image_url: { url: img.dataUrl ?? img, detail: "high" },
        })),
      ];
    } else {
      const truncated = texto_pdf.slice(0, 60000);
      userContent = `Extraia TODAS as informações deste documento (${tipoLabel}):\n\n${truncated}`;
    }

    const model = hasImages ? "gpt-4o" : "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
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
                    description: "Que documento é este: ordem_fornecimento, nota_empenho, prd, outro"
                  },

                  // A ESPÉCIE do empenho é campo rotulado no documento — não
                  // se infere do texto. Pedir a classificação junto com o tipo
                  // do documento misturava duas perguntas; separadas, cada uma
                  // tem uma resposta que está escrita.
                  especie_empenho: {
                    type: "string",
                    enum: ["ordinario", "global", "estimativo"],
                    description: "A ESPÉCIE do empenho, quando o documento for nota de empenho. Procure o campo rotulado — costuma aparecer como 'ESPÉCIE DE EMPENHO', 'TIPO DE EMPENHO' ou 'MODALIDADE DE EMPENHO', e o valor é uma das três palavras. NÃO deduza pelo conteúdo: se o rótulo não estiver no documento, devolva null e deixe quem tem a nota decidir.",
                  },
                  especie_empenho_texto: {
                    type: "string",
                    description: "O trecho LITERAL onde a espécie aparece, com o rótulo. É o que permite conferir a leitura sem reabrir o PDF.",
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
                        // Divisão do art. 48, III da LC 123/2006: até 25% do
                        // objeto reservado a ME/EPP/MEI. O empenho traz as duas
                        // cotas em linhas separadas, e os saldos delas correm
                        // independentes.
                        cota: {
                          type: "string",
                          enum: ["principal", "reservada"],
                          description: "Se a linha for de cota, qual delas. Procure 'COTA PRINCIPAL' / 'COTA RESERVADA' (ou 'AMPLA CONCORRÊNCIA' / 'EXCLUSIVA ME/EPP') na descrição do item ou no cabeçalho do lote. Null quando o item não for dividido.",
                        },
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
