// Sprint 6 — OCR Multi-IA para documentos financeiros (NF-e, boletos, recibos)
// Usa Lovable AI Gateway (Gemini Vision) como motor primário, com fallback para Claude e OpenAI.
// Extrai estruturadamente: emitente, valor, vencimento, código de barras, chave NF-e.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em OCR de documentos financeiros brasileiros (NF-e, NFS-e, boletos bancários, recibos, contratos).

OBJETIVO: Extrair com fidelidade os campos estruturados do documento enviado.

CAMPOS A EXTRAIR (quando visíveis):
- tipo_documento: "nfe" | "nfse" | "boleto" | "recibo" | "contrato" | "outro"
- emitente_nome: razão social do emissor
- emitente_cnpj: CNPJ formatado
- destinatario_nome: nome do tomador/destinatário
- destinatario_cnpj_cpf: CNPJ ou CPF do destinatário
- numero_documento: número da NF/boleto
- chave_nfe: chave de acesso de 44 dígitos (apenas para NF-e/NFS-e)
- data_emissao: AAAA-MM-DD
- data_vencimento: AAAA-MM-DD (boletos)
- valor_total: número decimal (R$)
- codigo_barras: linha digitável de boleto (47/48 dígitos)
- descricao: descrição do produto/serviço
- impostos: { iss, icms, pis, cofins, ir } (quando visíveis)

NUNCA invente dados ausentes. Use null para campos não encontrados.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "extrair_documento_financeiro",
    description: "Extrai campos estruturados de um documento financeiro brasileiro.",
    parameters: {
      type: "object",
      properties: {
        tipo_documento: { type: "string", enum: ["nfe", "nfse", "boleto", "recibo", "contrato", "outro"] },
        emitente_nome: { type: "string" },
        emitente_cnpj: { type: "string" },
        destinatario_nome: { type: "string" },
        destinatario_cnpj_cpf: { type: "string" },
        numero_documento: { type: "string" },
        chave_nfe: { type: "string" },
        data_emissao: { type: "string" },
        data_vencimento: { type: "string" },
        valor_total: { type: "number" },
        codigo_barras: { type: "string" },
        descricao: { type: "string" },
        confianca: { type: "number", description: "0-1, confiança na extração" },
      },
      required: ["tipo_documento", "confianca"],
      additionalProperties: true,
    },
  },
};

async function callLovableAI(imageDataUrl: string, model: string) {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extraia os campos estruturados deste documento financeiro." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]},
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "extrair_documento_financeiro" } },
    }),
  });

  if (!r.ok) throw new Error(`Lovable AI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

async function callClaude(imageDataUrl: string) {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ausente");

  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error("dataUrl inválido");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } },
        { type: "text", text: "Extraia os campos estruturados em JSON puro (sem markdown). Use as chaves: tipo_documento, emitente_nome, emitente_cnpj, destinatario_nome, destinatario_cnpj_cpf, numero_documento, chave_nfe, data_emissao, data_vencimento, valor_total, codigo_barras, descricao, confianca." },
      ]}],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const data = await r.json();
  const text = data.content?.[0]?.text || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl, preferredModel } = await req.json();
    if (!imageDataUrl?.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "imageDataUrl inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const intentos: { motor: string; fn: () => Promise<any> }[] = [];

    if (preferredModel === "claude" && Deno.env.get("ANTHROPIC_API_KEY")) {
      intentos.push({ motor: "claude_sonnet_4", fn: () => callClaude(imageDataUrl) });
    }
    intentos.push({ motor: "gemini_2.5_pro", fn: () => callLovableAI(imageDataUrl, "gpt-4o") });
    intentos.push({ motor: "gemini_3_flash", fn: () => callLovableAI(imageDataUrl, "gpt-4o-mini") });
    intentos.push({ motor: "gpt_5_mini", fn: () => callLovableAI(imageDataUrl, "openai/gpt-5-mini") });
    if (Deno.env.get("ANTHROPIC_API_KEY") && preferredModel !== "claude") {
      intentos.push({ motor: "claude_sonnet_4", fn: () => callClaude(imageDataUrl) });
    }

    let lastError = "";
    for (const tentativa of intentos) {
      try {
        const resultado = await tentativa.fn();
        if (resultado && resultado.tipo_documento) {
          return new Response(JSON.stringify({ ok: true, motor: tentativa.motor, dados: resultado }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        console.warn(`[ocr-financeiro] ${tentativa.motor} falhou:`, lastError);
      }
    }

    return new Response(JSON.stringify({ error: "Todos os motores de IA falharam", detalhes: lastError }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ocr-document-financeiro] erro fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
