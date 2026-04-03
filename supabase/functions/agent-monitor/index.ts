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

    // 1. Buscar licitações em disputa ou com monitoramento ativo
    const { data: licitacoesAtivas } = await supabase
      .from('agent_licitacoes')
      .select('id, empresa_id, pncp_cache_id, decisao, data_abertura, pncp_editais_cache(objeto_compra, orgao_nome)')
      .in('decisao', ['em_disputa', 'participando', 'proposta_enviada'])
      .order('data_abertura', { ascending: true });

    if (!licitacoesAtivas || licitacoesAtivas.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'Nenhuma licitação ativa para monitorar', duracao_ms: Date.now() - inicio }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let alertasGerados = 0;

    for (const lic of licitacoesAtivas) {
      // 2. Verificar chat não respondido
      const { data: chatPendente } = await supabase
        .from('agent_chat_monitor')
        .select('id, conteudo, categoria')
        .eq('licitacao_id', lic.id)
        .eq('requer_acao', true)
        .is('respondido_em', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (chatPendente && chatPendente.length > 0) {
        // Gerar alertas para mensagens pendentes
        const { data: membro } = await supabase
          .from('empresa_membros')
          .select('user_id')
          .eq('empresa_id', lic.empresa_id)
          .limit(1)
          .single();

        if (membro) {
          for (const msg of chatPendente) {
            await supabase.from('notificacoes').insert({
              user_id: membro.user_id,
              tipo: 'urgente',
              titulo: `⚠️ Ação necessária no pregão — ${msg.categoria}`,
              mensagem: msg.conteudo?.slice(0, 200),
              url_acao: `/monitoramento-chat`,
            }).catch(() => {});

            alertasGerados++;
          }
        }
      }

      // 3. Verificar prazos críticos
      const agora = new Date();
      const abertura = lic.data_abertura ? new Date(lic.data_abertura) : null;

      if (abertura) {
        const horasAteAbertura = (abertura.getTime() - agora.getTime()) / (1000 * 60 * 60);

        // Alerta 1h antes da abertura
        if (horasAteAbertura > 0 && horasAteAbertura <= 1 && lic.decisao !== 'em_disputa') {
          await supabase
            .from('agent_licitacoes')
            .update({ decisao: 'em_disputa', ultima_acao: 'abertura_iminente', agente_atual: 'agent_monitor' })
            .eq('id', lic.id);

          await supabase.from('agent_acoes_log').insert({
            licitacao_id: lic.id,
            agente: 'agent_monitor',
            acao: 'transicao_em_disputa',
            status: 'sucesso',
            payload_out: { horas_ate_abertura: horasAteAbertura.toFixed(1) },
          });
        }
      }
    }

    // 4. Log geral
    await supabase.from('agent_acoes_log').insert({
      agente: 'agent_monitor',
      acao: 'ciclo_monitoramento',
      status: 'sucesso',
      payload_out: {
        licitacoes_monitoradas: licitacoesAtivas.length,
        alertas_gerados: alertasGerados,
      },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      licitacoes_monitoradas: licitacoesAtivas.length,
      alertas_gerados: alertasGerados,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Monitor error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
