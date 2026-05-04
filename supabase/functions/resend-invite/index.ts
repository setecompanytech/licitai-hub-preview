// @ts-nocheck
// Reenvia o e-mail de convite para um colaborador já cadastrado em empresa_membros
// que ainda não confirmou o acesso (sem senha definida).
// - Apenas admins da empresa podem disparar.
// - Usa inviteUserByEmail novamente, que reenvia o e-mail customizado (template invite.tsx)
//   apontando para /reset-password para definição de senha.
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, empresa_id } = await req.json()
    if (!email || !empresa_id) {
      return new Response(JSON.stringify({ error: 'Email e empresa_id são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verifica se o caller é admin da empresa
    const { data: callerMember } = await adminClient
      .from('empresa_membros')
      .select('papel')
      .eq('user_id', caller.id)
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (!callerMember || callerMember.papel !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem reenviar convites' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Reenvia convite — gera um novo token válido por 24h
    const redirectUrl = 'https://app.praefectus.com.br/reset-password'
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
    })

    if (inviteError) {
      return new Response(JSON.stringify({ error: `Erro ao reenviar convite: ${inviteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Convite reenviado para ${email}.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
