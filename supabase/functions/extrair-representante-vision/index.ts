const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é um extrator técnico de dados cadastrais brasileiros. Analise o documento enviado (imagens e, quando disponível, texto OCR de apoio) e extraia os dados do representante legal.

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

MAPA DE CAMPOS DA CNH (siga à risca — os rótulos numerados são padronizados):
- Campo "2e1 NOME E SOBRENOME" → repNome.
- Campo "4d CPF" → repCpf (normalize para 000.000.000-00).
- Campo "4c DOC IDENTIDADE / ÓRG EMISSOR / UF" (ex: "6142740 MTE PA") → a parte
  numérica é o repRg ("6142740") e o órgão + UF é o repOrgaoExp no formato
  ÓRGÃO/UF ("MTE/PA").
- Campo "3 DATA, LOCAL E UF DE NASCIMENTO" (ex: "20/12/1993, BELEM, PA") → a
  cidade e UF são a repNaturalidade no formato Cidade/UF ("Belém/PA").
- Campo "NACIONALIDADE" (ex: "BRASILEIRO(A)") → repNacionalidade ("Brasileira").
- NUNCA use como RG: "5 Nº REGISTRO", RENACH, número do espelho, código de
  segurança ou o número vertical da lateral.

REGRAS CRÍTICAS:
- Campo não identificado com segurança = "".
- Preserve a grafia original, incluindo acentos.
- CPF: normalize para 000.000.000-00 se visível.
- Em RG (cédula de identidade): o número do registro geral → repRg; órgão
  expedidor/UF → repOrgaoExp; naturalidade → repNaturalidade.
- repCargo: preencha SOMENTE se indicar vínculo societário ou função empresarial; em documento pessoal isolado, deixe "".
- repNaturalidade e repNacionalidade: preencha SOMENTE se visíveis no documento.
- Se houver múltiplas pessoas, escolha o representante legal, sócio-administrador ou titular principal.
- Valores genéricos de formulário como "000.000.000-00", "Número do RG", "SSP/XX", "Cidade/UF" e "Nome completo do representante" NÃO são dados válidos; se houver apenas esse tipo de exemplo/placeholder, retorne "".
- Se houver imagem e texto OCR, use o texto apenas como apoio e priorize o que estiver consistente com o documento.
- NUNCA invente dados. NUNCA transfira valores de um campo para outro. NUNCA complete por contexto.`;

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

    const { fileName = 'documento', images = [], text = '' } = await req.json();

    // Build message content parts
    const contentParts: any[] = [];

    // If we have images, send them directly for vision analysis
    const sanitizedImages = (Array.isArray(images) ? images : [])
      .filter((img: any) => typeof img?.dataUrl === 'string' && img.dataUrl.startsWith('data:image/'))
      .slice(0, 5);

    const validImages = sanitizedImages.filter((img: any) => (img.dataUrl?.length || 0) <= 5_500_000);
    const hasSupportText = typeof text === 'string' && text.trim().length > 10;

    if (validImages.length > 0) {
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}. Analise a(s) imagem(ns) do documento e extraia os dados do representante legal. Retorne APENAS o JSON.`,
      });

      for (const img of validImages) {
        contentParts.push({
          type: 'image_url',
          // detail high: documento de identidade tem campos pequenos (órgão
          // expedidor, RG) que somem na resolução automática.
          image_url: { url: img.dataUrl, detail: 'high' },
        });
      }
    }

    if (hasSupportText) {
      contentParts.push({
        type: 'text',
        text: `Arquivo: ${fileName}\n\nTEXTO OCR DE APOIO (pode conter ruído; confirme nas imagens sempre que possível):\n${text.slice(0, 12000)}\n\nExtraia os dados do representante legal. Retorne APENAS o JSON.`,
      });
    }

    // Falha silenciosa é proibida: se chegaram imagens mas TODAS estouraram o
    // limite, dizer isso — antes a extração seguia só com texto de apoio e
    // devolvia campos vazios sem explicar o porquê.
    if (sanitizedImages.length > 0 && validImages.length === 0 && !hasSupportText) {
      return new Response(JSON.stringify({ error: 'Imagem grande demais para leitura. Envie uma foto menor (ou o app recomprime automaticamente na próxima tentativa).' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (contentParts.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma imagem ou texto válido enviado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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