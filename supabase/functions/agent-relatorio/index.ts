/**
 * agent-relatorio — Geração automatizada de relatórios gerenciais
 * 
 * Gera relatórios diários e semanais com:
 * - Métricas consolidadas por empresa
 * - Resumo de ações dos agentes (últimas 24h/7d)
 * - Análise de performance (taxa de vitória, valor ganho)
 * - Alertas de itens pendentes de aprovação
 * - Notificação ao responsável da empresa
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResumoAgente {
  agente: string;
  total_acoes: number;
  sucessos: number;
  erros: number;
  duracao_media_ms: number;
}

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
    const periodoHoras = tipo === 'semanal' ? 168 : 24;
    const dataLimite = new Date(Date.now() - periodoHoras * 60 * 60 * 1000).toISOString();

    // 1. Buscar empresas com agente ativo
    const { data: configs } = await supabase
      .from('agent_configuracoes')
      .select('empresa_id')
      .eq('agente_ativo', true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'Nenhuma empresa com agente ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const relatorios: any[] = [];

    for (const config of configs) {
      const empresaId = config.empresa_id;

      // 2. Métricas consolidadas via RPC
      const { data: metricas } = await supabase.rpc('calcular_metricas_agente', {
        p_empresa_id: empresaId,
      });

      // 3. Ações dos agentes no período
      const { data: acoesRecentes } = await supabase
        .from('agent_acoes_log')
        .select('agente, acao, status, duracao_ms, created_at, erro_msg')
        .gte('created_at', dataLimite)
        .order('created_at', { ascending: false })
        .limit(200);

      // Agrupar ações por agente
      const resumoPorAgente = new Map<string, ResumoAgente>();
      for (const acao of acoesRecentes || []) {
        const key = acao.agente;
        if (!resumoPorAgente.has(key)) {
          resumoPorAgente.set(key, { agente: key, total_acoes: 0, sucessos: 0, erros: 0, duracao_media_ms: 0 });
        }
        const r = resumoPorAgente.get(key)!;
        r.total_acoes++;
        if (acao.status === 'sucesso') r.sucessos++;
        if (acao.status === 'erro') r.erros++;
        r.duracao_media_ms += acao.duracao_ms || 0;
      }
      // Calcular média
      for (const r of resumoPorAgente.values()) {
        r.duracao_media_ms = r.total_acoes > 0 ? Math.round(r.duracao_media_ms / r.total_acoes) : 0;
      }

      // 4. Itens pendentes de aprovação
      const { data: itensPendentes, count: countPendentes } = await supabase
        .from('agent_itens_edital')
        .select('id, descricao, preco_proposta, status', { count: 'exact' })
        .eq('empresa_id', empresaId)
        .eq('status', 'aguardando_aprovacao_preco')
        .limit(10);

      // 5. Licitações com erro
      const { data: licitacoesErro } = await supabase
        .from('agent_licitacoes')
        .select('id, erro_log, proxima_acao')
        .eq('empresa_id', empresaId)
        .not('erro_log', 'is', null)
        .limit(5);

      // 6. Contratos com vencimento próximo (30 dias)
      const em30Dias = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const { data: contratosVencendo } = await supabase
        .from('agent_contratos')
        .select('id, numero_contrato, orgao, data_fim')
        .eq('empresa_id', empresaId)
        .lte('data_fim', em30Dias)
        .gte('data_fim', new Date().toISOString().split('T')[0])
        .limit(10);

      // 7. Criar notificação
      const { data: membro } = await supabase
        .from('empresa_membros')
        .select('user_id')
        .eq('empresa_id', empresaId)
        .limit(1)
        .single();

      if (membro && metricas) {
        const m = metricas as Record<string, number>;
        
        const linhas: string[] = [];
        linhas.push(`Período: ${tipo === 'semanal' ? 'Últimos 7 dias' : 'Últimas 24h'}`);
        linhas.push(`Monitoradas: ${m.total_monitoradas || 0} | Em andamento: ${m.em_andamento || 0} | Em disputa: ${m.em_disputa || 0}`);
        linhas.push(`Vitórias (30d): ${m.vitorias_30d || 0} | Taxa: ${m.taxa_vitoria || 0}% | Valor ganho: R$ ${((m.valor_total_vitorias || 0) / 100).toLocaleString('pt-BR')}`);
        
        if ((countPendentes || 0) > 0) {
          linhas.push(`Itens aguardando aprovação de preço: ${countPendentes}`);
        }
        if (licitacoesErro && licitacoesErro.length > 0) {
          linhas.push(`Licitações com erro: ${licitacoesErro.length}`);
        }
        if (contratosVencendo && contratosVencendo.length > 0) {
          linhas.push(`Contratos vencendo em 30 dias: ${contratosVencendo.length}`);
        }

        // Resumo de agentes
        const agentesAtivos = Array.from(resumoPorAgente.values()).filter(a => a.total_acoes > 0);
        if (agentesAtivos.length > 0) {
          const totalAcoes = agentesAtivos.reduce((s, a) => s + a.total_acoes, 0);
          const totalErros = agentesAtivos.reduce((s, a) => s + a.erros, 0);
          linhas.push(`Agentes: ${agentesAtivos.length} ativos | ${totalAcoes} ações | ${totalErros} erros`);
        }

        await supabase.from('notificacoes').insert({
          user_id: membro.user_id,
          tipo: 'info',
          titulo: `Relatório ${tipo === 'diario' ? 'Diário' : 'Semanal'} do Agente`,
          mensagem: linhas.join('\n'),
          url_acao: '/agente',
        }).catch(() => {});

        relatorios.push({
          empresa_id: empresaId,
          metricas: m,
          agentes: agentesAtivos,
          pendentes: countPendentes || 0,
          erros: licitacoesErro?.length || 0,
          contratos_vencendo: contratosVencendo?.length || 0,
        });
      }
    }

    // Log do relatório
    await supabase.from('agent_acoes_log').insert({
      agente: 'agent_relatorio',
      acao: `relatorio_${tipo}`,
      status: 'sucesso',
      payload_out: {
        empresas_processadas: relatorios.length,
        tipo,
      },
      duracao_ms: Date.now() - inicio,
    });

    return new Response(JSON.stringify({
      ok: true,
      tipo,
      empresas: relatorios.length,
      relatorios,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Relatorio error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
