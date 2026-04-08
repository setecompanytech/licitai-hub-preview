const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { descricao, codigoCatmat, especificacoes } = await req.json();

    if (!descricao) {
      return new Response(JSON.stringify({ error: 'descricao obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableKey) {
      const termos = descricao.split(/\s+/).filter((t: string) => t.length > 2).slice(0, 5);
      return new Response(JSON.stringify({
        categoria: 'geral',
        termos_gerais: [termos.join(' ')],
        termos_tecnicos: [],
        termos_marketplace: [termos.slice(0, 3).join(' ')],
        marca_referencia: null,
        unidade_padrao: 'UN',
        fator_conversao: 1,
        observacoes: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `Você é um especialista em Pesquisa de Preços para Licitações Públicas Brasileiras.

ITEM A PESQUISAR:
- Descrição: ${descricao}
- Código CATMAT: ${codigoCatmat ?? 'não informado'}
- Especificações: ${especificacoes ?? 'não informadas'}

Gere termos de busca otimizados para encontrar este item em marketplaces (Mercado Livre, Google Shopping, Amazon).

REGRAS IMPORTANTES:
1. "termos_marketplace" devem ser CURTOS (2 a 4 palavras), como um consumidor pesquisaria. Ex: "papel offset 120g", "toner HP 26A", "caneta BIC azul"
2. "termos_gerais" podem ser mais descritivos (4 a 6 palavras)
3. Inclua variações comerciais do produto
4. NÃO inclua dimensões exatas, normas técnicas ou especificações longas nos termos_marketplace

Responda APENAS com JSON válido:
{
  "categoria": "saude|ti|construcao|alimentos|limpeza|escritorio|veiculos|geral",
  "termos_gerais": ["termo descritivo 1", "termo descritivo 2"],
  "termos_tecnicos": ["especificação técnica 1"],
  "termos_marketplace": ["termo curto 1", "termo curto 2", "termo curto 3"],
  "marca_referencia": "marca citada ou null",
  "unidade_padrao": "UN|CX|KG|L|M|PCT|RM|etc",
  "fator_conversao": 1,
  "observacoes": null
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
    });

    let queryNormalizada;

    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          queryNormalizada = JSON.parse(jsonMatch[0]);
          // Ensure termos_marketplace exists
          if (!queryNormalizada.termos_marketplace || queryNormalizada.termos_marketplace.length === 0) {
            queryNormalizada.termos_marketplace = (queryNormalizada.termos_gerais || [])
              .map((t: string) => t.split(' ').slice(0, 3).join(' '));
          }
        }
      } catch {
        // fallback
      }
    }

    if (!queryNormalizada) {
      const words = descricao.split(/\s+/).filter((t: string) => t.length > 2);
      queryNormalizada = {
        categoria: 'geral',
        termos_gerais: [words.slice(0, 5).join(' ')],
        termos_tecnicos: [],
        termos_marketplace: [words.slice(0, 3).join(' ')],
        marca_referencia: null,
        unidade_padrao: 'UN',
        fator_conversao: 1,
        observacoes: null,
      };
    }

    return new Response(JSON.stringify(queryNormalizada),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Normalizer error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
