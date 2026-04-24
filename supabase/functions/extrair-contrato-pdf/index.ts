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
  numero_lote?: string | null;
  descricao_lote?: string | null;
};

type DadosContrato = {
  // Detecção automática do tipo de documento
  tipo_documento_detectado?: "ata_srp" | "contrato" | "aditivo" | "outro" | null;
  // Detecção automática da estrutura (itens individuais ou lotes agrupados)
  tipo_estrutura_detectado?: "itens" | "lotes" | null;
  tipo_estrutura_confianca?: number | string | null;
  tipo_estrutura_justificativa?: string | null;
  numero_contrato?: string | null;
  numero_ata?: string | null;
  objeto?: string | null;
  orgao_contratante?: string | null;
  valor_global?: number | string | null;
  data_assinatura?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  vigencia_meses?: number | string | null;
  validade_ata_meses?: number | string | null;
  modalidade?: string | null;
  uf?: string | null;
  municipio?: string | null;
  fiscal_nome?: string | null;
  fiscal_email?: string | null;
  fiscal_telefone?: string | null;
  observacoes?: string | null;
  itens?: ItemExtraido[] | null;
  // Campos quando é aditivo
  aditivo?: {
    numero_aditivo?: string | null;
    tipo_aditivo?: "valor" | "quantidade" | "valor_quantidade" | "prazo" | "escopo" | null;
    valor_acrescimo?: number | string | null;
    valor_supressao?: number | string | null;
    quantidade_acrescimo?: number | string | null;
    quantidade_supressao?: number | string | null;
    nova_data_fim?: string | null;
    contrato_referencia?: string | null;
    ata_referencia?: string | null;
    justificativa?: string | null;
  } | null;
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
    numero_lote: cleanString(item.numero_lote) ?? undefined,
    descricao_lote: cleanString(item.descricao_lote) ?? undefined,
  };
}

function normalizeContrato(data: DadosContrato) {
  const dataAssinatura = normalizeDate(data.data_assinatura);
  const dataInicio = normalizeDate(data.data_inicio);
  const dataFim = normalizeDate(data.data_fim);
  const itens = Array.isArray(data.itens)
    ? data.itens.map(normalizeItem).filter(Boolean)
    : [];

  const aditivo = data.aditivo
    ? {
        numero_aditivo: cleanString(data.aditivo.numero_aditivo),
        tipo_aditivo: (data.aditivo.tipo_aditivo as string | null) ?? null,
        valor_acrescimo: parseNumber(data.aditivo.valor_acrescimo) ?? 0,
        valor_supressao: parseNumber(data.aditivo.valor_supressao) ?? 0,
        quantidade_acrescimo: parseNumber(data.aditivo.quantidade_acrescimo) ?? 0,
        quantidade_supressao: parseNumber(data.aditivo.quantidade_supressao) ?? 0,
        nova_data_fim: normalizeDate(data.aditivo.nova_data_fim),
        contrato_referencia: cleanString(data.aditivo.contrato_referencia),
        ata_referencia: cleanString(data.aditivo.ata_referencia),
        justificativa: cleanString(data.aditivo.justificativa),
      }
    : null;

  return {
    tipo_documento_detectado: (data.tipo_documento_detectado as string | null) ?? null,
    tipo_estrutura_detectado: (data.tipo_estrutura_detectado as string | null) ?? null,
    tipo_estrutura_confianca: parseNumber(data.tipo_estrutura_confianca),
    tipo_estrutura_justificativa: cleanString(data.tipo_estrutura_justificativa),
    numero_contrato: cleanString(data.numero_contrato),
    numero_ata: cleanString(data.numero_ata),
    objeto: cleanString(data.objeto),
    orgao_contratante: cleanString(data.orgao_contratante),
    valor_global: parseNumber(data.valor_global),
    data_assinatura: dataAssinatura,
    data_inicio: dataInicio,
    data_fim: dataFim,
    vigencia_meses: parseNumber(data.vigencia_meses) ?? diffMonths(dataInicio, dataFim),
    validade_ata_meses: parseNumber(data.validade_ata_meses),
    modalidade: cleanString(data.modalidade),
    uf: cleanString(data.uf)?.toUpperCase() ?? null,
    municipio: cleanString(data.municipio),
    fiscal_nome: cleanString(data.fiscal_nome),
    fiscal_email: cleanString(data.fiscal_email),
    fiscal_telefone: cleanString(data.fiscal_telefone),
    observacoes: cleanString(data.observacoes),
    itens,
    aditivo,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto_pdf, nome_arquivo, tipo_arquivo, tipo_estrutura } = await req.json();
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
              "Você é um extrator técnico de documentos públicos brasileiros (Contratos Administrativos, ATAs de Registro de Preços e Termos Aditivos). Extraia SOMENTE informações que aparecem literalmente no documento. Não invente, não estime, não complete lacunas. Se um campo não estiver explícito, retorne null. Preserve a descrição real dos itens exatamente como no documento. SEMPRE classifique o tipo de documento em tipo_documento_detectado: 'ata_srp' (ATA de Registro de Preços/SRP), 'contrato' (contrato administrativo de execução), 'aditivo' (Termo Aditivo de prazo, valor, quantidade ou escopo) ou 'outro'. Quando o documento for um aditivo, preencha o objeto 'aditivo' com os campos correspondentes (acréscimos, supressões, nova data fim, justificativa, número do contrato/ata referenciado).",
          },
          {
            role: "user",
            content: `Arquivo: ${nome_arquivo || "documento"}\nDica do usuário sobre o tipo: ${tipo_arquivo || "desconhecido"}\nEstrutura informada pelo usuário: ${tipo_estrutura === "lotes" ? "LOTES (itens agrupados em lotes numerados)" : "ITENS individuais"}\n\nClassifique o tipo do documento e extraia os dados pertinentes ao seu tipo:\n\n1) Se for ATA SRP → preencha numero_ata, objeto, orgao, valor_global, validade_ata_meses, vigência, itens.\n2) Se for Contrato → preencha numero_contrato, objeto, valor_global, vigência, itens.\n3) Se for Aditivo → preencha o objeto 'aditivo' com tipo (valor, quantidade, prazo, escopo, valor_quantidade), valor_acrescimo, valor_supressao, quantidade_acrescimo, quantidade_supressao, nova_data_fim, contrato_referencia ou ata_referencia, justificativa.\n\n${tipo_estrutura === "lotes" ? "ATENÇÃO LOTES: O documento está organizado por LOTES. Para CADA item retornado, preencha OBRIGATORIAMENTE 'numero_lote' (ex: '01', '02') e, quando existir, 'descricao_lote' (ex: 'Materiais de Limpeza'). Itens do mesmo lote devem compartilhar o mesmo numero_lote.\n" : ""}REGRAS CRÍTICAS:\n- NÃO invente campos\n- NÃO reescreva descrições com sinônimos\n- Use null quando o campo não existir\n- Datas no formato DD/MM/AAAA ou YYYY-MM-DD\n\nTEXTO DO DOCUMENTO:\n${truncated}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extrair_contrato",
              description: "Extrai dados estruturados de contratos, ATAs SRP ou termos aditivos brasileiros, classificando primeiro o tipo do documento.",
              parameters: {
                type: "object",
                properties: {
                  tipo_documento_detectado: { type: "string", enum: ["ata_srp", "contrato", "aditivo", "outro"], description: "Classificação do documento" },
                  numero_contrato: { type: "string", description: "Número do contrato (apenas para contratos)" },
                  numero_ata: { type: "string", description: "Número da ATA SRP (apenas para ATAs)" },
                  objeto: { type: "string", description: "Objeto exatamente como no documento" },
                  orgao_contratante: { type: "string", description: "Órgão contratante" },
                  valor_global: { type: "number", description: "Valor global em reais" },
                  data_assinatura: { type: "string", description: "Data de assinatura" },
                  data_inicio: { type: "string", description: "Início da vigência" },
                  data_fim: { type: "string", description: "Fim da vigência" },
                  vigencia_meses: { type: "number", description: "Vigência em meses, se explícita" },
                  validade_ata_meses: { type: "number", description: "Validade da ATA SRP em meses (geralmente 12)" },
                  modalidade: { type: "string" },
                  uf: { type: "string" },
                  municipio: { type: "string" },
                  fiscal_nome: { type: "string" },
                  fiscal_email: { type: "string" },
                  fiscal_telefone: { type: "string" },
                  observacoes: { type: "string" },
                  itens: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        codigo_item: { type: "string" },
                        descricao: { type: "string" },
                        quantidade: { type: "number" },
                        unidade: { type: "string" },
                        valor_unitario: { type: "number" },
                        valor_total: { type: "number" },
                        numero_lote: { type: "string", description: "Número/identificador do lote ao qual o item pertence (somente quando o documento é estruturado por LOTES)." },
                        descricao_lote: { type: "string", description: "Descrição/título do lote, quando informado." },
                      },
                      additionalProperties: false,
                    },
                  },
                  aditivo: {
                    type: "object",
                    description: "Dados do termo aditivo, quando aplicável",
                    properties: {
                      numero_aditivo: { type: "string", description: "Ex: 1º Termo Aditivo" },
                      tipo_aditivo: { type: "string", enum: ["valor", "quantidade", "valor_quantidade", "prazo", "escopo"] },
                      valor_acrescimo: { type: "number" },
                      valor_supressao: { type: "number" },
                      quantidade_acrescimo: { type: "number" },
                      quantidade_supressao: { type: "number" },
                      nova_data_fim: { type: "string" },
                      contrato_referencia: { type: "string", description: "Número do contrato que está sendo aditado" },
                      ata_referencia: { type: "string", description: "Número da ATA que está sendo aditada" },
                      justificativa: { type: "string" },
                    },
                    additionalProperties: false,
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
