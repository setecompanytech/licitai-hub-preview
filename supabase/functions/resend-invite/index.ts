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

    // Detecta o estado do usuário e escolhe o fluxo apropriado.
    const redirectUrl = 'https://app.praefectus.com.br/reset-password'
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    const notConfirmed = !existingUser?.email_confirmed_at
    const neverSignedIn = !existingUser?.last_sign_in_at
    const isUnconfirmed = notConfirmed || neverSignedIn

    let emailFlow: 'invite' | 'recovery' | 'none' = 'none'
    let lastEmailError: string | null = null

    if (isUnconfirmed || !existingUser) {
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirectUrl,
      })
      if (!inviteError) {
        emailFlow = 'invite'
      } else {
        lastEmailError = inviteError.message
        // Fallback para recovery — força confirmar e-mail antes
        if (existingUser && notConfirmed) {
          await adminClient.auth.admin.updateUserById(existingUser.id, { email_confirm: true }).catch(() => {})
        }
        const { error: recError } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: redirectUrl },
        })
        if (!recError) {
          emailFlow = 'recovery'
          lastEmailError = null
        } else {
          lastEmailError = `${lastEmailError} | recovery: ${recError.message}`
        }
      }
    } else {
      // Usuário já confirmado e ativo — envia recovery
      const { error: recError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: redirectUrl },
      })
      if (!recError) {
        emailFlow = 'recovery'
      } else {
        lastEmailError = recError.message
        const { error: inviteFallback } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirectUrl,
        })
        if (!inviteFallback) {
          emailFlow = 'invite'
          lastEmailError = null
        } else {
          lastEmailError = `${lastEmailError} | invite: ${inviteFallback.message}`
        }
      }
    }

    if (emailFlow === 'none') {
      return new Response(JSON.stringify({
        error: `Não foi possível reenviar o e-mail para ${email}. Detalhes: ${lastEmailError || 'erro desconhecido'}.`,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      email_flow: emailFlow,
      message: emailFlow === 'invite'
        ? `Convite reenviado para ${email}. O colaborador receberá um e-mail para criar a senha.`
        : `E-mail de redefinição de senha enviado para ${email}.`,
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
