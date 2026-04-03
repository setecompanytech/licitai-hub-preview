import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const inicio = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { licitacao_id, empresa_id, texto_edital } = await req.json();

    if (!licitacao_id || !empresa_id) {
      return new Response(JSON.stringify({ error: 'licitacao_id e empresa_id obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Buscar licitação e edital do cache
    const { data: licitacao } = await supabase
      .from('agent_licitacoes')
      .select('*, pncp_editais_cache(*)')
      .eq('id', licitacao_id)
      .single();

    if (!licitacao) {
      return new Response(JSON.stringify({ error: 'Licitação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const edital = licitacao.pncp_editais_cache;

    // 2. Montar texto do edital para análise
    const textoParaAnalise = texto_edital
      || `Objeto: ${edital?.objeto_compra || 'N/A'}\nÓrgão: ${edital?.orgao_nome || 'N/A'}\nModalidade: ${edital?.modalidade_nome || 'N/A'}\nValor estimado: R$ ${edital?.valor_total_estimado || 'N/A'}\nUF: ${edital?.uf || 'N/A'}`;

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. AURÉLIA extrai os itens estruturados
    const promptExtracao = `Você é um especialista em licitações públicas brasileiras.
Analise o texto deste edital e extraia TODOS os itens/lotes.

TEXTO DO EDITAL:
${textoParaAnalise.slice(0, 15000)}

Para cada item, extraia em formato JSON:
{
  "itens": [
    {
      "numero": 1,
      "descricao": "descrição completa do item",
      "unidade": "UN/KG/M/L/etc",
      "quantidade": 100,
      "valor_estimado_unitario": 45.50,
      "valor_estimado_total": 4550.00,
      "codigo_catmat": "123456",
      "codigo_catser": null,
      "especificacoes_tecnicas": "detalhes técnicos mínimos",
      "marca_referencia": null,
      "permite_equivalente": true,
      "criterio_julgamento": "menor_preco_item",
      "exclusivo_me_epp": false,
      "lote": 1
    }
  ],
  "criterio_geral": "menor_preco_item",
  "tipo_licitacao": "pregao_eletronico",
  "exige_proposta_tecnica": false
}

Se não conseguir identificar itens detalhados, crie pelo menos 1 item genérico baseado no objeto da compra.
RESPONDA APENAS COM O JSON VÁLIDO.`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: promptExtracao }],
      }),
    });

    if (!aiResp.ok) {
      throw new Error(`AI request failed: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let itensExtraidos: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        itensExtraidos = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      throw new Error('Falha na extração de itens do edital');
    }

    const itensParaInserir = (itensExtraidos.itens || []).map((item: any) => ({
      licitacao_id,
      empresa_id,
      numero: item.numero || 1,
      lote: item.lote || 1,
      descricao: item.descricao || 'Item não identificado',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      codigo_catmat: item.codigo_catmat || null,
      codigo_catser: item.codigo_catser || null,
      especificacoes_tecnicas: item.especificacoes_tecnicas || null,
      marca_referencia: item.marca_referencia || null,
      permite_equivalente: item.permite_equivalente ?? true,
      criterio_julgamento: item.criterio_julgamento || itensExtraidos.criterio_geral || 'menor_preco_item',
      exclusivo_me_epp: item.exclusivo_me_epp ?? false,
      valor_estimado_unitario: item.valor_estimado_unitario || null,
      valor_estimado_total: item.valor_estimado_total || null,
      status: 'pendente_precificacao',
    }));

    // 4. Salvar itens no banco
    const { data: itensSalvos, error: insertError } = await supabase
      .from('agent_itens_edital')
      .insert(itensParaInserir)
      .select();

    if (insertError) throw insertError;

    // 5. Disparar motor de precificação para cada item
    for (const item of itensSalvos ?? []) {
      await supabase.functions.invoke('agent-precificacao', {
        body: { item_id: item.id, empresa_id },
      }).catch((e: Error) => console.error('Erro ao disparar precificação:', e));
    }

    // 6. Log
    await supabase.from('agent_acoes_log').insert({
      licitacao_id,
      agente: 'agent_extrator_itens',
      acao: 'extracao_itens_edital',
      status: 'sucesso',
      payload_out: {
        total_itens: itensSalvos?.length ?? 0,
        criterio_geral: itensExtraidos.criterio_geral,
        tipo_licitacao: itensExtraidos.tipo_licitacao,
      },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      total_itens: itensSalvos?.length ?? 0,
      criterio: itensExtraidos.criterio_geral,
      itens: itensSalvos,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Extrator Itens error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
