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

// Parse PNCP numero_controle format: {CNPJ}-{SEQ}-{NUM}/{ANO}
function parsePNCPNumeroControle(nc: string): { cnpj: string; seq: number; ano: number } | null {
  if (!nc) return null;
  const match = nc.replace(/\s/g, "").match(/^(\d{14})-(\d+)-\d+\/(\d{4})$/);
  if (!match) return null;
  return { cnpj: match[1], seq: parseInt(match[2]), ano: parseInt(match[3]) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { texto_edital, skip_min_length, numero_controle, orgao_cnpj, ano_compra, sequencial } = body;

    // ══════════════════════════════════════════════
    // CAMADA 1: API PNCP de itens (dados estruturados)
    // ══════════════════════════════════════════════
    let cnpj = orgao_cnpj;
    let ano = ano_compra;
    let seq = sequencial;

    if (numero_controle && !cnpj) {
      const parsed = parsePNCPNumeroControle(numero_controle);
      if (parsed) {
        cnpj = parsed.cnpj;
        seq = parsed.seq;
        ano = parsed.ano;
      }
    }

    if (cnpj && ano && seq) {
      const urlItens = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1&tamanhoPagina=500`;
      console.log("[extrair-itens] CAMADA 1 - Consultando PNCP API:", urlItens);

      try {
        const respItens = await fetch(urlItens, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(10000),
        });

        if (respItens.ok) {
          const dataItens = await respItens.json();
          const itensPNCP: any[] = dataItens?.data ?? (Array.isArray(dataItens) ? dataItens : []);

          if (itensPNCP.length > 0) {
            console.log(`[extrair-itens] PNCP retornou ${itensPNCP.length} itens`);

            const itens = itensPNCP.map((item: any, idx: number) => ({
              item: item.numeroItem ?? idx + 1,
              descricao: item.descricao ?? item.descricaoItem ?? "",
              quantidade: Number(item.quantidade ?? 1),
              unidade: item.unidadeMedida ?? item.unidade ?? "UN",
              valor_unitario: Number(item.valorUnitarioEstimado ?? item.valorUnitario ?? 0),
              valor_total: Number(item.valorTotal ?? 0) || Number(item.quantidade ?? 0) * Number(item.valorUnitarioEstimado ?? 0),
              lote: item.lote ? String(item.lote) : "Único",
              marca: item.marcaFabricante ?? null,
              fabricante: item.nomeMarketing ?? null,
              modelo: null,
              catmat: item.codigoCatmat ?? null,
              criterio_julgamento: item.criterioJulgamentoNome ?? null,
              beneficio: item.tipoBeneficioNome ?? null,
              situacao: item.situacaoCompraItemNome ?? null,
            })).filter((i: any) => i.descricao && i.descricao.trim().length > 0);

            return new Response(JSON.stringify({
              success: true,
              data: itens,
              total: itens.length,
              fonte: "PNCP_API",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.warn("[extrair-itens] PNCP API falhou:", String(e));
      }
    }

    // ══════════════════════════════════════════════
    // CAMADA 2: Extração via IA do texto do edital
    // ══════════════════════════════════════════════

    // If we have PNCP params but no texto_edital, try downloading the PDF from PNCP archives
    let textoParaIA = texto_edital;

    if ((!textoParaIA || textoParaIA.trim().length < 50) && cnpj && ano && seq) {
      console.log("[extrair-itens] CAMADA 2 - Tentando buscar arquivos PNCP para fallback IA...");
      const urlArquivos = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos?pagina=1&tamanhoPagina=20`;

      try {
        const respArq = await fetch(urlArquivos, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });

        if (respArq.ok) {
          const dataArq = await respArq.json();
          const arquivos: any[] = dataArq?.data ?? (Array.isArray(dataArq) ? dataArq : []);

          // Find the edital document
          const editalArq = arquivos.find((a: any) =>
            (a.titulo ?? "").toLowerCase().includes("edital") ||
            (a.tipoDocumentoNome ?? "").toLowerCase().includes("edital") ||
            (a.tipoDocumentoDescricao ?? "").toLowerCase().includes("edital")
          ) ?? arquivos.find((a: any) =>
            (a.titulo ?? "").toLowerCase().includes("termo") ||
            (a.tipoDocumentoNome ?? "").toLowerCase().includes("termo")
          ) ?? arquivos[0];

          const pdfUrl = editalArq?.url ?? editalArq?.uri ?? null;

          if (pdfUrl) {
            console.log("[extrair-itens] PDF encontrado:", pdfUrl);
            // We can't read PDFs in Deno easily, so we return info for the client
            return new Response(JSON.stringify({
              success: false,
              data: [],
              total: 0,
              fonte: "manual",
              pdf_url: pdfUrl,
              mensagem: "Itens não disponíveis via API. O PDF do edital está disponível para extração manual ou upload.",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.warn("[extrair-itens] Busca de arquivos PNCP falhou:", String(e));
      }
    }

    // If we have text, do AI extraction
    if (!textoParaIA || typeof textoParaIA !== "string" || textoParaIA.trim().length < (skip_min_length ? 50 : 500)) {
      return new Response(JSON.stringify({
        success: false,
        data: [],
        error: "Texto do edital muito curto ou ausente",
        fonte: "manual",
        mensagem: "Não foi possível obter dados estruturados. Preencha manualmente.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const truncated = textoParaIA.slice(0, 120000);

    console.log("[extrair-itens] CAMADA 2 - Extraindo via IA...");

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
      const errorBody = await response.text();
      console.error("extrair-itens-edital gateway error:", response.status, errorBody);
      return new Response(JSON.stringify({ success: false, error: "Erro no serviço de IA", fonte: "erro" }), {
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

    return new Response(JSON.stringify({
      success: true,
      data: itens,
      total: itens.length,
      fonte: "IA",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extrair-itens-edital error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      fonte: "erro",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
