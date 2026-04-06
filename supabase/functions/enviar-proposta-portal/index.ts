import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropostaPayload {
  portal: string;
  numero_pregao: string;
  itens: Array<{
    numero: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    marca?: string;
    modelo?: string;
    fabricante?: string;
  }>;
  declaracoes: {
    me_epp: boolean;
    inexistencia_fato: boolean;
    menor_aprendiz: boolean;
    elaboracao_independente: boolean;
    reservado_me_epp: boolean;
  };
  anexos_urls?: string[];
  empresa_id: string;
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

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: PropostaPayload = await req.json();

    // Validação básica
    if (!payload.portal || !payload.numero_pregao || !payload.itens?.length || !payload.empresa_id) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: portal, numero_pregao, itens, empresa_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se o usuário é membro da empresa
    const { data: membro } = await supabase
      .from('empresa_membros')
      .select('papel')
      .eq('user_id', user.id)
      .eq('empresa_id', payload.empresa_id)
      .single();

    if (!membro) {
      return new Response(JSON.stringify({ error: 'Você não é membro desta empresa' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar credenciais do portal para esta empresa
    const { data: credencial } = await supabase
      .from('credenciais_portais')
      .select('id, portal, usuario_cifrado, senha_cifrada')
      .eq('empresa_id', payload.empresa_id)
      .eq('portal', payload.portal)
      .single();

    if (!credencial) {
      return new Response(JSON.stringify({ 
        error: `Credenciais do portal "${payload.portal}" não cadastradas. Acesse Robô de Lances → Credenciais.`,
        code: 'CREDENCIAL_NAO_ENCONTRADA'
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar URL do Agente Cloud
    const { data: agente } = await supabase
      .from('agente_externo_config')
      .select('url_base, status, sessoes_ativas, max_sessoes_paralelas')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .single();

    if (!agente) {
      return new Response(JSON.stringify({ 
        error: 'Agente Cloud não configurado ou inativo. Acesse Robô de Lances → Agente Cloud.',
        code: 'AGENTE_INATIVO'
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (agente.sessoes_ativas >= agente.max_sessoes_paralelas) {
      return new Response(JSON.stringify({ 
        error: `Limite de sessões atingido (${agente.sessoes_ativas}/${agente.max_sessoes_paralelas}). Aguarde uma sessão encerrar.`,
        code: 'LIMITE_SESSOES'
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar comando ao Agente Cloud (VPS)
    const agentUrl = agente.url_base.replace(/\/$/, '');
    
    const commandPayload = {
      action: 'enviar_proposta',
      portal: payload.portal,
      numero_pregao: payload.numero_pregao,
      credencial_id: credencial.id,
      empresa_id: payload.empresa_id,
      itens: payload.itens,
      declaracoes: payload.declaracoes,
      anexos_urls: payload.anexos_urls || [],
      user_id: user.id,
      timestamp: new Date().toISOString(),
    };

    let agentResponse: any = null;
    let agentStatus = 'enviado';

    try {
      const resp = await fetch(`${agentUrl}/api/proposta/enviar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Key': Deno.env.get('CRON_SECRET') || '',
        },
        body: JSON.stringify(commandPayload),
        signal: AbortSignal.timeout(30000),
      });

      agentResponse = await resp.json().catch(() => ({ status: 'erro', message: resp.statusText }));
      agentStatus = resp.ok ? 'aceito' : 'erro_agente';
    } catch (fetchErr) {
      agentStatus = 'falha_conexao';
      agentResponse = { error: fetchErr instanceof Error ? fetchErr.message : 'Erro de conexão com o Agente Cloud' };
    }

    // Log da ação
    await supabase.from('agent_acoes_log').insert({
      agente: 'enviar_proposta_portal',
      acao: `proposta_${payload.portal}`,
      status: agentStatus === 'aceito' ? 'sucesso' : 'erro',
      payload_in: { portal: payload.portal, pregao: payload.numero_pregao, itens_count: payload.itens.length },
      payload_out: agentResponse,
      duracao_ms: Date.now() - inicio,
      erro_msg: agentStatus !== 'aceito' ? JSON.stringify(agentResponse) : null,
    });

    // Registrar na sessão do agente se aceito
    if (agentStatus === 'aceito') {
      await supabase.from('agent_sessoes').insert({
        empresa_id: payload.empresa_id,
        portal: payload.portal,
        status: 'proposta_em_envio',
        ativa: true,
        iniciada_em: new Date().toISOString(),
      });
    }

    const responseBody = {
      ok: agentStatus === 'aceito',
      status: agentStatus,
      portal: payload.portal,
      numero_pregao: payload.numero_pregao,
      itens_enviados: payload.itens.length,
      agent_response: agentResponse,
      duracao_ms: Date.now() - inicio,
      mensagem: agentStatus === 'aceito' 
        ? `Proposta enviada ao Agente Cloud para cadastro no ${payload.portal}. Acompanhe o progresso no Monitoramento de Chat.`
        : `Falha ao conectar com o Agente Cloud: ${agentResponse?.error || 'Verifique se o agente está online.'}`,
    };

    return new Response(JSON.stringify(responseBody), {
      status: agentStatus === 'aceito' ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('enviar-proposta-portal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno',
      duracao_ms: Date.now() - inicio,
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
