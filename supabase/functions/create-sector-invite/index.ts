// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'
import { getCorsHeaders } from '../_shared/security-headers.ts'

const SITE_URL = 'https://app.praefectus.com.br'
const SITE_NAME = 'PRAEFECTUS'
const SENDER_DOMAIN = 'notify.app.praefectus.com.br'
const FROM_DOMAIN = 'notify.app.praefectus.com.br'

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

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
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

    // 2. Verificar se o caller é admin da empresa
    const { data: callerMember } = await adminClient
      .from('empresa_membros')
      .select('papel')
      .eq('user_id', caller.id)
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (!callerMember || callerMember.papel !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem criar convites de setor' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 3. Verificar se já existe convite pendente para empresa_id + equipe
    const { data: existingConvite } = await adminClient
      .from('empresa_convites')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('equipe', equipe)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingConvite) {
      const equipeLabel = equipeLabels[equipe] ?? equipe
      return new Response(JSON.stringify({
        error: `Já existe um convite pendente para o setor ${equipeLabel}. Aguarde ele expirar ou cancele-o antes de criar um novo.`,
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

    // 5. Inserir na tabela empresa_convites (token gerado pelo DEFAULT do banco)
    const { data: novoConvite, error: insertError } = await adminClient
      .from('empresa_convites')
      .insert({
        empresa_id,
        equipe,
        papel,
        email_setor,
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

    // 6. Montar link de aceite e conteúdo do e-mail
    const acceptUrl = `${SITE_URL}/aceitar-convite?token=${novoConvite.token}`
    const equipeLabel = equipeLabels[equipe] ?? equipe
    const subject = `Convite para colaborador — ${equipeLabel}`

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:hsl(215,50%,23%);padding:20px 25px;text-align:center;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:3px;">PRAEFECTUS</span>
          </td>
        </tr>
        <tr>
          <td style="padding:30px 25px 10px;">
            <h1 style="font-size:22px;font-weight:bold;color:hsl(215,40%,16%);margin:0 0 20px;">
              Você foi convidado para colaborar
            </h1>
            <p style="font-size:14px;color:hsl(215,12%,50%);line-height:1.6;margin:0 0 16px;">
              A empresa <strong>${nomeEmpresa}</strong> convidou o endereço
              <strong>${email_setor}</strong> para acessar o setor
              <strong>${equipeLabel}</strong> na plataforma PRAEFECTUS.
            </p>
            <p style="font-size:14px;color:hsl(215,12%,50%);line-height:1.6;margin:0 0 16px;">
              O papel atribuído é <strong>${papel}</strong>. Clique no botão abaixo para aceitar o convite
              e criar suas credenciais de acesso.
            </p>
            <p style="font-size:14px;color:hsl(215,12%,50%);line-height:1.6;margin:0 0 24px;">
              Este link é válido por <strong>7 dias</strong>.
            </p>
            <a href="${acceptUrl}"
               style="display:block;background:hsl(24,95%,53%);color:#ffffff;font-size:14px;font-weight:600;
                      border-radius:8px;padding:12px 24px;text-decoration:none;text-align:center;margin:0 0 30px;">
              Aceitar convite e criar acesso
            </a>
            <hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 20px;" />
            <p style="font-size:12px;color:#999999;margin:0 0 25px;">
              Se você não esperava este convite, ignore este e-mail com segurança.
              Nenhuma conta será criada sem que você clique no link acima.
            </p>
            <p style="font-size:12px;color:#999999;margin:0;">
              PRAEFECTUS — Inteligência em Licitações
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const text = `Você foi convidado para colaborar — PRAEFECTUS

A empresa ${nomeEmpresa} convidou o endereço ${email_setor} para acessar o setor ${equipeLabel} na plataforma PRAEFECTUS.

Papel atribuído: ${papel}

Clique no link abaixo para aceitar o convite (válido por 7 dias):
${acceptUrl}

Se você não esperava este convite, ignore este e-mail com segurança.
PRAEFECTUS — Inteligência em Licitações`

    // 7. Enfileirar o e-mail via a mesma fila usada por send-transactional-email
    const messageId = crypto.randomUUID()
    const { error: enqueueError } = await adminClient.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: email_setor,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: 'sector-invite',
        idempotency_key: messageId,
        unsubscribe_token: crypto.randomUUID(),
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      // Convite criado com sucesso; e-mail falhou. Retorna warning para o admin.
      console.error('[create-sector-invite] enqueue_email falhou:', enqueueError.message)
      return new Response(JSON.stringify({
        success: true,
        convite_id: novoConvite.id,
        warning: `Convite criado, mas o e-mail não pôde ser enfileirado: ${enqueueError.message}`,
      }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
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
