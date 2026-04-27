// Alerta agregado de telemetria do Mural — roda a cada 15 minutos via cron.
// Lê mural_busca_telemetria dos últimos 15 min, e se houver registros com
// severidade 'warning' ou 'error', envia e-mail para os admins e (se
// SLACK_WEBHOOK_URL estiver configurada) posta no Slack.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''
const SLACK_WEBHOOK_URL = Deno.env.get('SLACK_WEBHOOK_URL') || ''
const JANELA_MIN = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Autorização: aceita header x-cron-secret OU Authorization Bearer com CRON_SECRET
    const auth = req.headers.get('authorization') || ''
    const cronHeader = req.headers.get('x-cron-secret') || ''
    const tokenOk =
      !CRON_SECRET ||
      cronHeader === CRON_SECRET ||
      auth === `Bearer ${CRON_SECRET}`
    if (!tokenOk) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString()

    // Busca telemetria recente
    const { data: rows, error } = await admin
      .from('mural_busca_telemetria')
      .select('id, created_at, user_id, fonte, total_somado, total_recebido, total_unico, total_final, duplicatas, divergencias, severidade, duracao_ms, filtros')
      .gte('created_at', desde)
      .in('severidade', ['warning', 'error'])
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    if (!rows || rows.length === 0) {
      return json({ ok: true, mensagem: 'Nenhuma discrepância no período', janela_min: JANELA_MIN })
    }

    // Agrega métricas
    const total = rows.length
    const errors = rows.filter(r => r.severidade === 'error').length
    const warnings = rows.filter(r => r.severidade === 'warning').length
    const duplicatas = rows.reduce((s, r) => s + (r.duplicatas || 0), 0)
    const divergencias = new Set<string>()
    for (const r of rows) {
      const arr = Array.isArray(r.divergencias) ? r.divergencias : []
      for (const d of arr) divergencias.add(String(d))
    }
    const fontes = rows.reduce<Record<string, number>>((acc, r) => {
      const k = r.fonte || 'desconhecida'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})

    const amostras = rows.slice(0, 5).map(r => ({
      ts: r.created_at,
      severidade: r.severidade,
      fonte: r.fonte,
      somado: r.total_somado,
      recebido: r.total_recebido,
      unico: r.total_unico,
      final: r.total_final,
      duplicatas: r.duplicatas,
      divergencias: r.divergencias,
    }))

    // Lista admins
    const { data: adminRoles, error: adminErr } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
    if (adminErr) throw adminErr

    const adminIds = (adminRoles || []).map(r => r.user_id)
    const emails: string[] = []
    if (adminIds.length > 0) {
      const { data: profs } = await admin
        .from('profiles')
        .select('user_id, email')
        .in('user_id', adminIds)
      for (const p of (profs || [])) {
        if (p?.email) emails.push(p.email)
      }
    }

    // Monta mensagem
    const titulo = `⚠️ Telemetria do Mural: ${errors} erro(s) e ${warnings} aviso(s) em ${JANELA_MIN} min`
    const linhasDiv = Array.from(divergencias).slice(0, 8).map(d => `• ${d}`).join('\n')
    const linhasFontes = Object.entries(fontes).map(([k, v]) => `${k}: ${v}`).join(' · ')
    const resumoTexto =
`Período: últimos ${JANELA_MIN} min
Total de ocorrências: ${total} (errors: ${errors}, warnings: ${warnings})
Duplicatas detectadas (soma): ${duplicatas}
Fontes: ${linhasFontes || '—'}
Divergências:
${linhasDiv || '—'}

Acesse o painel: ${publicUrl()}/admin/mural-telemetria`

    const mensagemHtml = resumoTexto.replace(/\n/g, '<br/>')

    // Envia e-mails (1 invocação por destinatário, com idempotency_key por janela)
    const janelaKey = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
    const enviosEmail: Array<{ email: string; ok: boolean; erro?: string }> = []
    for (const email of emails) {
      try {
        const r = await admin.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'notificacao-sistema',
            recipientEmail: email,
            idempotencyKey: `mural-alerta-${janelaKey}-${email}`,
            templateData: {
              titulo,
              mensagem: mensagemHtml,
              ctaText: 'Abrir Painel de Telemetria',
              ctaUrl: `${publicUrl()}/admin/mural-telemetria`,
            },
          },
        })
        enviosEmail.push({ email, ok: !r.error, erro: r.error?.message })
      } catch (e: any) {
        enviosEmail.push({ email, ok: false, erro: String(e?.message || e) })
      }
    }

    // Slack (opcional)
    let slack: { tentado: boolean; ok?: boolean; status?: number; erro?: string } = { tentado: false }
    if (SLACK_WEBHOOK_URL) {
      slack.tentado = true
      try {
        const payload = {
          text: titulo,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: titulo } },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Erros:* ${errors}` },
                { type: 'mrkdwn', text: `*Avisos:* ${warnings}` },
                { type: 'mrkdwn', text: `*Duplicatas:* ${duplicatas}` },
                { type: 'mrkdwn', text: `*Janela:* ${JANELA_MIN} min` },
              ],
            },
            { type: 'section', text: { type: 'mrkdwn', text: `*Fontes:* ${linhasFontes || '—'}` } },
            { type: 'section', text: { type: 'mrkdwn', text: `*Divergências:*\n${linhasDiv || '—'}` } },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Abrir painel' },
                  url: `${publicUrl()}/admin/mural-telemetria`,
                },
              ],
            },
          ],
        }
        const resp = await fetch(SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        slack.status = resp.status
        slack.ok = resp.ok
        if (!resp.ok) slack.erro = await resp.text().catch(() => '')
      } catch (e: any) {
        slack.ok = false
        slack.erro = String(e?.message || e)
      }
    }

    // Log do disparo
    await admin.from('mural_alerta_log').insert({
      janela_minutos: JANELA_MIN,
      total_eventos: total,
      total_errors: errors,
      total_warnings: warnings,
      duplicatas_total: duplicatas,
      divergencias: Array.from(divergencias),
      destinatarios_email: emails,
      envios_email: enviosEmail,
      slack: slack,
      amostras,
    }).select().maybeSingle()

    return json({
      ok: true,
      janela_min: JANELA_MIN,
      total_eventos: total,
      errors, warnings, duplicatas,
      destinatarios: emails.length,
      envios_email: enviosEmail,
      slack,
    })
  } catch (e: any) {
    console.error('[mural-telemetria-alerta] erro', e)
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function publicUrl(): string {
  return Deno.env.get('PUBLIC_APP_URL') || 'https://praefectus.com.br'
}
