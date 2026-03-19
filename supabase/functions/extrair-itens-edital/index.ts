const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ItemEdital = {
  item?: string | number | null;
  descricao?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
  valor_unitario?: number | string | null;
  valor_total?: number | string | null;
  lote?: string | null;
  marca?: string | null;
  fabricante?: string | null;
  modelo?: string | null;
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const cleaned = value
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeItem(item: ItemEdital, index: number) {
  const descricao = cleanString(item.descricao);
  if (!descricao) return null;

  const quantidade = parseNumber(item.quantidade);
  const valorUnitario = parseNumber(item.valor_unitario);
  const valorTotalOriginal = parseNumber(item.valor_total);
  const valorTotal = valorTotalOriginal ?? (quantidade != null && valorUnitario != null ? quantidade * valorUnitario : null);
  const numero = cleanString(String(item.item ?? "")) ?? String(index + 1);

  return {
    item: numero,
    descricao,
    quantidade: quantidade ?? 1,
    unidade: cleanString(item.unidade) ?? "UN",
    valor_unitario: valorUnitario ?? 0,
    valor_total: valorTotal ?? 0,
    lote: cleanString(item.lote) ?? "Único",
    marca: cleanString(item.marca),
    fabricante: cleanString(item.fabricante),
    modelo: cleanString(item.modelo),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texto_edital } = await req.json();

    if (!texto_edital || typeof texto_edital !== "string" || texto_edital.trim().length < 500) {
      return new Response(JSON.stringify({ success: false, error: "Texto do edital muito curto ou ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncated = texto_edital.slice(0, 120000);

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
            content: "Você é um extrator técnico de itens de editais e termos de referência. Extraia SOMENTE itens que aparecem literalmente no texto. Nunca invente, nunca complete lacunas, nunca substitua um produto por outro semelhante. Preserve rigorosamente a ordem original do documento e a descrição fiel de cada item.",
          },
          {
            role: "user",
            content: `Extraia TODOS os itens/lotes do documento abaixo em formato estruturado.\n\nREGRAS CRÍTICAS:\n- Extraia do primeiro ao último item, sem interromper a lista no meio\n- Mantenha a mesma ordem do documento\n- Copie a descrição literalmente\n- Se quantidade, unidade, lote, marca, fabricante, modelo ou valores não aparecerem, use null\n- Se o documento não tiver lista de itens suficiente para extração fiel, retorne um array vazio\n- Não use markdown, não explique nada, apenas preencha a chamada da função\n\nTEXTO DO EDITAL:\n${truncated}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_itens_edital",
              description: "Extrai itens estruturados de um edital ou termo de referência com fidelidade documental",
              parameters: {
                type: "object",
                properties: {
                  itens: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        item: { type: ["string", "number", "null"] },
                        descricao: { type: ["string", "null"] },
                        quantidade: { type: ["number", "string", "null"] },
                        unidade: { type: ["string", "null"] },
                        valor_unitario: { type: ["number", "string", "null"] },
                        valor_total: { type: ["number", "string", "null"] },
                        lote: { type: ["string", "null"] },
                        marca: { type: ["string", "null"] },
                        fabricante: { type: ["string", "null"] },
                        modelo: { type: ["string", "null"] },
                      },
                      additionalProperties: false,
                    },
                  },
                },
                required: ["itens"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_itens_edital" } },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("extrair-itens-edital gateway error:", response.status, body);
      return new Response(JSON.stringify({ success: false, error: "Erro no serviço de IA" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const itens = Array.isArray(parsed?.itens)
      ? parsed.itens.map(normalizeItem).filter(Boolean)
      : [];

    return new Response(JSON.stringify({ success: true, data: itens }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extrair-itens-edital error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
