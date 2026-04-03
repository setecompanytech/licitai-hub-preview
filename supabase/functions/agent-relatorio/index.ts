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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const tipo = body.tipo || 'diario';

    // 1. Buscar todas as empresas com agente ativo
    const { data: configs } = await supabase
      .from('agent_configuracoes')
      .select('empresa_id')
      .eq('agente_ativo', true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'Nenhuma empresa com agente ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    for (const config of configs) {
      // 2. Calcular métricas
      const { data: metricas } = await supabase.rpc('calcular_metricas_agente', {
        p_empresa_id: config.empresa_id,
      });

      // 3. Buscar ações recentes (últimas 24h)
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: acoesRecentes } = await supabase
        .from('agent_acoes_log')
        .select('agente, acao, status, created_at')
        .gte('created_at', ontem)
        .order('created_at', { ascending: false })
        .limit(50);

      // 4. Criar notificação com resumo
      const { data: membro } = await supabase
        .from('empresa_membros')
        .select('user_id')
        .eq('empresa_id', config.empresa_id)
        .limit(1)
        .single();

      if (membro && metricas) {
        const m = metricas as Record<string, number>;
        const resumo = `📊 Resumo ${tipo}: ${m.total_monitoradas || 0} monitoradas | ${m.em_andamento || 0} em andamento | ${m.em_disputa || 0} em disputa | ${m.vitorias_30d || 0} vitórias (30d) | Taxa: ${m.taxa_vitoria || 0}%`;

        await supabase.from('notificacoes').insert({
          user_id: membro.user_id,
          tipo: 'info',
          titulo: `🤖 Relatório ${tipo === 'diario' ? 'Diário' : 'Semanal'} do Agente`,
          mensagem: resumo,
          url_acao: '/agente',
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      tipo,
      empresas: configs.length,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Relatorio error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
