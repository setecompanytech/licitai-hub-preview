import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      // Fallback: normalization without AI
      const termos = descricao.split(/\s+/).filter((t: string) => t.length > 2).slice(0, 5);
      return new Response(JSON.stringify({
        categoria: 'geral',
        termos_gerais: [termos.join(' ')],
        termos_tecnicos: [],
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

Gere os melhores termos de busca para pesquisar o preço deste item em diferentes canais. Seja específico o suficiente para resultados relevantes, mas não tão restrito que limite os resultados.

Responda APENAS com JSON válido:
{
  "categoria": "saude|ti|construcao|alimentos|limpeza|escritorio|veiculos|geral",
  "termos_gerais": ["termo1", "termo2", "termo3"],
  "termos_tecnicos": ["especificação técnica 1", "especificação técnica 2"],
  "marca_referencia": "marca citada ou null",
  "unidade_padrao": "UN|CX|KG|L|M|etc",
  "fator_conversao": 1,
  "observacoes": "Observação relevante para a pesquisa ou null"
}`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
        }
      } catch {
        // fallback
      }
    }

    if (!queryNormalizada) {
      queryNormalizada = {
        categoria: 'geral',
        termos_gerais: [descricao.split(' ').slice(0, 4).join(' ')],
        termos_tecnicos: [],
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
