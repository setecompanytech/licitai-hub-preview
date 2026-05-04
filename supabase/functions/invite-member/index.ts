// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

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

    // Verify the caller is authenticated
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

    const { email, nome, papel, equipe, permissoes, empresa_id } = await req.json()

    if (!email || !empresa_id) {
      return new Response(JSON.stringify({ error: 'Email e empresa_id são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the caller is admin of this empresa
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: callerMember } = await adminClient
      .from('empresa_membros')
      .select('papel')
      .eq('user_id', caller.id)
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (!callerMember || callerMember.papel !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem convidar membros' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string
    let emailFlow: 'invite' | 'recovery' | 'none' = 'none'

    const redirectUrl = 'https://app.praefectus.com.br/reset-password'

    if (existingUser) {
      userId = existingUser.id

      // Check if already a member
      const { data: existingMember } = await adminClient
        .from('empresa_membros')
        .select('id')
        .eq('user_id', userId)
        .eq('empresa_id', empresa_id)
        .maybeSingle()

      if (existingMember) {
        return new Response(JSON.stringify({ error: 'Este usuário já é membro desta empresa' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Usuário existe na auth mas não é membro desta empresa.
      // Detecta o estado real do usuário no auth para decidir o fluxo correto.
      // CRÍTICO: É OBRIGATÓRIO enviar um e-mail (invite ou recovery). Se ambos
      // falharem, retornamos erro para que o admin saiba que precisa reenviar.
      const neverSignedIn = !existingUser.last_sign_in_at
      const notConfirmed = !existingUser.email_confirmed_at
      const isUnconfirmed = neverSignedIn || notConfirmed

      let lastEmailError: string | null = null

      if (isUnconfirmed) {
        // Usuário não confirmado: SEMPRE força reenvio do convite.
        // 1ª tentativa: inviteUserByEmail (recria token de convite)
        const { error: reinviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { nome_completo: nome || email, empresa_id, equipe: Array.isArray(equipe) ? equipe[0] : equipe },
          redirectTo: redirectUrl,
        })

        if (!reinviteError) {
          emailFlow = 'invite'
        } else {
          lastEmailError = reinviteError.message
          console.warn('[invite-member] inviteUserByEmail falhou, tentando recovery:', reinviteError.message)

          // 2ª tentativa (fallback): gera link de recovery explícito.
          // Se o usuário ainda não tem e-mail confirmado, força a confirmação
          // antes para que o link de recovery funcione corretamente.
          if (notConfirmed) {
            const { error: confirmError } = await adminClient.auth.admin.updateUserById(userId, {
              email_confirm: true,
            })
            if (confirmError) {
              console.warn('[invite-member] updateUserById (email_confirm) falhou:', confirmError.message)
            }
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
        // Usuário ativo e confirmado: envia recovery para definir/redefinir senha.
        const { error: recError } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: redirectUrl },
        })
        if (!recError) {
          emailFlow = 'recovery'
        } else {
          lastEmailError = recError.message
          console.warn('[invite-member] recovery falhou, tentando invite:', recError.message)

          // Fallback: tenta invite mesmo assim.
          const { error: inviteFallbackError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: { nome_completo: nome || email, empresa_id, equipe: Array.isArray(equipe) ? equipe[0] : equipe },
            redirectTo: redirectUrl,
          })
          if (!inviteFallbackError) {
            emailFlow = 'invite'
            lastEmailError = null
          } else {
            lastEmailError = `${lastEmailError} | invite: ${inviteFallbackError.message}`
          }
        }
      }

      // Se nenhum e-mail foi enviado, aborta — não vincula o membro silenciosamente.
      if (emailFlow === 'none') {
        return new Response(JSON.stringify({
          error: `Não foi possível enviar o e-mail de acesso para ${email}. Detalhes: ${lastEmailError || 'erro desconhecido'}. Tente novamente em alguns instantes ou use "Reenviar convite".`,
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Convida o novo usuário por e-mail. O Supabase envia o e-mail de convite
      // automaticamente (template 'invite' já customizado em _shared/email-templates).
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { nome_completo: nome || email, empresa_id, equipe: Array.isArray(equipe) ? equipe[0] : equipe },
        redirectTo: redirectUrl,
      })

      if (inviteError) {
        return new Response(JSON.stringify({ error: `Erro ao enviar convite: ${inviteError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = inviteData.user.id
      emailFlow = 'invite'
    }

    // Add as member
    const equipePrincipal = Array.isArray(equipe) ? equipe[0] : (equipe || 'geral')
    const { error: memberError } = await adminClient.from('empresa_membros').insert({
      empresa_id,
      user_id: userId,
      papel: papel || 'operador',
      equipe: equipePrincipal,
      nome: nome || email,
      email,
      permissoes: permissoes || [equipePrincipal],
    })

    if (memberError) {
      return new Response(JSON.stringify({ error: `Erro ao vincular membro: ${memberError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isNew = !existingUser
    let message: string
    if (isNew) {
      message = `Convite enviado para ${email}. O colaborador receberá um e-mail para criar sua senha.`
    } else if (emailFlow === 'invite') {
      message = `Vínculo criado e novo convite enviado para ${email}. O colaborador receberá um e-mail para definir a senha.`
    } else if (emailFlow === 'recovery') {
      message = `Vínculo criado. Enviamos um e-mail para ${email} para que ele defina/redefina a senha de acesso.`
    } else {
      message = `Usuário ${email} vinculado à empresa, mas houve falha ao enviar o e-mail. Use "Reenviar convite" na lista.`
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      invited: isNew,
      email_flow: emailFlow,
      message,
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
