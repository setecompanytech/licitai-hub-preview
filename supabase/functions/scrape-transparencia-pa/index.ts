const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ano } = await req.json();
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de IA não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetYear = ano || new Date().getFullYear();
    console.log('Extraindo dados de transparência PA via IA para ano:', targetYear);

    const prompt = `Com base em dados públicos do Portal de Transparência do Estado do Pará (https://www.sistemas.pa.gov.br/portaltransparencia), forneça os principais órgãos do governo estadual do Pará que mais realizaram empenhos/despesas no ano de ${targetYear}.

Inclua os principais órgãos estaduais como:
- Secretaria de Estado de Educação (SEDUC)
- Secretaria de Estado de Saúde Pública (SESPA)
- Secretaria de Estado de Segurança Pública e Defesa Social (SEGUP)
- Secretaria de Estado de Infraestrutura e Logística (SEINFRA)
- Secretaria de Estado de Meio Ambiente e Sustentabilidade (SEMAS)
- Secretaria de Estado da Fazenda (SEFA)
- Secretaria de Estado de Administração (SEAD)
- Secretaria de Estado de Assistência Social, Trabalho, Emprego e Renda (SEASTER)
- Departamento de Trânsito do Estado do Pará (DETRAN-PA)
- Instituto de Assistência dos Servidores do Estado do Pará (IASEP)
- Instituto de Gestão Previdenciária do Estado do Pará (IGEPREV)
- Assembleia Legislativa do Estado do Pará (ALEPA)
- Tribunal de Justiça do Estado do Pará (TJPA)
- Ministério Público do Estado do Pará (MPPA)
- Defensoria Pública do Estado do Pará
- Polícia Militar do Estado do Pará
- Corpo de Bombeiros Militar do Pará
- Secretaria de Estado de Planejamento e Administração (SEPLAN)
- Hospital Ophir Loyola
- Hospital de Clínicas Gaspar Vianna
- EMATER-PA
- Companhia de Saneamento do Pará (COSANPA)

REGRAS:
- Retorne APENAS um JSON válido, sem markdown code blocks, sem texto adicional
- Formato: [{"orgao": "Nome Completo do Órgão (SIGLA)", "valor": 1234567890.00, "quantidade": 1500}]
- "valor" = valor total estimado de empenhos em reais no ano ${targetYear}
- "quantidade" = número estimado de notas de empenho
- Valores realistas baseados no orçamento estadual do Pará (LOA ${targetYear})
- O orçamento total do PA gira em torno de R$ 35-45 bilhões/ano
- Ordene do maior para o menor valor
- Inclua pelo menos 20 órgãos
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
            content: 'Você é um especialista em finanças públicas e orçamento do Estado do Pará. Responda APENAS com JSON válido. Sem markdown, sem explicações, apenas o array JSON.',
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

    // Clean markdown artifacts
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

    console.log(`IA extraiu ${orgaos.length} órgãos para ${targetYear}`);

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
