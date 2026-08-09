// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://app.praefectus.com.br'

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

function gerarToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const cors = CORS_HEADERS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  try {
    // 1. Autenticar o caller via JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token ausente' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
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
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { empresa_id, equipe, papel, email_setor } = await req.json()

    if (!empresa_id || !equipe || !papel || !email_setor) {
      return new Response(JSON.stringify({ error: 'empresa_id, equipe, papel e email_setor são obrigatórios' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // 2. Verificar se o caller é dono ou admin da empresa
    const [{ data: empresaOwner }, { data: callerMember }] = await Promise.all([
      adminClient.from('empresas').select('created_by').eq('id', empresa_id).maybeSingle(),
      adminClient.from('empresa_membros').select('papel').eq('user_id', caller.id).eq('empresa_id', empresa_id).maybeSingle(),
    ])

    const isOwner = empresaOwner?.created_by === caller.id
    const isAdmin = callerMember?.papel === 'admin' || callerMember?.papel === 'gerente'

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar convites de setor' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 3. Ja existe convite VALIDO para empresa_id + equipe?
    //
    // A condicao era `accepted_at IS NULL`, herdada do modelo de uso unico.
    // Com o convite reutilizavel isso se inverteria: assim que o primeiro
    // colaborador usasse o link, accepted_at deixaria de ser nulo, a trava
    // pararia de bloquear e o admin criaria um SEGUNDO link valido para o
    // mesmo setor — o oposto do que a regra pretende.
    //
    // Agora conta o que importa: nao expirado e ainda com capacidade.
    const { data: existentes } = await adminClient
      .from('empresa_convites')
      .select('id, usos, max_usos')
      .eq('empresa_id', empresa_id)
      .eq('equipe', equipe)
      .gt('expires_at', new Date().toISOString())

    const aindaUtil = (existentes ?? []).find(
      (c: { usos: number | null; max_usos: number | null }) =>
        c.max_usos === null || (c.usos ?? 0) < c.max_usos,
    )

    if (aindaUtil) {
      const equipeLabel = equipeLabels[equipe] ?? equipe
      return new Response(JSON.stringify({
        error: `Já existe um convite ativo para o setor ${equipeLabel}. `
          + `O mesmo link serve para todos os colaboradores do setor — copie-o em `
          + `Equipe & Colaboradores. Para gerar outro, cancele o atual.`,
      }), {
        status: 409,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 4. Buscar nome da empresa para o e-mail
    const { data: empresa } = await adminClient
      .from('empresas')
      .select('nome_fantasia, razao_social')
      .eq('id', empresa_id)
      .maybeSingle()

    const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'sua empresa'

    // 5. Gerar token e inserir na tabela empresa_convites
    const inviteToken = gerarToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: novoConvite, error: insertError } = await adminClient
      .from('empresa_convites')
      .insert({
        empresa_id,
        equipe,
        papel,
        email_setor,
        token: inviteToken,
        expires_at: expiresAt,
        accepted_at: null,
        created_by: caller.id,
      })
      .select('id, token')
      .single()

    if (insertError || !novoConvite) {
      return new Response(JSON.stringify({ error: `Erro ao criar convite: ${insertError?.message}` }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 6. Enviar e-mail via Resend
    const acceptUrl = `${SITE_URL}/aceitar-convite?token=${novoConvite.token}`
    const equipeLabel = equipeLabels[equipe] ?? equipe

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#b45309;padding:24px 32px">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:2px">PRAEFECTUS</h1>
          <p style="margin:4px 0 0;color:#fde68a;font-size:13px">Plataforma de Gestão de Licitações</p>
        </td></tr>
        <tr><td style="padding:32px">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Você foi convidado!</h2>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">
            A empresa <strong>${nomeEmpresa}</strong> convidou <strong>${email_setor}</strong>
            para acessar o setor <strong>${equipeLabel}</strong> com o papel de <strong>${papel}</strong>.
          </p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
            Clique no botão abaixo para criar sua conta e aceitar o convite.
            Este link expira em <strong>7 dias</strong>.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${acceptUrl}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600">
              Aceitar Convite e Criar Acesso
            </a>
          </div>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px">
            Se não esperava este convite, ignore este e-mail. Nenhuma conta será criada sem que você clique no link.<br>
            Link direto: <a href="${acceptUrl}" style="color:#b45309">${acceptUrl}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PRAEFECTUS <noreply@praefectus.com.br>',
          to: [email_setor],
          subject: `Convite para ${nomeEmpresa} — setor ${equipeLabel}`,
          html,
        }),
      }).catch(e => { console.error('Resend fetch error:', e.message); return null })

      if (!emailResp?.ok) {
        const body = await emailResp?.json().catch(() => ({}))
        console.error('[create-sector-invite] Resend error:', emailResp?.status, body)
        return new Response(JSON.stringify({
          success: true,
          convite_id: novoConvite.id,
          warning: 'Convite criado, mas houve falha ao enviar o e-mail. Verifique as configurações de domínio no Resend.',
        }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      convite_id: novoConvite.id,
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
