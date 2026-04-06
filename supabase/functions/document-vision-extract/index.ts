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
};

function parseToolArguments(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getGatewayErrorMessage(data: any) {
  return data?.error?.metadata?.raw || data?.error?.message || data?.error || 'Falha ao extrair texto da imagem.';
}

async function callGateway(lovableKey: string, body: Record<string, unknown>) {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${lovableKey}`,
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
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileName = 'documento', images = [], text = '', mode = 'ocr' } = await req.json();
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((image: VisionImage) => typeof image?.dataUrl === 'string' && image.dataUrl.startsWith('data:image/'))
      .slice(0, 4);
    const supportText = typeof text === 'string' ? text.trim().slice(0, 12000) : '';
    const isValidityMode = mode === 'document_validity';

    if (sanitizedImages.length === 0 && !supportText) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido foi enviado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oversizedImage = sanitizedImages.find((image: VisionImage) => (image.dataUrl?.length || 0) > 5_500_000);
    if (oversizedImage) {
      return new Response(JSON.stringify({ error: 'Uma das imagens excede o tamanho máximo permitido para OCR.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buildContent = (includeImages: boolean) => [
      {
        type: 'text',
        text: isValidityMode
          ? `Arquivo: ${fileName}. Identifique a data de validade real do documento.`
          : `Arquivo: ${fileName}. Extraia o texto visível com fidelidade literal.`,
      },
      ...(supportText ? [{
        type: 'text',
        text: `Texto OCR de apoio (pode conter ruído):\n${supportText}`,
      }] : []),
      ...(includeImages ? sanitizedImages.map((image: VisionImage) => ({
        type: 'image_url',
        image_url: {
          url: image.dataUrl,
        },
      })) : []),
    ];

    const requestBody: Record<string, unknown> = {
      model: isValidityMode ? 'google/gemini-2.5-pro' : 'google/gemini-3-flash-preview',
      temperature: 0.1,
      messages: [
        { role: 'system', content: isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildContent(true),
        },
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

    let { response, data } = await callGateway(lovableKey, requestBody);

    if (!response.ok && sanitizedImages.length > 0 && supportText) {
      const rawMessage = getGatewayErrorMessage(data);
      if (rawMessage.includes('Unable to process input image')) {
        ({ response, data } = await callGateway(lovableKey, {
          ...requestBody,
          messages: [
            { role: 'system', content: isValidityMode ? VALIDITY_SYSTEM_PROMPT : SYSTEM_PROMPT },
            {
              role: 'user',
              content: buildContent(false),
            },
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
      const text = extractResponseText(data?.choices?.[0]?.message?.content);

      return new Response(JSON.stringify({ text, validityDate, evidenceText, documentType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = extractResponseText(data?.choices?.[0]?.message?.content);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('document-vision-extract fatal error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});