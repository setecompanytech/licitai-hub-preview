const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { descricao, codigoCatmat, especificacoes, unidade, quantidade } = await req.json();

    if (!descricao) {
      return new Response(JSON.stringify({ error: 'descricao obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
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
- Unidade de Fornecimento: ${unidade ?? 'não informada'}
- Quantidade: ${quantidade ?? 'não informada'}

REGRA CRÍTICA DE UNIDADE:
Analise a descrição E a unidade de fornecimento juntas para entender EXATAMENTE o que está sendo comprado.
Exemplos de erros a evitar:
- Se a unidade é "RESMA" (500 folhas) e a descrição diz "papel A4", busque o preço da RESMA, não do pacote com 100 folhas.
- Se a unidade é "PCT C/1000" e o produto é vendido em pacotes de 500, o preço deve ser multiplicado por 2.
- Se a unidade é "CX C/50" (caixa com 50 unidades), busque o preço da caixa, não da unidade avulsa.
- Se a unidade é "GL" (galão), não busque por litro.
Inclua a informação de embalagem/acondicionamento nos termos de busca quando relevante.

Gere termos de busca otimizados para encontrar este item em marketplaces (Mercado Livre, Google Shopping, Amazon).

REGRAS IMPORTANTES:
1. "termos_marketplace" devem ser CURTOS (2 a 4 palavras), como um consumidor pesquisaria. Ex: "papel offset 120g resma", "toner HP 26A", "caneta BIC azul caixa"
2. "termos_gerais" podem ser mais descritivos (4 a 6 palavras), incluindo a embalagem/unidade
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
  "unidade_busca": "descrição da unidade real de busca, ex: resma 500 folhas",
  "observacoes": null
}`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
