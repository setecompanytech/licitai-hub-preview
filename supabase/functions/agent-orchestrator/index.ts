import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENTES: Record<string, string> = {
  'prospectar': 'agent-prospeccao',
  'preparar': 'agent-preparacao',
  'disputar': 'agent-disputa',
  'monitorar': 'agent-monitor',
  'contrato': 'agent-contrato',
  'juridico': 'agent-juridico-sync',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { tipo, payload } = await req.json();

    const funcao = AGENTES[tipo];
    if (!funcao) {
      return new Response(
        JSON.stringify({ erro: `Tipo de agente desconhecido: ${tipo}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enqueue via pgmq
    await supabase.rpc('enqueue_email', {
      queue_name: `agent_${tipo}`,
      payload: { ...payload, timestamp: new Date().toISOString(), agente: funcao },
    });

    // Log orchestration action
    await supabase.from('agent_acoes_log').insert({
      agente: 'orchestrator',
      acao: `dispatch_${tipo}`,
      status: 'sucesso',
      payload_in: payload,
      licitacao_id: payload?.licitacao_id || null,
    });

    // Invoke the target agent function
    const invokeResp = await fetch(`${supabaseUrl}/functions/v1/${funcao}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await invokeResp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ ok: true, agente: funcao, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
