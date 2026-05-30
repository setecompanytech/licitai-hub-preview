import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openaiKey || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: 'Chaves não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'atualizar_indices';

    if (action === 'atualizar_indices') {
      const prompt = `Você é um economista especializado em índices econômicos brasileiros para licitações públicas.
Forneça os dados MAIS RECENTES disponíveis dos seguintes índices econômicos brasileiros.
Para cada índice, forneça o período mais recente publicado oficialmente.

Índices obrigatórios:
1. IPCA (IBGE) - Índice Nacional de Preços ao Consumidor Amplo
2. INPC (IBGE) - Índice Nacional de Preços ao Consumidor
3. IGP-M (FGV) - Índice Geral de Preços do Mercado
4. IGP-DI (FGV) - Índice Geral de Preços – Disponibilidade Interna
5. SINAPI (IBGE/Caixa) - Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil
6. CUB/m² (SINDUSCON) - Custo Unitário Básico da Construção Civil (média nacional R8-N)
7. Salário Mínimo Nacional vigente
8. SICRO (DNIT) - variação acumulada últimos 12 meses
9. Taxa SELIC meta atual
10. IPCA-E (IBGE) - prévia da inflação

Retorne APENAS um JSON array com objetos contendo:
- nome (nome completo do índice)
- sigla (abreviação)
- fonte (órgão que publica)
- periodo (ex: "fev/2026", "mar/2026")
- valor (valor numérico do índice ou salário em R$)
- variacao_mensal (variação % no mês, null se não aplicável)
- variacao_anual (variação % no ano, null se não aplicável)
- acumulado_12m (acumulado 12 meses %, null se não aplicável)
- categoria (inflacao, construcao, salario, juros)`;

      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é um economista com acesso aos dados mais recentes do IBGE, FGV, Caixa e DNIT. Retorne apenas JSON válido.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ success: false, error: 'Limite de requisições excedido' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos insuficientes' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        throw new Error(`AI error ${status}`);
      }

      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('JSON não encontrado na resposta da IA');

      const indices = JSON.parse(jsonMatch[0]);

      // Upsert indices
      let inserted = 0;
      for (const idx of indices) {
        // Delete existing for same sigla+periodo
        await supabase.from('indices_economicos')
          .delete().eq('sigla', idx.sigla).eq('periodo', idx.periodo);

        const { error } = await supabase.from('indices_economicos').insert({
          nome: idx.nome,
          sigla: idx.sigla,
          fonte: idx.fonte,
          periodo: idx.periodo,
          valor: idx.valor,
          variacao_mensal: idx.variacao_mensal,
          variacao_anual: idx.variacao_anual,
          acumulado_12m: idx.acumulado_12m,
          categoria: idx.categoria || 'inflacao',
        });
        if (!error) inserted++;
      }

      return new Response(JSON.stringify({ success: true, indices_atualizados: inserted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'simular_repactuacao') {
      const { valor_original, indice, percentual, data_base_original, data_base_reajuste, tipo_servico } = body;

      const prompt = `Você é um consultor jurídico-financeiro especializado em repactuação de contratos administrativos (Lei 14.133/2021).

Dados do contrato:
- Valor original: R$ ${valor_original}
- Índice de reajuste: ${indice}
- Percentual de reajuste solicitado: ${percentual}%
- Data-base original: ${data_base_original}
- Data-base reajuste: ${data_base_reajuste}
- Tipo de serviço: ${tipo_servico}

Calcule:
1. O valor reajustado aplicando o percentual
2. Verifique se o índice e percentual são compatíveis com os dados oficiais
3. Fundamente juridicamente com base na Lei 14.133/2021 e jurisprudência do TCU

Retorne JSON com:
- valor_reajustado (numeric)
- diferenca (numeric)
- fundamentacao (texto jurídico completo com artigos de lei e acórdãos)
- parecer (texto de parecer técnico sobre a viabilidade do reajuste)
- alertas (array de strings com pontos de atenção)
- indice_oficial_periodo (valor oficial do índice no período se disponível)`;

      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Retorne apenas JSON válido.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);
      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('JSON não encontrado');

      return new Response(JSON.stringify({ success: true, data: JSON.parse(jsonMatch[0]) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
