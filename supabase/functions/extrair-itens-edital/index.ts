import { chamarClaude, parsearJson, arrayParaBase64 } from "../_shared/claude-client.ts";

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

// ── VALIDADOR DE ITENS ──────────────────────────────────────
function validarItens(itens: any[]): any[] {
  return itens.map((item) => {
    const erros: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    // Campo obrigatório: descrição
    if (!item.descricao || String(item.descricao).length < 5) {
      erros.push("Descrição ausente ou muito curta");
      score -= 0.4;
    }

    // Campo obrigatório: quantidade
    const qtd = item.quantidade;
    if (qtd == null) {
      erros.push("Quantidade ausente");
      score -= 0.3;
    } else if (typeof qtd !== "number" || qtd <= 0) {
      erros.push(`Quantidade inválida: ${qtd}`);
      score -= 0.3;
    }

    // Campo obrigatório: unidade
    if (!item.unidade) {
      warnings.push("Unidade de medida ausente");
      score -= 0.1;
    }

    // Validação matemática: qtd × vlr_unit ≈ vlr_total
    const vlrUnit = item.valor_unitario;
    const vlrTotal = item.valor_total;
    if (vlrUnit && vlrTotal && qtd) {
      try {
        const calculado = Number(qtd) * Number(vlrUnit);
        const total = Number(vlrTotal);
        if (total > 0) {
          const desvio = Math.abs(calculado - total) / total;
          if (desvio > 0.05) {
            warnings.push(
              `Math: ${qtd} × R$${Number(vlrUnit).toFixed(2)} = R$${calculado.toFixed(2)} ≠ R$${Number(vlrTotal).toFixed(2)} (desvio ${(desvio * 100).toFixed(1)}%)`
            );
            score -= 0.2;
          }
        }
      } catch {}
    }

    // Verificar número do item
    if (item.item == null) {
      warnings.push("Número do item ausente");
      score -= 0.05;
    }

    return {
      ...item,
      confidence_score: Math.max(0, Math.round(score * 100) / 100),
      erros,
      warnings,
      requer_revisao: erros.length > 0 || score < 0.7,
    };
  });
}

// ── VALIDAÇÃO ANTI-ALUCINAÇÃO ──────────────────────────────
// Confere se as descrições extraídas têm respaldo no texto-fonte.
// Itens cujas palavras-chave NÃO aparecem no texto são descartados
// (provável invenção da IA — ex: "impressora" num edital de limpeza).
function filtrarAlucinacoes(itens: any[], textoFonte?: string): any[] {
  if (!textoFonte || textoFonte.length < 100) return itens;
  const fonteNorm = textoFonte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const STOPWORDS = new Set([
    "de","do","da","dos","das","e","ou","com","sem","para","por","em","no","na","nos","nas",
    "a","o","as","os","um","uma","uns","umas","ao","aos","à","às","que","se","item","lote",
    "unidade","unidades","un","kg","peca","pecas","cor","tipo","modelo","marca","ref","cm","mm",
  ]);

  return itens.filter((item: any) => {
    const desc = String(item.descricao || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const tokens = desc
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
    if (tokens.length === 0) return true; // sem tokens significativos → mantém
    const presentes = tokens.filter((t) => fonteNorm.includes(t));
    const ratio = presentes.length / tokens.length;
    if (ratio < 0.4) {
      console.warn(`[anti-alucinação] DESCARTADO (ratio=${ratio.toFixed(2)}): "${item.descricao}"`);
      return false;
    }
    return true;
  });
}

function buildSuccessResponse(itens: any[], fonte: string, textoFonte?: string) {
  const itensFiltrados = filtrarAlucinacoes(itens, textoFonte);
  const validados = validarItens(itensFiltrados);
  const total = validados.length;
  const comErro = validados.filter((i: any) => i.erros?.length > 0).length;
  const confiancaMedia = total > 0
    ? validados.reduce((acc: number, i: any) => acc + (i.confidence_score || 0), 0) / total
    : 0;

  return new Response(JSON.stringify({
    success: true,
    data: validados,
    total,
    fonte,
    meta: {
      confianca_media: Math.round(confiancaMedia * 100) / 100,
      itens_com_erro: comErro,
      requer_revisao: comErro > 0 || confiancaMedia < 0.8,
    },
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function parsePNCPNumeroControle(nc: string): { cnpj: string; seq: number; ano: number } | null {
  if (!nc) return null;
  const match = nc.replace(/\s/g, "").match(/^(\d{14})-(\d+)-\d+\/(\d{4})$/);
  if (!match) return null;
  return { cnpj: match[1], seq: parseInt(match[2]), ano: parseInt(match[3]) };
}

// Extract JSON from AI response - handles both tool_calls and content responses
function extractItensFromAIResponse(result: any): ItemEdital[] {
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(parsed?.itens)) return parsed.itens;
    } catch {}
  }
  const content = result.choices?.[0]?.message?.content;
  if (content && typeof content === "string") {
    try {
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed?.itens)) return parsed.itens;
      }
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch {}
  }
  return [];
}

const CLAUDE_SYSTEM_ITENS = `Você é especialista em extração de dados de licitações públicas brasileiras (Lei 14.133/2021 e 8.666/93).

REGRAS DE EXTRAÇÃO — seguir rigorosamente:
1. Extraia TODOS os itens/lotes sem exceção
2. Copie descrições LITERALMENTE — nunca resuma ou altere
3. Preserve especificações técnicas completas (normas, dimensões, composição)
4. Tabelas multi-página: consolide todos os itens em um único array
5. Lotes: extraia cada item individualmente com lote preenchido
6. Valores: use o número exato do documento. null se ausente.
7. CATMAT/CATSER: extraia o código se constar (4-8 dígitos)

Retorne SOMENTE JSON válido — sem markdown, sem texto antes ou depois.`;

const CLAUDE_PROMPT_ITENS = `Leia TODAS as páginas deste documento e extraia os itens de licitação.

Retorne JSON neste formato exato:
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
}

Se não encontrar itens, retorne {"itens": []}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      texto_edital,
      skip_min_length,
      numero_controle,
      orgao_cnpj,
      ano_compra,
      sequencial,
      // Novos parâmetros para PDF nativo
      pdf_base64,
      pdf_url,
    } = body;

    // ══════════════════════════════════════════════
    // CAMADA 0: PDF nativo via Claude (sem conversão)
    // ══════════════════════════════════════════════
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (pdf_base64 && ANTHROPIC_KEY) {
      try {
        const tamanhoMB = (pdf_base64.length * 0.75) / 1024 / 1024;
        console.log(`[extrair-itens] CAMADA 0 - Claude PDF nativo ${tamanhoMB.toFixed(1)}MB`);

        const resposta = await chamarClaude(
          CLAUDE_PROMPT_ITENS,
          { pdfBase64: pdf_base64 },
          { sistema: CLAUDE_SYSTEM_ITENS, maxTokens: 8000, cacheEphemeral: true }
        );

        const dados = parsearJson(resposta);
        const rawItens: any[] = dados?.itens || [];
        const itens = rawItens.map((item: any, idx: number) => normalizeItem(item, idx)).filter(Boolean);

        if (itens.length > 0) {
          console.log(`[extrair-itens] Claude extraiu ${itens.length} itens do PDF`);
          return buildSuccessResponse(itens, "CLAUDE_PDF");
        }
      } catch (e) {
        console.warn("[extrair-itens] Claude PDF falhou:", String(e));
      }
    }

    // Download PDF from URL and try Claude
    if (pdf_url && ANTHROPIC_KEY && !pdf_base64) {
      try {
        const r = await fetch(pdf_url, { signal: AbortSignal.timeout(20000) });
        if (r.ok) {
          const downloadedBase64 = await arrayParaBase64(await r.arrayBuffer());
          const tamanhoMB = (downloadedBase64.length * 0.75) / 1024 / 1024;
          console.log(`[extrair-itens] CAMADA 0 - Claude PDF via URL ${tamanhoMB.toFixed(1)}MB`);

          const resposta = await chamarClaude(
            CLAUDE_PROMPT_ITENS,
            { pdfBase64: downloadedBase64 },
            { sistema: CLAUDE_SYSTEM_ITENS, maxTokens: 8000, cacheEphemeral: true }
          );

          const dados = parsearJson(resposta);
          const rawItens: any[] = dados?.itens || [];
          const itens = rawItens.map((item: any, idx: number) => normalizeItem(item, idx)).filter(Boolean);

          if (itens.length > 0) {
            console.log(`[extrair-itens] Claude extraiu ${itens.length} itens do PDF (URL)`);
            return buildSuccessResponse(itens, "CLAUDE_PDF_URL");
          }
        }
      } catch (e) {
        console.warn("[extrair-itens] Claude PDF URL falhou:", String(e));
      }
    }

    // ══════════════════════════════════════════════
    // CAMADA 1: API PNCP de itens (dados estruturados)
    // ══════════════════════════════════════════════
    let cnpj = orgao_cnpj;
    let ano = ano_compra;
    let seq = sequencial;

    if (numero_controle && !cnpj) {
      const parsed = parsePNCPNumeroControle(numero_controle);
      if (parsed) { cnpj = parsed.cnpj; seq = parsed.seq; ano = parsed.ano; }
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

            return buildSuccessResponse(itens, "PNCP_API");
          }
        }
      } catch (e) {
        console.warn("[extrair-itens] PNCP API falhou:", String(e));
      }
    }

    // ══════════════════════════════════════════════
    // CAMADA 2: Buscar PDF do PNCP → Claude nativo
    // ══════════════════════════════════════════════
    if (cnpj && ano && seq && ANTHROPIC_KEY) {
      console.log("[extrair-itens] CAMADA 2 - Buscando PDF do PNCP para Claude...");
      const pncpPdfBase64 = await buscarPdfPNCP(cnpj, ano, seq);

      if (pncpPdfBase64) {
        console.log(`[extrair-itens] CAMADA 2 - Chamando Claude com PDF (${(pncpPdfBase64.length / 1024).toFixed(0)} KB base64)`);
        try {
          const resposta = await Promise.race([
            chamarClaude(
              CLAUDE_PROMPT_ITENS,
              { pdfBase64: pncpPdfBase64 },
              { sistema: CLAUDE_SYSTEM_ITENS, maxTokens: 8000, cacheEphemeral: true }
            ),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Claude timeout 90s")), 90000)),
          ]);

          const dados = parsearJson(resposta);
          const rawItens: any[] = dados?.itens || [];
          const itens = rawItens.map((item: any, idx: number) => normalizeItem(item, idx)).filter(Boolean);

          if (itens.length > 0) {
            console.log(`[extrair-itens] Claude PNCP PDF extraiu ${itens.length} itens`);
            return buildSuccessResponse(itens, "CLAUDE_PNCP_PDF");
          }
          console.warn(`[extrair-itens] Claude retornou 0 itens válidos`);
        } catch (e) {
          console.warn("[extrair-itens] Claude PNCP PDF falhou:", String(e));
        }
      } else {
        console.warn("[extrair-itens] CAMADA 2 - buscarPdfPNCP retornou null, indo para CAMADA 3");
      }
    }

    // ══════════════════════════════════════════════
    // CAMADA 3: Extração via Gemini (texto puro) — fallback
    // ══════════════════════════════════════════════
    let textoParaIA = texto_edital;

    // If no text and we have PNCP params, try downloading archives for Gemini Vision fallback
    if ((!textoParaIA || textoParaIA.trim().length < 50) && cnpj && ano && seq) {
      const urlArquivos = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos?pagina=1&tamanhoPagina=20`;
      try {
        const respArq = await fetch(urlArquivos, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        if (respArq.ok) {
          const dataArq = await respArq.json();
          const arquivos: any[] = dataArq?.data ?? (Array.isArray(dataArq) ? dataArq : []);
          const editalArq = arquivos.find((a: any) =>
            (a.titulo ?? "").toLowerCase().includes("edital") ||
            (a.tipoDocumentoNome ?? "").toLowerCase().includes("edital")
          ) ?? arquivos.find((a: any) =>
            (a.titulo ?? "").toLowerCase().includes("termo")
          ) ?? arquivos[0];
          const pdfUrl = editalArq?.url ?? editalArq?.uri ?? null;

          if (pdfUrl) {
            return new Response(JSON.stringify({
              success: false, data: [], total: 0, fonte: "manual",
              pdf_url: pdfUrl,
              mensagem: "Itens não disponíveis via API. O PDF do edital está disponível para extração manual ou upload.",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) {
        console.warn("[extrair-itens] Busca de arquivos PNCP falhou:", String(e));
      }
    }

    if (!textoParaIA || typeof textoParaIA !== "string" || textoParaIA.trim().length < 500) {
      // Limite mínimo elevado: textos curtos (objeto/observações) causam alucinação grave.
      // Ex.: "Aquisição de materiais" → IA inventa impressoras. Bloqueamos na origem.
      return new Response(JSON.stringify({
        success: false, data: [], error: "Texto insuficiente para extração confiável (mínimo 500 caracteres do edital/TR completo).",
        fonte: "manual", mensagem: "Envie o PDF/DOC do edital ou Termo de Referência. O objeto resumido não é suficiente para extração segura.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const truncated = textoParaIA.slice(0, 120000);
    console.log("[extrair-itens] CAMADA 3 - Extraindo via Gemini (texto)..., comprimento:", truncated.length);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um extrator técnico de itens de editais e termos de referência de licitações públicas brasileiras.

🚫 REGRA ABSOLUTA ANTI-ALUCINAÇÃO:
- NUNCA invente itens. Se o texto não tiver uma planilha/lista clara de itens, retorne {"itens": []}.
- NUNCA infira produtos a partir do "objeto" genérico (ex.: "Aquisição de materiais" NÃO é base para extrair itens).
- Cada descrição extraída DEVE aparecer LITERALMENTE no texto fornecido.
- Se houver dúvida sobre um item, NÃO o inclua. Prefira retornar lista vazia.

REGRAS:
- Extraia SOMENTE itens que aparecem literalmente no texto, com descrição fiel
- Preserve rigorosamente a ordem original
- Se não houver lista de itens identificável, retorne {"itens": []}

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
    const itens = rawItens.map((item: ItemEdital, idx: number) => normalizeItem(item, idx)).filter(Boolean);

    console.log(`[extrair-itens] Gemini retornou ${rawItens.length} itens brutos, ${itens.length} normalizados`);

    return buildSuccessResponse(itens, "IA", truncated);
  } catch (error) {
    console.error("extrair-itens-edital error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      fonte: "erro",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ── HELPERS ──────────────────────────────────────────────────

async function buscarPdfPNCP(cnpj: string, ano: number, seq: number): Promise<string | null> {
  const url = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos?pagina=1&tamanhoPagina=20`;
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.warn(`[buscarPdfPNCP] lista arquivos HTTP ${r.status}`); return null; }
    const { data: arquivos = [] } = await r.json();

    const prioridade = (a: any) => {
      const t = (a.titulo ?? "").toLowerCase();
      if (t.includes("termo de refer")) return 0;
      if (/\btr\b/.test(t)) return 1;
      if (t.includes("edital")) return 2;
      if (t.includes("planilha") || t.includes("item")) return 3;
      return 10;
    };

    const melhor = [...arquivos].sort((a: any, b: any) => prioridade(a) - prioridade(b))[0];
    if (!melhor?.url) { console.warn(`[buscarPdfPNCP] nenhum arquivo válido (${arquivos.length} total)`); return null; }

    console.log(`[buscarPdfPNCP] baixando: ${melhor.titulo || melhor.url}`);
    const pdfResp = await fetch(melhor.url, { signal: AbortSignal.timeout(25000) });
    if (!pdfResp.ok) { console.warn(`[buscarPdfPNCP] download HTTP ${pdfResp.status}`); return null; }

    const buf = await pdfResp.arrayBuffer();
    if (buf.byteLength > 8 * 1024 * 1024) {
      console.warn(`[buscarPdfPNCP] PDF muito grande (${(buf.byteLength / 1024 / 1024).toFixed(1)}MB), pulando`);
      return null;
    }
    console.log(`[buscarPdfPNCP] PDF baixado: ${(buf.byteLength / 1024).toFixed(0)} KB`);
    return arrayParaBase64(buf);
  } catch (e) {
    console.warn(`[buscarPdfPNCP] erro: ${String(e)}`);
    return null;
  }
}
