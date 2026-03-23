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

type VisionImage = {
  name?: string;
  dataUrl?: string;
};

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

    const { fileName = 'documento', images = [] } = await req.json();
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((image: VisionImage) => typeof image?.dataUrl === 'string' && image.dataUrl.startsWith('data:image/'))
      .slice(0, 4);

    if (sanitizedImages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem válida foi enviada.' }), {
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Arquivo: ${fileName}. Extraia o texto visível com fidelidade literal.`,
              },
              ...sanitizedImages.map((image: VisionImage, index: number) => ({
                type: 'image_url',
                image_url: {
                  url: image.dataUrl,
                },
                name: image.name || `imagem-${index + 1}`,
              })),
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('document-vision-extract error:', response.status, data);
      return new Response(JSON.stringify({ error: data?.error?.message || data?.error || 'Falha ao extrair texto da imagem.' }), {
        status: response.status,
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