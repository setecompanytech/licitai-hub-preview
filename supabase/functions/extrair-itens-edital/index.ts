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

// Extract JSON from AI response - handles both tool_calls and content responses
function extractItensFromAIResponse(result: any): ItemEdital[] {
  // Try tool_calls first
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(parsed?.itens)) {
        console.log(`[extrair-itens] Parsed ${parsed.itens.length} itens from tool_calls`);
        return parsed.itens;
      }
    } catch (e) {
      console.warn("[extrair-itens] Failed to parse tool_calls arguments:", String(e));
    }
  }

  // Fallback: try content (text response with JSON)
  const content = result.choices?.[0]?.message?.content;
  if (content && typeof content === "string") {
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed?.itens)) {
          console.log(`[extrair-itens] Parsed ${parsed.itens.length} itens from content`);
          return parsed.itens;
        }
      }
      // Try as array directly
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) {
          console.log(`[extrair-itens] Parsed ${arr.length} itens from content array`);
          return arr;
        }
      }
    } catch (e) {
      console.warn("[extrair-itens] Failed to parse content as JSON:", String(e));
    }
  }

  console.warn("[extrair-itens] No itens found in AI response");
  return [];
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
          signal: AbortSignal.timeout(15000),
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
            // Try to download and use Gemini Vision to read PDF
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (LOVABLE_API_KEY) {
              try {
                console.log("[extrair-itens] Tentando ler PDF via Gemini Vision...");
                const pdfResp = await fetch(pdfUrl, {
                  signal: AbortSignal.timeout(20000),
                });
                
                if (pdfResp.ok) {
                  const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
                  const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
                  
                  // Use Gemini to extract text from PDF
                  const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${LOVABLE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [
                        {
                          role: "user",
                          content: [
                            {
                              type: "text",
                              text: `Extraia TODOS os itens/lotes deste edital de licitação. Para cada item retorne: numero_item, descricao, quantidade, unidade, valor_unitario, valor_total, lote, marca. Retorne APENAS JSON válido no formato: {"itens": [...]}. Se não encontrar itens, retorne {"itens": []}.`,
                            },
                            {
                              type: "image_url",
                              image_url: {
                                url: `data:application/pdf;base64,${base64Pdf}`,
                              },
                            },
                          ],
                        },
                      ],
                    }),
                  });

                  if (visionResp.ok) {
                    const visionData = await visionResp.json();
                    const visionContent = visionData.choices?.[0]?.message?.content || "";
                    const jsonClean = visionContent.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
                    const jsonMatch = jsonClean.match(/\{[\s\S]*\}/);
                    
                    if (jsonMatch) {
                      const parsed = JSON.parse(jsonMatch[0]);
                      const rawItens: any[] = parsed?.itens || [];
                      
                      if (rawItens.length > 0) {
                        const itens = rawItens.map((item: any, idx: number) => {
                          return normalizeItem({
                            item: item.numero_item ?? item.item ?? idx + 1,
                            descricao: item.descricao,
                            quantidade: item.quantidade,
                            unidade: item.unidade_medida ?? item.unidade,
                            valor_unitario: item.valor_unitario,
                            valor_total: item.valor_total,
                            lote: item.lote,
                            marca: item.marca,
                            fabricante: item.fabricante,
                            modelo: item.modelo,
                          }, idx);
                        }).filter(Boolean);

                        if (itens.length > 0) {
                          console.log(`[extrair-itens] Gemini Vision extraiu ${itens.length} itens do PDF`);
                          return new Response(JSON.stringify({
                            success: true,
                            data: itens,
                            total: itens.length,
                            fonte: "IA_VISION",
                          }), {
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                          });
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn("[extrair-itens] Gemini Vision falhou:", String(e));
              }
            }

            // If Vision failed, return pdf_url for client-side fallback
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

    console.log("[extrair-itens] CAMADA 2 - Extraindo via IA (texto)..., comprimento:", truncated.length);

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
            content: `Você é um extrator técnico de itens de editais e termos de referência de licitações públicas brasileiras.
Extraia SOMENTE itens que aparecem literalmente no texto. Nunca invente dados.
Preserve rigorosamente a ordem original e a descrição fiel de cada item.

IMPORTANTE: Retorne APENAS um JSON válido no formato abaixo, sem markdown, sem explicações:
{
  "itens": [
    {
      "item": 1,
      "descricao": "descrição completa do item",
      "quantidade": 100,
      "unidade": "UN",
      "valor_unitario": 25.00,
      "valor_total": 2500.00,
      "lote": "Único",
      "marca": null,
      "fabricante": null,
      "modelo": null
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Extraia TODOS os itens/lotes do documento abaixo.

REGRAS:
- Extraia do primeiro ao último item, sem interromper a lista
- Copie a descrição literalmente
- Se quantidade, unidade, lote, marca, fabricante, modelo ou valores não aparecerem, use null
- Se o documento não tiver itens, retorne {"itens": []}

TEXTO DO EDITAL:
${truncated}`,
          },
        ],
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
    const rawItens = extractItensFromAIResponse(result);

    const itens = rawItens
      .map((item: ItemEdital, idx: number) => normalizeItem(item, idx))
      .filter(Boolean);

    console.log(`[extrair-itens] IA retornou ${rawItens.length} itens brutos, ${itens.length} normalizados`);

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
