// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const equipeLabels: Record<string, string> = {
  geral: 'Geral',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  logistica: 'Logística',
  juridico: 'Jurídico',
  contabil: 'Contábil',
  licitacoes: 'Licitações',
  documentos: 'Documentos',
}

function capitalizar(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

Deno.serve(async (req) => {
  const cors = CORS_HEADERS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    // Sem verificação de JWT — chamada logo após signUp, antes de sessão confirmada.
    // Segurança garantida pelo token criptográfico do convite (64-char hex).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { token, user_id, email, nome } = await req.json()

    if (!token || !user_id || !email || !nome) {
      return new Response(JSON.stringify({ error: 'token, user_id, email e nome são obrigatórios' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 2. Buscar o convite pelo token
    const { data: convite, error: conviteError } = await adminClient
      .from('empresa_convites')
      .select('id, empresa_id, equipe, papel, email_setor, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle()

    if (conviteError || !convite) {
      return new Response(JSON.stringify({ error: 'Convite não encontrado' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (convite.accepted_at) {
      return new Response(JSON.stringify({ error: 'Convite já utilizado' }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(convite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Convite expirado' }), {
        status: 410,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Verificar conflito antes do insert para retornar mensagem clara
    const { data: existingMember } = await adminClient
      .from('empresa_membros')
      .select('id')
      .eq('user_id', user_id)
      .eq('empresa_id', convite.empresa_id)
      .maybeSingle()

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'Este usuário já é membro desta empresa' }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 3. Inserir em empresa_membros
    const nomeSetor = `Setor ${equipeLabels[convite.equipe] ?? capitalizar(convite.equipe)}`
    const { error: memberError } = await adminClient
      .from('empresa_membros')
      .insert({
        user_id,
        empresa_id: convite.empresa_id,
        equipe: convite.equipe,
        papel: convite.papel,
        nome: nomeSetor,
        email: convite.email_setor,
        login_individual: email,
        nome_individual: nome,
        identificacao_completa: true,
      })

    if (memberError) {
      // 23505 = unique_violation (race condition: user_id + empresa_id duplicado)
      if (memberError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Este usuário já é membro desta empresa' }), {
          status: 409,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      // 22P02 = invalid_text_representation (papel inválido para o ENUM empresa_papel)
      if (memberError.code === '22P02') {
        return new Response(JSON.stringify({ error: `Papel inválido no convite: "${convite.papel}". Valores aceitos: admin, operador, viewer.` }), {
          status: 422,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: `Erro ao vincular membro: ${memberError.message}` }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 4. Marcar o convite como aceito
    const { error: updateError } = await adminClient
      .from('empresa_convites')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_email: email,
      })
      .eq('token', token)

    if (updateError) {
      // Membro já vinculado com sucesso; falha ao marcar o convite não é crítica.
      // Loga para diagnóstico, mas não reverte o vínculo.
      console.error('[accept-sector-invite] falha ao marcar convite como aceito:', updateError.message)
    }

    // 5. Retornar sucesso
    return new Response(JSON.stringify({
      success: true,
      empresa_id: convite.empresa_id,
      equipe: convite.equipe,
    }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
