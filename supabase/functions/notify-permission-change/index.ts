// @ts-nocheck
// Envia e-mail ao colaborador quando seu papel, setor ou permissões forem alterados.
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAPEIS: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  viewer: 'Visualizador',
}

const EQUIPES: Record<string, string> = {
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token ausente' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verifica caller autenticado
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { to_email, to_nome, empresa_nome, alteracoes } = await req.json()
    // alteracoes: Array<{ campo: 'papel' | 'setor' | 'permissoes', de: string, para: string }>

    if (!to_email || !empresa_nome || !alteracoes?.length) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nome = to_nome || to_email
    const linhasAlteracoes = alteracoes.map((a: any) => {
      const campo = a.campo === 'papel' ? 'Papel / Nível de acesso'
        : a.campo === 'setor' ? 'Setor'
        : 'Permissões de módulos'
      const de = a.de ? `<s style="color:#9ca3af">${a.de}</s> → ` : ''
      return `<li style="margin:6px 0;color:#374151"><strong>${campo}:</strong> ${de}<strong style="color:#b45309">${a.para}</strong></li>`
    }).join('')

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
          <h2 style="margin:0 0 8px;color:#111827;font-size:18px">Suas permissões foram atualizadas</h2>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">
            Olá, <strong>${nome}</strong>. Um administrador de <strong>${empresa_nome}</strong> alterou suas permissões de acesso na plataforma.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Alterações realizadas</p>
            <ul style="margin:0;padding:0 0 0 18px">
              ${linhasAlteracoes}
            </ul>
          </div>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6">
            Essas alterações já estão em vigor. Caso você tenha dúvidas sobre suas novas permissões, entre em contato com o administrador da empresa.
          </p>
          <div style="text-align:center">
            <a href="https://app.praefectus.com.br" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">Acessar plataforma</a>
          </div>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px">
            Você recebeu este e-mail porque é membro da empresa <strong>${empresa_nome}</strong> no PRAEFECTUS.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'PRAEFECTUS <noreply@praefectus.com.br>',
        to: [to_email],
        subject: `Suas permissões foram atualizadas — ${empresa_nome}`,
        html,
      }),
    }).catch(() => null)

    if (!resp?.ok) {
      const body = await resp?.json().catch(() => ({}))
      console.error('[notify-permission-change] Resend error:', resp?.status, body)
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
