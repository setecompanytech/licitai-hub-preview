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

    // For confirmed users: generateLink via admin API (no rate limit) then email via Resend.
    // /auth/v1/recover (public endpoint) has strict Supabase rate limits — avoided here.
    async function sendRecoveryEmail(targetEmail: string): Promise<boolean> {
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: targetEmail,
        options: { redirectTo: redirectUrl },
      })
      if (linkError || !linkData?.properties?.hashed_token) return false

      // Point to our own app instead of Supabase's action_link (which hits
      // /auth/v1/verify directly and consumes the one-time token on any GET,
      // including automated email link-prefetch scans). Our page only calls
      // verifyOtp() client-side when a real browser actually loads it.
      const actionLink = `${redirectUrl}?token_hash=${linkData.properties.hashed_token}&type=recovery`
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (!resendKey) return false

      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PRAEFECTUS <noreply@praefectus.com.br>',
          to: [targetEmail],
          subject: 'Você foi adicionado como colaborador — PRAEFECTUS',
          html: `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
<tr><td style="background:#b45309;padding:24px 32px"><h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px">PRAEFECTUS</h1></td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 16px;color:#111827">Você foi adicionado como colaborador</h2>
<p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">Clique no botão abaixo para definir sua senha e acessar a plataforma.</p>
<div style="text-align:center;margin:24px 0">
<a href="${actionLink}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600">Definir Senha de Acesso</a>
</div>
<p style="margin:24px 0 0;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px">Link direto: <a href="${actionLink}" style="color:#b45309">${actionLink}</a></p>
</td></tr></table></td></tr></table></body></html>`,
        }),
      }).catch(() => null)

      return emailResp?.ok === true
    }

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

          // 2ª tentativa (fallback): envia recovery pelo endpoint público (dispara o hook de e-mail).
          // Força confirmação antes para que o /recover funcione em contas ainda não confirmadas.
          if (notConfirmed) {
            await adminClient.auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => {})
          }

          const recOk = await sendRecoveryEmail(email)
          if (recOk) {
            emailFlow = 'recovery'
            lastEmailError = null
          } else {
            lastEmailError = `${lastEmailError} | recovery: falhou`
          }
        }
      } else {
        // Usuário ativo e confirmado: envia recovery pelo endpoint público (dispara o hook de e-mail).
        const recOk = await sendRecoveryEmail(email)
        if (recOk) {
          emailFlow = 'recovery'
        } else {
          lastEmailError = 'recovery: falhou'
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
