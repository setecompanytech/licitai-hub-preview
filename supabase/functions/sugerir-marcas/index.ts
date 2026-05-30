import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://api.openai.com/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY não configurada');

    const authHeader = req.headers.get('Authorization');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Validate user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader! } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { licitacao_id, itens } = await req.json();
    if (!licitacao_id || !itens?.length) {
      return new Response(JSON.stringify({ error: 'licitacao_id e itens são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch licitação details
    const { data: licitacao } = await supabaseAdmin
      .from('licitacoes')
      .select('numero, orgao, objeto, modalidade')
      .eq('id', licitacao_id)
      .single();

    // 2. Search internal history for similar items
    const descricoes = itens.map((i: any) => i.descricao).join(' | ');

    // Query agent_historico_precos for past prices with brand/model
    const { data: historicoPrecos } = await supabaseAdmin
      .from('agent_historico_precos')
      .select('descricao, marca, modelo, preco_vencedor, orgao, modalidade, data_registro, cnpj_vencedor')
      .not('marca', 'is', null)
      .order('data_registro', { ascending: false })
      .limit(200);

    // Query licitacao_itens for past items with brand info
    const { data: itensAnteriores } = await supabaseAdmin
      .from('licitacao_itens')
      .select('descricao, marca, fabricante, modelo, valor_unitario, lote')
      .eq('user_id', user.id)
      .not('marca', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    // Query agent_itens_edital for curated brand selections
    const { data: itensAgente } = await supabaseAdmin
      .from('agent_itens_edital')
      .select('descricao, marca_referencia, marca_selecionada, modelo_selecionado, preco_referencia, preco_proposta, numero, lote')
      .not('marca_selecionada', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    // Build historical context
    const historicoContext = [
      ...(historicoPrecos || []).map(h => ({
        descricao: h.descricao,
        marca: h.marca,
        modelo: h.modelo,
        preco: h.preco_vencedor,
        orgao: h.orgao,
        data: h.data_registro,
        fonte: 'historico_precos',
      })),
      ...(itensAnteriores || []).map(h => ({
        descricao: h.descricao,
        marca: h.marca,
        modelo: h.modelo,
        fabricante: h.fabricante,
        preco: h.valor_unitario,
        fonte: 'itens_anteriores',
      })),
      ...(itensAgente || []).map(h => ({
        descricao: h.descricao,
        marca: h.marca_selecionada,
        marca_ref: h.marca_referencia,
        modelo: h.modelo_selecionado,
        preco_ref: h.preco_referencia,
        preco_proposta: h.preco_proposta,
        fonte: 'agente_ia',
      })),
    ];

    // 3. Use AI to match items with historical brand/model data
    const systemPrompt = `Você é um especialista em licitações públicas brasileiras (Lei 14.133/2021).
Sua tarefa é analisar itens de um Termo de Referência e sugerir MARCAS, FABRICANTES e MODELOS compatíveis com base em dados históricos de processos anteriores.

REGRAS CRÍTICAS:
1. Só sugira marcas/fabricantes que REALMENTE aparecem no histórico fornecido
2. Verifique se a marca atende às especificações do TR (ex: selo ABIC, normas INMETRO, etc.)
3. Para cada sugestão, atribua um score de confiança (0-100):
   - 90-100: Mesmo órgão, mesmo objeto, processo recente (<1 ano)
   - 70-89: Mesmo objeto, órgão diferente, marca consolidada
   - 50-69: Objeto similar, marca compatível com especificações
   - <50: Baixa certeza, necessita validação
4. Sugira até 3 opções ranqueadas por confiança
5. Se o TR exige marca/modelo específico, priorize a marca de referência
6. Inclua justificativa técnica para cada sugestão

Retorne EXCLUSIVAMENTE um JSON array via tool call.`;

    const userPrompt = `## Licitação Atual
- Número: ${licitacao?.numero || 'N/I'}
- Órgão: ${licitacao?.orgao || 'N/I'}
- Objeto: ${licitacao?.objeto || 'N/I'}
- Modalidade: ${licitacao?.modalidade || 'N/I'}

## Itens do Termo de Referência
${itens.map((i: any, idx: number) => `${idx + 1}. [Item ${i.numero || idx + 1}] ${i.descricao} — Qtd: ${i.quantidade} ${i.unidade} — Valor Ref: R$ ${i.valor_unitario || 'N/I'}`).join('\n')}

## Dados Históricos de Processos Anteriores
${JSON.stringify(historicoContext.slice(0, 100), null, 2)}

Analise cada item do TR, cruze com o histórico e sugira marcas/modelos compatíveis.`;

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'sugerir_marcas_modelos',
            description: 'Retorna sugestões de marca/fabricante/modelo para cada item do TR',
            parameters: {
              type: 'object',
              properties: {
                sugestoes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      item_numero: { type: 'number', description: 'Número do item no TR' },
                      descricao_item: { type: 'string' },
                      opcoes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            ranking: { type: 'number' },
                            marca: { type: 'string' },
                            fabricante: { type: 'string' },
                            modelo: { type: 'string' },
                            preco_historico: { type: 'number' },
                            fonte: { type: 'string', enum: ['historico_precos', 'itens_anteriores', 'agente_ia', 'pncp'] },
                            orgao_origem: { type: 'string' },
                            numero_processo_origem: { type: 'string' },
                            score_confianca: { type: 'number' },
                            justificativa: { type: 'string' },
                          },
                          required: ['ranking', 'marca', 'score_confianca', 'justificativa'],
                        },
                      },
                    },
                    required: ['item_numero', 'descricao_item', 'opcoes'],
                  },
                },
              },
              required: ['sugestoes'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'sugerir_marcas_modelos' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos em Configurações > Workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errText);
      throw new Error('Erro ao processar análise de marcas');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('IA não retornou sugestões estruturadas');

    const parsed = JSON.parse(toolCall.function.arguments);
    const sugestoes = parsed.sugestoes || [];

    // 4. Persist suggestions
    const rowsToInsert: any[] = [];
    for (const sug of sugestoes) {
      const matchingItem = itens.find((i: any) => (i.numero || 0) === sug.item_numero);
      for (const opcao of sug.opcoes || []) {
        rowsToInsert.push({
          licitacao_id,
          licitacao_item_id: matchingItem?.id || null,
          user_id: user.id,
          descricao_item: sug.descricao_item,
          marca_sugerida: opcao.marca,
          fabricante_sugerido: opcao.fabricante || null,
          modelo_sugerido: opcao.modelo || null,
          fonte: opcao.fonte || 'historico',
          fonte_detalhe: opcao.numero_processo_origem || null,
          orgao_origem: opcao.orgao_origem || null,
          numero_processo_origem: opcao.numero_processo_origem || null,
          preco_historico: opcao.preco_historico || null,
          score_confianca: opcao.score_confianca || 0,
          ranking: opcao.ranking || 1,
          status: 'pendente',
          justificativa_ia: opcao.justificativa || null,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      // Clear previous suggestions for this licitação
      await supabaseAdmin
        .from('sugestoes_marca_modelo')
        .delete()
        .eq('licitacao_id', licitacao_id)
        .eq('user_id', user.id);

      const { error: insertErr } = await supabaseAdmin
        .from('sugestoes_marca_modelo')
        .insert(rowsToInsert);

      if (insertErr) {
        console.error('Erro ao salvar sugestões:', insertErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_sugestoes: rowsToInsert.length,
      itens_analisados: sugestoes.length,
      sugestoes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sugerir-marcas error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
