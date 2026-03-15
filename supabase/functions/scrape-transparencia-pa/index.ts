const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ano, portal_nome, portal_sigla, portal_url, portal_tipo } = await req.json();
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de IA não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetYear = ano || new Date().getFullYear();
    const nome = portal_nome || 'Pará';
    const sigla = portal_sigla || 'PA';
    const url = portal_url || 'https://www.sistemas.pa.gov.br/portaltransparencia';
    const tipo = portal_tipo || 'estado';

    const isEstado = tipo === 'estado';
    const entidadeLabel = isEstado ? `Estado de ${nome} (${sigla})` : `Município de ${nome} (${sigla})`;

    console.log(`Extraindo dados de transparência via IA para: ${entidadeLabel}, ano: ${targetYear}`);

    const prompt = isEstado
      ? `Com base em dados públicos do Portal de Transparência do ${entidadeLabel} (${url}), forneça os principais órgãos do governo ${isEstado ? 'estadual' : 'municipal'} que mais realizaram empenhos/despesas no ano de ${targetYear}.

Inclua os principais órgãos como secretarias, autarquias, fundações e empresas públicas do ${entidadeLabel}.

REGRAS:
- Retorne APENAS um JSON válido, sem markdown code blocks, sem texto adicional
- Formato: [{"orgao": "Nome Completo do Órgão (SIGLA)", "valor": 1234567890.00, "quantidade": 1500}]
- "valor" = valor total estimado de empenhos em reais no ano ${targetYear}
- "quantidade" = número estimado de notas de empenho
- Valores realistas baseados no orçamento ${isEstado ? 'estadual' : 'municipal'} (LOA ${targetYear})
- Ordene do maior para o menor valor
- Inclua pelo menos 15 órgãos
- Valores numéricos, sem formatação`
      : `Com base em dados públicos do Portal de Transparência de ${nome} (${url}), forneça os principais órgãos/secretarias da prefeitura que mais realizaram empenhos/despesas no ano de ${targetYear}.

Inclua os principais órgãos como secretarias municipais, autarquias, fundações e empresas públicas de ${nome}.

REGRAS:
- Retorne APENAS um JSON válido, sem markdown code blocks, sem texto adicional
- Formato: [{"orgao": "Nome Completo do Órgão (SIGLA)", "valor": 1234567890.00, "quantidade": 1500}]
- "valor" = valor total estimado de empenhos em reais no ano ${targetYear}
- "quantidade" = número estimado de notas de empenho
- Valores realistas baseados no orçamento municipal (LOA ${targetYear})
- Ordene do maior para o menor valor
- Inclua pelo menos 15 órgãos
- Valores numéricos, sem formatação`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em finanças públicas e orçamento do ${entidadeLabel}. Responda APENAS com JSON válido. Sem markdown, sem explicações, apenas o array JSON.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro no serviço de IA', fallback: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', content.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: 'IA não retornou dados estruturados', fallback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const orgaos = parsed
      .filter((item: any) => item.orgao && Number(item.valor) > 0)
      .map((item: any) => ({
        orgao: String(item.orgao).trim(),
        valor: Number(item.valor),
        quantidade: Number(item.quantidade) || 1,
      }))
      .sort((a: any, b: any) => b.valor - a.valor);

    console.log(`IA extraiu ${orgaos.length} órgãos para ${entidadeLabel} - ${targetYear}`);

    return new Response(
      JSON.stringify({ success: true, data: orgaos, source: 'ai-knowledge' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar',
        fallback: true,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
