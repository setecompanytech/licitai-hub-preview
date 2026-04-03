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

    const { licitacao_id, empresa_id } = await req.json();

    if (!licitacao_id || !empresa_id) {
      return new Response(JSON.stringify({ error: 'licitacao_id e empresa_id obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Buscar licitação e edital
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

    // 2. Análise do edital via IA
    let analiseEdital = null;
    if (lovableKey && edital) {
      try {
        const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'system',
              content: 'Você é um analista de licitações. Analise o edital e retorne um JSON com: {resumo, criterio_julgamento, documentos_habilitacao: string[], prazos_criticos: {proposta, habilitacao, recurso}, riscos: [{descricao, severidade}], recomendacao: "PARTICIPAR"|"CAUTELA"|"DESCARTAR"}'
            }, {
              role: 'user',
              content: `Analise este edital:
Objeto: ${edital.objeto_compra}
Órgão: ${edital.orgao_nome}
Modalidade: ${edital.modalidade_nome}
Valor estimado: R$ ${edital.valor_total_estimado}
Data abertura: ${edital.data_abertura_proposta}
UF: ${edital.uf}`
            }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          try {
            // Try to parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              analiseEdital = JSON.parse(jsonMatch[0]);
            }
          } catch { analiseEdital = { resumo: content }; }
        }
      } catch (e) {
        console.error('AI analysis failed:', e);
      }
    }

    // 3. Verificar documentos de habilitação
    const { data: docs } = await supabase
      .from('agent_documentos')
      .select('tipo, status, validade')
      .eq('empresa_id', empresa_id);

    const docsVencidos = (docs || []).filter(d => d.status === 'vencido' || d.status === 'vencendo');
    const docsFaltantes = (docs || []).filter(d => d.status === 'faltante');

    // 4. Atualizar licitação com resultados
    await supabase
      .from('agent_licitacoes')
      .update({
        agente_atual: 'agent_preparacao',
        ultima_acao: 'analise_edital',
        proxima_acao: docsVencidos.length > 0 || docsFaltantes.length > 0
          ? 'resolver_pendencias_docs'
          : 'montar_proposta',
        proxima_execucao: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .eq('id', licitacao_id);

    // 5. Log
    await supabase.from('agent_acoes_log').insert({
      licitacao_id,
      agente: 'agent_preparacao',
      acao: 'analise_edital',
      status: 'sucesso',
      payload_out: {
        analise: analiseEdital,
        docs_vencidos: docsVencidos.length,
        docs_faltantes: docsFaltantes.length,
      },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      analise: analiseEdital,
      pendencias: {
        docs_vencidos: docsVencidos,
        docs_faltantes: docsFaltantes,
      },
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Preparacao error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
