import { chamarClaude, parsearJson, arrayParaBase64 } from "../_shared/claude-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um mecanismo de OCR técnico, fiel e auditável.

OBJETIVO:
- Extrair o texto visível de documentos administrativos, jurídicos, contábeis e cadastrais.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS o texto extraído, sem comentários, sem resumo, sem markdown adicional e sem interpretação.
- Preserve a ordem visual aproximada e quebras de linha relevantes.
- Transcreva fielmente datas, horas, CNPJ, CPF, números de protocolo, valores, cabeçalhos e rodapés.
- Preserve expressões literais como "Emitido no dia", "Data de Emissão", "VÁLIDO ATÉ", "Data de Abertura" e similares.
- Se houver texto mascarado como "XXXXXXX", transcreva somente se ele realmente estiver visível; não atribua esse texto a outro campo.
- Nunca invente conteúdo ausente ou ilegível.`;

const VALIDITY_SYSTEM_PROMPT = `Você analisa documentos brasileiros para identificar a data de validade com máxima precisão.

OBJETIVO:
- Ler documentos como CNH, certidões, certificados e comprovantes oficiais.
- Identificar a data de validade/vencimento real do documento.

REGRAS OBRIGATÓRIAS:
- Retorne APENAS os argumentos da ferramenta solicitada.
- validityDate deve estar em formato YYYY-MM-DD quando houver alta confiança.
- evidenceText deve repetir literalmente o trecho ou rótulo relevante visto no documento.
- documentType deve resumir o tipo do documento (ex: CNH, CND, CRF, certidão).
- Se não houver data de validade confiável, retorne validityDate vazio.
- Nunca confunda emissão, nascimento, expedição, primeira habilitação, RG, CPF, RENACH ou registro com validade.`;

type VisionImage = {
  name?: string;
  dataUrl?: string;
  base64?: string;
  mimeType?: string;
};

function parseToolArguments(value: unknown) {
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function getGatewayErrorMessage(data: any) {
  return data?.error?.metadata?.raw || data?.error?.message || data?.error || 'Falha ao extrair texto da imagem.';
}

async function callGateway(openaiKey: string, body: Record<string, unknown>) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

function extractResponseText(content: unknown) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'object' && part && 'text' in part && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : ''))
      .join('\n')
      .trim();
  }
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    const { fileName = 'documento', images = [], text = '', mode = 'ocr', pdf_base64, pdf_url } = await req.json();

    const isValidityMode = mode === 'document_validity';

    // ══════════════════════════════════════════════
    // ROTA 1: PDF nativo via Claude (sem conversão para imagem)
    // ══════════════════════════════════════════════
    if (anthropicKey && (pdf_base64 || pdf_url)) {
      try {
        let base64 = pdf_base64;
        if (!base64 && pdf_url) {
          const r = await fetch(pdf_url, { signal: AbortSignal.timeout(15000) });
          if (r.ok) base64 = await arrayParaBase64(await r.arrayBuffer());
        }

        if (base64) {
          const promptClaude = isValidityMode
            ? `Arquivo: ${fileName}. Identifique a data de validade real deste documento. Retorne JSON: {"validityDate": "YYYY-MM-DD ou vazio", "evidenceText": "trecho literal", "documentType": "tipo"}`
            : `Arquivo: ${fileName}. Extraia todo o texto visível com fidelidade literal.`;

          const sistema = isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT;

          const resultado = await chamarClaude(
            promptClaude,
            { pdfBase64: base64 },
            { sistema, maxTokens: 6000 }
          );

          if (isValidityMode) {
            try {
              const parsed = parsearJson(resultado);
              return new Response(JSON.stringify({
                text: resultado,
                validityDate: parsed.validityDate || '',
                evidenceText: parsed.evidenceText || '',
                documentType: parsed.documentType || '',
                _motor: 'claude_pdf',
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch {
              // Fall through to Gemini
            }
          } else {
            return new Response(JSON.stringify({
              text: resultado,
              _motor: 'claude_pdf',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (e) {
        console.warn('[document-vision] Claude PDF falhou, tentando Gemini:', String(e));
      }
    }

    // ══════════════════════════════════════════════
    // ROTA 2: Imagens via Claude (até 20 imagens, vs 4 do Gemini)
    // ══════════════════════════════════════════════
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((image: VisionImage) => {
        const url = image?.dataUrl || image?.base64;
        return typeof url === 'string' && (url.startsWith('data:image/') || image?.base64);
      });

    if (anthropicKey && sanitizedImages.length > 0) {
      try {
        const imagensParaEnviar = sanitizedImages.slice(0, 20);

        const blocos: any[] = imagensParaEnviar.map((img: VisionImage) => {
          let base64Data = img.base64 || '';
          let mediaType = img.mimeType || 'image/jpeg';

          if (!base64Data && img.dataUrl) {
            const match = img.dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (match) {
              mediaType = match[1];
              base64Data = match[2];
            }
          }

          return {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          };
        });

        const promptText = isValidityMode
          ? `Arquivo: ${fileName}. Identifique a data de validade real do documento. Retorne JSON: {"validityDate": "YYYY-MM-DD ou vazio", "evidenceText": "trecho literal", "documentType": "tipo"}`
          : `Arquivo: ${fileName}. Extraia o texto visível com fidelidade literal.`;

        blocos.push({ type: "text", text: promptText });

        const sistema = isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT;

        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 6000,
            system: sistema,
            messages: [{ role: "user", content: blocos }],
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (resp.ok) {
          const data = await resp.json();
          const texto = data.content
            ?.filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("") ?? "";

          if (isValidityMode) {
            try {
              const parsed = parsearJson(texto);
              return new Response(JSON.stringify({
                text: texto,
                validityDate: parsed.validityDate || '',
                evidenceText: parsed.evidenceText || '',
                documentType: parsed.documentType || '',
                _motor: 'claude_images',
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } catch {
              // Fall through to Gemini
            }
          } else {
            return new Response(JSON.stringify({
              text: texto,
              _motor: 'claude_images',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (e) {
        console.warn('[document-vision] Claude imagens falhou, tentando Gemini:', String(e));
      }
    }

    // ══════════════════════════════════════════════
    // ROTA 3: Gemini (fallback para texto ou imagens com 4 limite)
    // ══════════════════════════════════════════════
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'Nenhuma chave de IA configurada.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiImages = sanitizedImages
      .filter((image: VisionImage) => {
        const size = (image.dataUrl?.length || 0);
        return size > 0 && size <= 5_500_000;
      })
      .slice(0, 4);

    const supportText = typeof text === 'string' ? text.trim().slice(0, 12000) : '';

    if (geminiImages.length === 0 && !supportText) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido foi enviado.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buildContent = (includeImages: boolean) => [
      {
        type: 'text',
        text: isValidityMode
          ? `Arquivo: ${fileName}. Identifique a data de validade real do documento.`
          : `Arquivo: ${fileName}. Extraia o texto visível com fidelidade literal.`,
      },
      ...(supportText ? [{ type: 'text', text: `Texto OCR de apoio (pode conter ruído):\n${supportText}` }] : []),
      ...(includeImages ? geminiImages.map((image: VisionImage) => ({
        type: 'image_url',
        image_url: { url: image.dataUrl },
      })) : []),
    ];

    const requestBody: Record<string, unknown> = {
      model: isValidityMode ? 'gpt-4o' : 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT },
        { role: 'user', content: buildContent(true) },
      ],
    };

    if (isValidityMode) {
      requestBody.tools = [
        {
          type: 'function',
          function: {
            name: 'extract_document_validity',
            description: 'Extrai a data de validade identificada em um documento brasileiro.',
            parameters: {
              type: 'object',
              properties: {
                validityDate: { type: 'string', description: 'Data em formato YYYY-MM-DD.' },
                evidenceText: { type: 'string', description: 'Trecho literal que indica a validade.' },
                documentType: { type: 'string', description: 'Tipo resumido do documento.' },
              },
              required: ['validityDate', 'evidenceText', 'documentType'],
              additionalProperties: false,
            },
          },
        },
      ];
      requestBody.tool_choice = { type: 'function', function: { name: 'extract_document_validity' } };
    }

    let { response, data } = await callGateway(openaiKey, requestBody);

    if (!response.ok && geminiImages.length > 0 && supportText) {
      const rawMessage = getGatewayErrorMessage(data);
      if (rawMessage.includes('Unable to process input image')) {
        ({ response, data } = await callGateway(openaiKey, {
          ...requestBody,
          messages: [
            { role: 'system', content: isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT },
            { role: 'user', content: buildContent(false) },
          ],
        }));
      }
    }

    if (!response.ok) {
      console.error('document-vision-extract error:', response.status, data);
      const gatewayError = getGatewayErrorMessage(data);
      const errorMessage = response.status === 429
        ? 'Limite de requisições excedido. Tente novamente em instantes.'
        : response.status === 402
          ? 'Créditos de IA insuficientes para analisar o documento.'
          : gatewayError;
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isValidityMode) {
      const toolArgs = parseToolArguments(data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) || {};
      const evidenceText = typeof toolArgs?.evidenceText === 'string' ? toolArgs.evidenceText.trim() : '';
      const validityDate = typeof toolArgs?.validityDate === 'string' ? toolArgs.validityDate.trim() : '';
      const documentType = typeof toolArgs?.documentType === 'string' ? toolArgs.documentType.trim() : '';
      const responseText = extractResponseText(data?.choices?.[0]?.message?.content);

      return new Response(JSON.stringify({ text: responseText, validityDate, evidenceText, documentType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseText = extractResponseText(data?.choices?.[0]?.message?.content);
    return new Response(JSON.stringify({ text: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('document-vision-extract fatal error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
