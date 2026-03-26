const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um extrator técnico de dados cadastrais brasileiros. Analise a IMAGEM do documento enviado e extraia os dados do representante legal.

DOCUMENTOS POSSÍVEIS:
- CNH, RG, CPF, procuração, contrato social, ato constitutivo.

FORMATO DE SAÍDA — retorne APENAS este JSON puro (sem markdown, sem crases, sem texto extra):
{
  "repNome": "",
  "repCpf": "",
  "repRg": "",
  "repOrgaoExp": "",
  "repCargo": "",
  "repNaturalidade": "",
  "repNacionalidade": ""
}

REGRAS CRÍTICAS:
- Campo não identificado com segurança = "".
- Preserve a grafia original, incluindo acentos.
- CPF: normalize para 000.000.000-00 se visível.
- Em CNH: use o nome do portador como repNome.
- NÃO use número de registro da CNH, RENACH, número do espelho ou código de segurança como RG.
- repRg: preencha SOMENTE se o RG estiver explícito no documento (campo "RG" ou "Doc. Identidade").
- repOrgaoExp: preencha SOMENTE se houver órgão expedidor visível (ex: SSP/PA, DETRAN/PA).
- repCargo: preencha SOMENTE se indicar vínculo societário ou função empresarial; em documento pessoal isolado, deixe "".
- repNaturalidade e repNacionalidade: preencha SOMENTE se visíveis no documento.
- Se houver múltiplas pessoas, escolha o representante legal, sócio-administrador ou titular principal.
- NUNCA invente dados. NUNCA transfira valores de um campo para outro. NUNCA complete por contexto.`;

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

    const { fileName = 'documento', images = [], text = '' } = await req.json();

    // Build message content parts
    const contentParts: any[] = [];

    // If we have images, send them directly for vision analysis
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((img: any) => typeof img?.dataUrl === 'string' && img.dataUrl.startsWith('data:image/'))
      .slice(0, 5);

    if (sanitizedImages.length > 0) {
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}. Analise a(s) imagem(ns) do documento e extraia os dados do representante legal. Retorne APENAS o JSON.`,
      });

      for (const img of sanitizedImages) {
        if ((img.dataUrl?.length || 0) > 5_500_000) continue;
        contentParts.push({
          type: 'image_url',
          image_url: { url: img.dataUrl },
        });
      }
    } else if (text && text.trim().length > 10) {
      // Fallback: if no images, use extracted text
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}\n\nTEXTO EXTRAÍDO DO DOCUMENTO:\n${text.slice(0, 12000)}\n\nExtraia os dados do representante legal. Retorne APENAS o JSON.`,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido enviado.' }), {
        status: 400,
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
          { role: 'user', content: contentParts },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('extrair-representante-vision error:', response.status, data);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Falha ao processar documento.' }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawContent = data?.choices?.[0]?.message?.content || '';
    const textContent = typeof rawContent === 'string' ? rawContent :
      Array.isArray(rawContent) ? rawContent.map((p: any) => p?.text || '').join('') : '';

    return new Response(JSON.stringify({ result: textContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('extrair-representante-vision fatal:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});