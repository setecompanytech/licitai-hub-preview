/**
 * agent-orchestrator — Orquestrador central de agentes autônomos
 * 
 * Consolida o roteamento de agentes via pgmq, com:
 * - Retry com backoff exponencial
 * - Dead Letter Queue (DLQ) para falhas persistentes
 * - Métricas de execução por agente
 * - Suporte a prioridades de execução
 * - Log auditável de cada ação
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENTES: Record<string, { funcao: string; timeout_ms: number; max_retries: number; prioridade: number }> = {
  'prospectar': { funcao: 'agent-prospeccao', timeout_ms: 30000, max_retries: 3, prioridade: 1 },
  'preparar': { funcao: 'agent-preparacao', timeout_ms: 60000, max_retries: 2, prioridade: 2 },
  'disputar': { funcao: 'agent-disputa', timeout_ms: 45000, max_retries: 3, prioridade: 1 },
  'monitorar': { funcao: 'agent-monitor', timeout_ms: 30000, max_retries: 2, prioridade: 3 },
  'contrato': { funcao: 'agent-contrato', timeout_ms: 30000, max_retries: 2, prioridade: 3 },
  'juridico': { funcao: 'agent-juridico-sync', timeout_ms: 60000, max_retries: 2, prioridade: 2 },
  'precificar': { funcao: 'agent-precificacao', timeout_ms: 90000, max_retries: 2, prioridade: 2 },
  'relatorio': { funcao: 'agent-relatorio', timeout_ms: 30000, max_retries: 1, prioridade: 4 },
  'extrator': { funcao: 'agent-extrator-itens', timeout_ms: 120000, max_retries: 2, prioridade: 2 },
};

async function invokeAgent(
  supabaseUrl: string,
  serviceRoleKey: string,
  funcao: string,
  payload: any,
  timeoutMs: number,
): Promise<{ ok: boolean; result: any; duracao_ms: number; status_code: number }> {
  const inicio = Date.now();
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${funcao}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const duracao_ms = Date.now() - inicio;
    const result = await resp.json().catch(() => ({}));

    return {
      ok: resp.ok,
      result,
      duracao_ms,
      status_code: resp.status,
    };
  } catch (error) {
    return {
      ok: false,
      result: { error: error instanceof Error ? error.message : 'Timeout ou erro de rede' },
      duracao_ms: Date.now() - inicio,
      status_code: 0,
    };
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    const { tipo, payload, prioridade_override } = await req.json();

    const agente = AGENTES[tipo];
    if (!agente) {
      return new Response(
        JSON.stringify({ erro: `Tipo de agente desconhecido: ${tipo}. Disponíveis: ${Object.keys(AGENTES).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { funcao, timeout_ms, max_retries } = agente;

    // ═══ ENQUEUE VIA PGMQ ═══
    const queuePayload = {
      ...payload,
      timestamp: new Date().toISOString(),
      agente: funcao,
      tipo,
      tentativa: 1,
      max_retries,
    };

    try {
      await supabase.rpc('enqueue_email', {
        queue_name: `agent_${tipo}`,
        payload: queuePayload,
      });
    } catch (e) {
      console.warn('pgmq enqueue falhou (fila pode não existir):', e);
    }

    // ═══ LOG DE DISPATCH ═══
    await supabase.from('agent_acoes_log').insert({
      agente: 'orchestrator',
      acao: `dispatch_${tipo}`,
      status: 'iniciado',
      payload_in: payload,
      licitacao_id: payload?.licitacao_id || null,
    });

    // ═══ INVOCAR AGENTE COM RETRY E BACKOFF ═══
    let lastResult: any = null;
    let sucesso = false;

    for (let tentativa = 1; tentativa <= max_retries; tentativa++) {
      console.log(`[orchestrator] Invocando ${funcao} (tentativa ${tentativa}/${max_retries})`);

      const resultado = await invokeAgent(supabaseUrl, serviceRoleKey, funcao, payload, timeout_ms);
      lastResult = resultado;

      if (resultado.ok) {
        sucesso = true;

        // Log de sucesso
        await supabase.from('agent_acoes_log').insert({
          agente: 'orchestrator',
          acao: `resultado_${tipo}`,
          status: 'sucesso',
          payload_out: {
            tentativa,
            status_code: resultado.status_code,
            duracao_ms: resultado.duracao_ms,
            resultado: resultado.result,
          },
          licitacao_id: payload?.licitacao_id || null,
          duracao_ms: resultado.duracao_ms,
        });

        break;
      }

      // Falha — aplicar backoff exponencial antes de retry
      const backoff = Math.min(1000 * Math.pow(2, tentativa - 1), 10000);
      console.warn(`[orchestrator] ${funcao} falhou (${resultado.status_code}). Retry em ${backoff}ms`);

      await supabase.from('agent_acoes_log').insert({
        agente: 'orchestrator',
        acao: `retry_${tipo}`,
        status: 'erro',
        erro_msg: `Tentativa ${tentativa} falhou: HTTP ${resultado.status_code}`,
        payload_out: { tentativa, backoff, resultado: resultado.result },
        licitacao_id: payload?.licitacao_id || null,
        duracao_ms: resultado.duracao_ms,
      });

      if (tentativa < max_retries) {
        await sleep(backoff);
      }
    }

    // ═══ DLQ PARA FALHAS PERSISTENTES ═══
    if (!sucesso) {
      console.error(`[orchestrator] ${funcao} falhou após ${max_retries} tentativas. Movendo para DLQ.`);

      try {
        await supabase.rpc('enqueue_email', {
          queue_name: `dlq_agent_${tipo}`,
          payload: {
            ...queuePayload,
            erro: lastResult?.result?.error || 'Falha persistente',
            tentativas_esgotadas: max_retries,
            falhou_em: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.warn('DLQ enqueue falhou:', e);
      }

      await supabase.from('agent_acoes_log').insert({
        agente: 'orchestrator',
        acao: `dlq_${tipo}`,
        status: 'erro',
        erro_msg: `Falha persistente após ${max_retries} tentativas`,
        payload_out: lastResult,
        licitacao_id: payload?.licitacao_id || null,
        duracao_ms: Date.now() - inicio,
      });

      // Atualizar status da licitação se aplicável
      if (payload?.licitacao_id) {
        await supabase.from('agent_licitacoes').update({
          erro_log: `Agente ${tipo} falhou após ${max_retries} tentativas: ${lastResult?.result?.error || 'Erro desconhecido'}`,
          tentativas: max_retries,
        }).eq('id', payload.licitacao_id);
      }
    }

    return new Response(
      JSON.stringify({
        ok: sucesso,
        agente: funcao,
        tipo,
        tentativas: sucesso ? undefined : max_retries,
        result: lastResult?.result,
        duracao_ms: Date.now() - inicio,
      }),
      {
        status: sucesso ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Orchestrator error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno do orquestrador',
        duracao_ms: Date.now() - inicio,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
