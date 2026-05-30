const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um extrator técnico de dados de Atestado de Capacidade Técnica para fins de fornecimento e serviços.

OBJETIVO:
- Ler o documento enviado (imagens e/ou OCR de apoio) e extrair APENAS os campos essenciais para identificação rápida pelo usuário.

RETORNO OBRIGATÓRIO:
- Use exclusivamente a ferramenta solicitada.
- Não escreva markdown, comentários ou texto fora dos argumentos da ferramenta.

REGRAS DE EXTRAÇÃO:
- objeto = descrição do fornecimento, produto, material ou serviço efetivamente atestado.
- orgao_emissor = cliente/órgão/empresa contratante ou emitente do atestado.
- ano_fornecimento = ano do fornecimento/prestação. Se houver período, priorize o ano principal ou formato como "2023/2024".
- valor = valor contratual ou valor total somente se estiver expresso no documento.
- cnpj_contratante = CNPJ do cliente/órgão/empresa contratante, se visível.
- periodo = período completo de execução/fornecimento, se houver.
- Campo sem confiança suficiente = "".
- Nunca invente dados.
- Nunca transfira conteúdo de um campo para outro.
- Se houver imagem e OCR, priorize o que estiver consistente entre ambos.
- Foque em identificar com fidelidade: Cliente/Órgão, Ano do fornecimento e Objeto.`;

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
  return data?.error?.metadata?.raw || data?.error?.message || data?.error || 'Falha ao extrair dados do atestado.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { fileName = 'documento', segmento = '', images = [], text = '' } = await req.json();

    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((image: VisionImage) => typeof image?.dataUrl === 'string' && image.dataUrl.startsWith('data:image/'))
      .slice(0, 4);

    const supportText = typeof text === 'string' ? text.trim().slice(0, 16000) : '';

    if (sanitizedImages.length === 0 && !supportText) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido foi enviado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oversizedImage = sanitizedImages.find((image: VisionImage) => (image.dataUrl?.length || 0) > 5_500_000);
    if (oversizedImage) {
      return new Response(JSON.stringify({ error: 'Uma das imagens excede o tamanho máximo permitido para análise.' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const content = [
      {
        type: 'text',
        text: `Arquivo: ${fileName}. Segmento informado: ${segmento || 'não informado'}. Extraia Cliente/Órgão, Ano do fornecimento e Objeto do atestado com prioridade máxima.`,
      },
      ...(supportText ? [{
        type: 'text',
        text: `Texto OCR de apoio (pode conter ruído):\n${supportText}`,
      }] : []),
      ...sanitizedImages.map((image: VisionImage) => ({
        type: 'image_url',
        image_url: {
          url: image.dataUrl,
        },
      })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_act_fields',
              description: 'Extrai os dados essenciais de um atestado de capacidade técnica.',
              parameters: {
                type: 'object',
                properties: {
                  objeto: { type: 'string' },
                  orgao_emissor: { type: 'string' },
                  ano_fornecimento: { type: 'string' },
                  valor: { type: 'string' },
                  cnpj_contratante: { type: 'string' },
                  periodo: { type: 'string' },
                },
                required: ['objeto', 'orgao_emissor', 'ano_fornecimento', 'valor', 'cnpj_contratante', 'periodo'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_act_fields' } },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('extrair-atestado-capacidade error:', response.status, data);
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

    const parsed = parseToolArguments(data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) || {};

    return new Response(JSON.stringify({
      result: {
        objeto: typeof parsed?.objeto === 'string' ? parsed.objeto.trim() : '',
        orgao_emissor: typeof parsed?.orgao_emissor === 'string' ? parsed.orgao_emissor.trim() : '',
        ano_fornecimento: typeof parsed?.ano_fornecimento === 'string' ? parsed.ano_fornecimento.trim() : '',
        valor: typeof parsed?.valor === 'string' ? parsed.valor.trim() : '',
        cnpj_contratante: typeof parsed?.cnpj_contratante === 'string' ? parsed.cnpj_contratante.trim() : '',
        periodo: typeof parsed?.periodo === 'string' ? parsed.periodo.trim() : '',
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('extrair-atestado-capacidade fatal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});