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

    // 1. Verificar contratos com alertas de prazo
    const { data: contratos } = await supabase
      .from('agent_contratos')
      .select('*, agent_licitacoes(empresa_id)')
      .in('status', ['vigente', 'aguardando_assinatura']);

    if (!contratos || contratos.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: 'Nenhum contrato ativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let alertasGerados = 0;
    const agora = new Date();

    for (const contrato of contratos) {
      const empresaId = contrato.agent_licitacoes?.empresa_id;
      if (!empresaId) continue;

      // 2. Verificar vencimento do contrato
      if (contrato.data_fim) {
        const fim = new Date(contrato.data_fim);
        const diasRestantes = Math.ceil((fim.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));

        const alertaDias = [90, 60, 30, 15, 7];
        for (const dias of alertaDias) {
          if (diasRestantes === dias) {
            const { data: membro } = await supabase
              .from('empresa_membros')
              .select('user_id')
              .eq('empresa_id', empresaId)
              .limit(1)
              .single();

            if (membro) {
              await supabase.from('notificacoes').insert({
                user_id: membro.user_id,
                tipo: diasRestantes <= 15 ? 'urgente' : 'info',
                titulo: `📋 Contrato ${contrato.numero_contrato} vence em ${diasRestantes} dias`,
                mensagem: `Contrato com ${contrato.orgao} para "${contrato.objeto?.slice(0, 80)}" vence em ${contrato.data_fim}.`,
                url_acao: '/gestao-contratos',
              }).catch(() => {});

              alertasGerados++;
            }
          }
        }
      }

      // 3. Verificar reajuste pendente
      if (contrato.proximo_reajuste) {
        const reajuste = new Date(contrato.proximo_reajuste);
        const diasAteReajuste = Math.ceil((reajuste.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));

        if (diasAteReajuste >= 0 && diasAteReajuste <= 30) {
          await supabase.from('agent_acoes_log').insert({
            licitacao_id: contrato.licitacao_id,
            agente: 'agent_contrato',
            acao: 'alerta_reajuste',
            status: 'sucesso',
            payload_out: {
              contrato_id: contrato.id,
              indice: contrato.indice_reajuste,
              dias_ate_reajuste: diasAteReajuste,
            },
          });
        }
      }

      // 4. Assinatura pendente — verificar prazo
      if (contrato.status === 'aguardando_assinatura') {
        const criacao = new Date(contrato.created_at);
        const diasDesdeConvocacao = Math.ceil((agora.getTime() - criacao.getTime()) / (1000 * 60 * 60 * 24));

        if (diasDesdeConvocacao >= 3) {
          const { data: membro } = await supabase
            .from('empresa_membros')
            .select('user_id')
            .eq('empresa_id', empresaId)
            .limit(1)
            .single();

          if (membro) {
            await supabase.from('notificacoes').insert({
              user_id: membro.user_id,
              tipo: 'urgente',
              titulo: `⚠️ Contrato ${contrato.numero_contrato} aguardando assinatura há ${diasDesdeConvocacao} dias`,
              mensagem: `Prazo de assinatura geralmente é de 5 dias úteis. Ação urgente necessária.`,
              url_acao: '/gestao-contratos',
            }).catch(() => {});

            alertasGerados++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      contratos_verificados: contratos.length,
      alertas_gerados: alertasGerados,
      duracao_ms: Date.now() - inicio,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Agent Contrato error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
