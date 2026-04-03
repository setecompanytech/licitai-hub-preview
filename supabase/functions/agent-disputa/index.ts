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

    const body = await req.json().catch(() => ({}));
    const { licitacao_id, estado_disputa } = body;

    // Mode 1: Webhook from VPS agent with dispute state
    if (licitacao_id && estado_disputa) {
      const { preco_atual, preco_minimo, tempo_restante, concorrentes, modo_pregao } = estado_disputa;

      // Get agent config
      const { data: lic } = await supabase
        .from('agent_licitacoes')
        .select('empresa_id, preco_minimo')
        .eq('id', licitacao_id)
        .single();

      if (!lic) {
        return new Response(JSON.stringify({ error: 'Licitação não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: config } = await supabase
        .from('agent_configuracoes')
        .select('estrategia_lance, preco_minimo_perc')
        .eq('empresa_id', lic.empresa_id)
        .single();

      const precoMin = lic.preco_minimo || (preco_atual * (config?.preco_minimo_perc || 0.7));

      // Don't bid below minimum
      if (preco_atual <= precoMin) {
        await supabase.from('agent_acoes_log').insert({
          licitacao_id,
          agente: 'agent_disputa',
          acao: 'parar_lance',
          status: 'sucesso',
          payload_out: { motivo: 'Preço mínimo atingido', preco_atual, preco_minimo: precoMin },
        });

        return new Response(JSON.stringify({ estrategia: 'DESISTIR', motivo: 'Preço mínimo atingido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Use AI to determine strategy
      let estrategia = 'AGUARDAR';

      if (lovableKey) {
        try {
          const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: [{
                role: 'user',
                content: `Você é o agente de estratégia de lances PRAEFECTUS.
ESTADO: Preço líder R$ ${preco_atual}, Nosso mínimo R$ ${precoMin.toFixed(2)}, Tempo restante ${Math.floor((tempo_restante || 0) / 60)} min, Modo ${modo_pregao || 'aberto'}, ${(concorrentes || []).length} concorrentes.
OPÇÕES: COBRIR_IMEDIATO, AGUARDAR, LANCE_FINAL, DESISTIR.
RESPONDA APENAS COM UMA OPÇÃO.`
              }],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const resp = aiData.choices?.[0]?.message?.content?.trim().toUpperCase() || 'AGUARDAR';
            if (['COBRIR_IMEDIATO', 'AGUARDAR', 'LANCE_FINAL', 'DESISTIR'].includes(resp)) {
              estrategia = resp;
            }
          }
        } catch { /* Use default */ }
      }

      // Calculate bid value based on strategy
      let valorLance: number | null = null;

      switch (estrategia) {
        case 'COBRIR_IMEDIATO': {
          const reducao = Math.max(0.01, preco_atual * 0.005);
          valorLance = Math.max(preco_atual - reducao, precoMin);
          break;
        }
        case 'LANCE_FINAL': {
          const margem = preco_atual - precoMin;
          valorLance = preco_atual - (margem * 0.3);
          break;
        }
      }

      // Log decision
      await supabase.from('agent_acoes_log').insert({
        licitacao_id,
        agente: 'agent_disputa',
        acao: `estrategia_${estrategia.toLowerCase()}`,
        status: 'sucesso',
        payload_in: estado_disputa,
        payload_out: { estrategia, valor_lance: valorLance },
        duracao_ms: Date.now() - inicio,
      });

      return new Response(JSON.stringify({
        estrategia,
        valor_lance: valorLance,
        preco_minimo: precoMin,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mode 2: General check - find disputes starting soon
    const { data: proximas } = await supabase
      .from('agent_licitacoes')
      .select('id, empresa_id, data_abertura, decisao')
      .in('decisao', ['participando', 'proposta_enviada'])
      .not('data_abertura', 'is', null)
      .order('data_abertura', { ascending: true });

    let transicoes = 0;
    const agora = new Date();

    for (const lic of proximas || []) {
      const abertura = new Date(lic.data_abertura);
      const minAteAbertura = (abertura.getTime() - agora.getTime()) / (1000 * 60);

      if (minAteAbertura <= 30 && minAteAbertura > 0) {
        await supabase
          .from('agent_licitacoes')
          .update({ decisao: 'em_disputa', agente_atual: 'agent_disputa', ultima_acao: 'preparar_disputa' })
          .eq('id', lic.id);
        transicoes++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      transicoes,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Disputa error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
