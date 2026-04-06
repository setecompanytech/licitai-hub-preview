const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'npm:@supabase/supabase-js@2'

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
    } else {
      // Invite new user via email — Supabase sends the invite email automatically
      const redirectUrl = 'https://app.praefectus.com.br'
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { nome_completo: nome || email },
        redirectTo: redirectUrl,
      })

      if (inviteError) {
        return new Response(JSON.stringify({ error: `Erro ao enviar convite: ${inviteError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      userId = inviteData.user.id
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
    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      invited: isNew,
      message: isNew
        ? `Convite enviado para ${email}. O colaborador receberá um e-mail para criar sua senha.`
        : `Usuário ${email} já possui conta e foi vinculado à empresa.`,
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
