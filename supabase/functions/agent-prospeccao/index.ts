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
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Buscar empresas com agente ativo
    const { data: configs } = await supabase
      .from('agent_configuracoes')
      .select('empresa_id, score_minimo_auto, score_minimo_notif, valor_minimo, valor_maximo')
      .eq('agente_ativo', true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'Nenhuma empresa com agente ativo', duracao_ms: Date.now() - inicio }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let totalProcessados = 0;
    let totalNovos = 0;

    for (const config of configs) {
      // 2. Buscar empresa com configurações de monitoramento
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id, cnae_principal, uf, razao_social')
        .eq('id', config.empresa_id)
        .single();

      if (!empresa) continue;

      // 3. Buscar configuração de monitoramento
      const { data: configMon } = await supabase
        .from('configuracoes')
        .select('palavras_chave, ufs_interesse, cnaes_monitorados, valor_minimo, valor_maximo')
        .eq('user_id', (await supabase.from('empresa_membros').select('user_id').eq('empresa_id', empresa.id).limit(1).single())?.data?.user_id)
        .single();

      // 4. Buscar editais recentes do PNCP (últimas 24h)
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hoje = new Date().toISOString().split('T')[0];

      const { data: editaisCache } = await supabase
        .from('pncp_editais_cache')
        .select('id, titulo, objeto_compra, valor_total_estimado, uf, orgao_nome, modalidade_nome, data_abertura_proposta, cnpj')
        .gte('created_at', `${ontem}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!editaisCache || editaisCache.length === 0) continue;

      for (const edital of editaisCache) {
        // 5. Verificar se já processamos
        const { data: existente } = await supabase
          .from('agent_licitacoes')
          .select('id')
          .eq('empresa_id', empresa.id)
          .eq('pncp_cache_id', edital.id)
          .maybeSingle();

        if (existente) continue;
        totalProcessados++;

        // 6. Calcular score de relevância
        let score = 0;

        // CNAE compatibility (30pts)
        if (empresa.cnae_principal && edital.objeto_compra) {
          const palavrasEmpresa = empresa.cnae_principal.toLowerCase().split(/\s+/);
          const objetoLower = (edital.objeto_compra || '').toLowerCase();
          const matchCnae = palavrasEmpresa.some((p: string) => p.length > 3 && objetoLower.includes(p));
          if (matchCnae) score += 25;
        }

        // Keywords match (25pts)
        if (configMon?.palavras_chave && edital.objeto_compra) {
          const objetoLower = edital.objeto_compra.toLowerCase();
          const matchKw = (configMon.palavras_chave as string[]).some(kw => objetoLower.includes(kw.toLowerCase()));
          if (matchKw) score += 25;
        }

        // UF match (20pts)
        if (empresa.uf && edital.uf && empresa.uf === edital.uf) {
          score += 20;
        } else if (configMon?.ufs_interesse && edital.uf) {
          if ((configMon.ufs_interesse as string[]).includes(edital.uf)) score += 15;
        }

        // Value range (20pts)
        const valorEdital = edital.valor_total_estimado || 0;
        if (valorEdital >= (config.valor_minimo || 0) && valorEdital <= (config.valor_maximo || 999999999)) {
          score += 20;
        }

        // Use IA for refined scoring if available
        if (openaiKey && score >= 30) {
          try {
            const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                  role: 'user',
                  content: `Avalie a compatibilidade (0-100) entre esta empresa e edital.
Empresa: CNAE ${empresa.cnae_principal}, UF ${empresa.uf}
Edital: ${edital.objeto_compra?.slice(0, 200)}, Valor R$ ${valorEdital}, UF ${edital.uf}, Modalidade ${edital.modalidade_nome}
RESPONDA APENAS COM O NÚMERO.`
                }],
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const aiScore = parseInt(aiData.choices?.[0]?.message?.content?.trim() || '0');
              if (!isNaN(aiScore) && aiScore >= 0 && aiScore <= 100) {
                score = Math.round((score + aiScore) / 2); // Average with heuristic
              }
            }
          } catch { /* Use heuristic score */ }
        }

        score = Math.min(100, Math.max(0, score));

        // 7. Tomar decisão
        let decisao: string;
        let motivoDecisao: string;

        if (score >= config.score_minimo_auto) {
          decisao = 'participar';
          motivoDecisao = `Score ${score}/100 — dentro dos critérios automáticos`;
        } else if (score >= config.score_minimo_notif) {
          decisao = 'aguardar_aprovacao';
          motivoDecisao = `Score ${score}/100 — requer aprovação humana`;
        } else {
          decisao = 'descartado';
          motivoDecisao = `Score ${score}/100 — abaixo do mínimo configurado`;
        }

        // 8. Registrar
        const { data: licitacao } = await supabase
          .from('agent_licitacoes')
          .insert({
            empresa_id: empresa.id,
            pncp_cache_id: edital.id,
            score_relevancia: score,
            decisao,
            motivo_decisao: motivoDecisao,
            agente_atual: 'agent_prospeccao',
            ultima_acao: 'avaliacao_inicial',
            data_abertura: edital.data_abertura_proposta,
            proxima_acao: decisao === 'participar' ? 'analisar_edital' : null,
            proxima_execucao: decisao === 'participar'
              ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
              : null,
          })
          .select('id')
          .single();

        totalNovos++;

        // 9. Log
        if (licitacao) {
          await supabase.from('agent_acoes_log').insert({
            licitacao_id: licitacao.id,
            agente: 'agent_prospeccao',
            acao: 'avaliacao_inicial',
            status: 'sucesso',
            payload_out: { score, decisao, motivo: motivoDecisao },
          });
        }

        // 10. Se participar, disparar preparação
        if (decisao === 'participar' && licitacao) {
          await fetch(`${supabaseUrl}/functions/v1/agent-orchestrator`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tipo: 'preparar',
              payload: { licitacao_id: licitacao.id, empresa_id: empresa.id },
            }),
          }).catch(() => { /* Non-blocking */ });
        }

        // 11. Notificação
        const { data: membro } = await supabase
          .from('empresa_membros')
          .select('user_id')
          .eq('empresa_id', empresa.id)
          .limit(1)
          .single();

        if (membro) {
          await supabase.from('notificacoes').insert({
            user_id: membro.user_id,
            tipo: decisao === 'descartado' ? 'info' : 'novo_edital',
            titulo: decisao === 'participar'
              ? `🤖 Agente iniciou participação: ${edital.objeto_compra?.slice(0, 60)}`
              : decisao === 'aguardar_aprovacao'
                ? `⚡ Aprovação necessária: ${edital.objeto_compra?.slice(0, 60)}`
                : `📋 Edital avaliado (descartado): ${edital.objeto_compra?.slice(0, 60)}`,
            mensagem: motivoDecisao,
            url_acao: `/monitoramento-editais`,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      duracao_ms: Date.now() - inicio,
      empresas: configs.length,
      processados: totalProcessados,
      novos: totalNovos,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Prospeccao error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
