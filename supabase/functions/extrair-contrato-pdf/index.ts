import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ItemExtraido = {
  codigo_item?: string | null;
  descricao?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
  valor_unitario?: number | string | null;
  valor_total?: number | string | null;
};

type DadosContrato = {
  numero_contrato?: string | null;
  objeto?: string | null;
  orgao_contratante?: string | null;
  valor_global?: number | string | null;
  data_assinatura?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  vigencia_meses?: number | string | null;
  modalidade?: string | null;
  uf?: string | null;
  municipio?: string | null;
  fiscal_nome?: string | null;
  fiscal_email?: string | null;
  fiscal_telefone?: string | null;
  observacoes?: string | null;
  itens?: ItemExtraido[] | null;
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

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const altMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (altMatch) {
    const [, day, month, year] = altMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function diffMonths(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

  const years = endDate.getFullYear() - startDate.getFullYear();
  const months = endDate.getMonth() - startDate.getMonth();
  const totalMonths = years * 12 + months;
  return totalMonths >= 0 ? totalMonths : null;
}

function normalizeItem(item: ItemExtraido, index: number) {
  const descricao = cleanString(item.descricao);
  if (!descricao) return null;

  const quantidade = parseNumber(item.quantidade);
  const valorUnitario = parseNumber(item.valor_unitario);
  const valorTotalOriginal = parseNumber(item.valor_total);
  const valorTotal = valorTotalOriginal ?? (quantidade != null && valorUnitario != null ? quantidade * valorUnitario : null);

  return {
    codigo_item: cleanString(item.codigo_item) ?? String(index + 1),
    descricao,
    quantidade: quantidade ?? undefined,
    unidade: cleanString(item.unidade) ?? undefined,
    valor_unitario: valorUnitario ?? undefined,
    valor_total: valorTotal ?? undefined,
  };
}

function normalizeContrato(data: DadosContrato) {
  const dataAssinatura = normalizeDate(data.data_assinatura);
  const dataInicio = normalizeDate(data.data_inicio);
  const dataFim = normalizeDate(data.data_fim);
  const itens = Array.isArray(data.itens)
    ? data.itens.map(normalizeItem).filter(Boolean)
    : [];

  return {
    numero_contrato: cleanString(data.numero_contrato),
    objeto: cleanString(data.objeto),
    orgao_contratante: cleanString(data.orgao_contratante),
    valor_global: parseNumber(data.valor_global),
    data_assinatura: dataAssinatura,
    data_inicio: dataInicio,
    data_fim: dataFim,
    vigencia_meses: parseNumber(data.vigencia_meses) ?? diffMonths(dataInicio, dataFim),
    modalidade: cleanString(data.modalidade),
    uf: cleanString(data.uf)?.toUpperCase() ?? null,
    municipio: cleanString(data.municipio),
    fiscal_nome: cleanString(data.fiscal_nome),
    fiscal_email: cleanString(data.fiscal_email),
    fiscal_telefone: cleanString(data.fiscal_telefone),
    observacoes: cleanString(data.observacoes),
    itens,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto_pdf, nome_arquivo, tipo_arquivo } = await req.json();
    if (!texto_pdf || texto_pdf.trim().length < 80) {
      return new Response(JSON.stringify({ success: false, error: "Texto do documento muito curto ou vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncated = texto_pdf.slice(0, 90000);

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
            content:
              "Você é um extrator técnico de contratos públicos brasileiros. Extraia SOMENTE informações que aparecem literalmente no documento. Não invente, não estime, não complete lacunas. Se um campo não estiver explícito, retorne null. Preserve a descrição real dos itens exatamente como no contrato. Extraia TODOS os itens da tabela/planilha, incluindo código, descrição, quantidade, unidade, valor unitário e valor total quando existirem.",
          },
          {
            role: "user",
            content: `Arquivo: ${nome_arquivo || "documento"}\nTipo: ${tipo_arquivo || "desconhecido"}\n\nExtraia do contrato abaixo, com fidelidade documental:\n- número do contrato\n- órgão contratante\n- objeto\n- valor global\n- data de assinatura\n- data de início da vigência\n- data final da vigência\n- vigência em meses, se estiver explícita\n- modalidade\n- UF e município\n- dados do fiscal\n- observações relevantes\n- TODOS os itens com descrição literal, quantidade, unidade, valor unitário e valor total\n\nREGRAS CRÍTICAS:\n- NÃO invente campos obrigatórios\n- NÃO reescreva descrições com sinônimos\n- NÃO crie itens que não existam\n- Se houver tabela, extraia linha a linha\n- Se um valor não existir, use null\n\nTEXTO DO CONTRATO:\n${truncated}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_contrato",
              description: "Extrai dados estruturados de um contrato público brasileiro com fidelidade documental",
              parameters: {
                type: "object",
                properties: {
                  numero_contrato: { type: "string", description: "Número do contrato exatamente como no documento" },
                  objeto: { type: "string", description: "Objeto do contrato exatamente como no documento" },
                  orgao_contratante: { type: "string", description: "Órgão contratante" },
                  valor_global: { type: "number", description: "Valor global do contrato em reais" },
                  data_assinatura: { type: "string", description: "Data de assinatura no formato DD/MM/AAAA ou YYYY-MM-DD" },
                  data_inicio: { type: "string", description: "Data de início da vigência no formato DD/MM/AAAA ou YYYY-MM-DD" },
                  data_fim: { type: "string", description: "Data final da vigência no formato DD/MM/AAAA ou YYYY-MM-DD" },
                  vigencia_meses: { type: "number", description: "Quantidade de meses de vigência se explícita" },
                  modalidade: { type: "string", description: "Modalidade da contratação" },
                  uf: { type: "string", description: "UF do órgão contratante" },
                  municipio: { type: "string", description: "Município do órgão contratante" },
                  fiscal_nome: { type: "string", description: "Nome do fiscal do contrato" },
                  fiscal_email: { type: "string", description: "Email do fiscal do contrato" },
                  fiscal_telefone: { type: "string", description: "Telefone do fiscal do contrato" },
                  observacoes: { type: "string", description: "Cláusulas ou observações relevantes" },
                  itens: {
                    type: "array",
                    description: "Itens do contrato extraídos linha a linha da tabela ou planilha",
                    items: {
                      type: "object",
                      properties: {
                        codigo_item: { type: "string", description: "Código, número ou sequência do item" },
                        descricao: { type: "string", description: "Descrição literal do item" },
                        quantidade: { type: "number", description: "Quantidade contratada" },
                        unidade: { type: "string", description: "Unidade de medida" },
                        valor_unitario: { type: "number", description: "Valor unitário em reais" },
                        valor_total: { type: "number", description: "Valor total do item em reais" },
                      },
                      additionalProperties: false,
                    },
                  },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extrair_contrato" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Limite de requisições excedido, tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const extracted = normalizeContrato(JSON.parse(toolCall.function.arguments));

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extrair-contrato-pdf error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
