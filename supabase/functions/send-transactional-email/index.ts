import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface TransactionalEmailRequest {
  template: string
  to: string
  subject: string
  data: Record<string, unknown>
  label?: string
}

const BRAND = {
  primaryBg: 'hsl(215, 50%, 23%)',
  accentBg: 'hsl(24, 95%, 53%)',
  textColor: 'hsl(215, 40%, 16%)',
  mutedColor: 'hsl(215, 12%, 50%)',
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
}

function wrapTemplate(title: string, subtitle: string, bodyHtml: string, ctaText?: string, ctaUrl?: string): string {
  const ctaBlock = ctaText && ctaUrl ? `
    <div style="text-align:center;margin:28px 0 10px;">
      <a href="${ctaUrl}" style="display:inline-block;background:${BRAND.accentBg};color:#ffffff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        ${ctaText}
      </a>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f5f6f8;font-family:${BRAND.fontFamily};">
  <div style="max-width:560px;margin:0 auto;padding:30px 16px;">
    <div style="background:${BRAND.primaryBg};padding:22px 28px;border-radius:10px 10px 0 0;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:bold;letter-spacing:3px;">PRAEFECTUS</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px;">${subtitle}</p>
    </div>
    <div style="background:#ffffff;padding:28px;border-radius:0 0 10px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="color:${BRAND.textColor};font-size:20px;margin:0 0 18px;font-weight:700;">${title}</h2>
      ${bodyHtml}
      ${ctaBlock}
    </div>
    <p style="text-align:center;color:#aaa;font-size:11px;margin-top:18px;">
      PRAEFECTUS — Plataforma inteligente de licitações<br/>
      Você recebe este e-mail por estar inscrito na plataforma.
    </p>
  </div>
</body>
</html>`
}

function renderAlertBox(level: 'urgente' | 'atencao' | 'info', text: string): string {
  const colors = {
    urgente: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
    atencao: { bg: '#fffbeb', border: '#f59e0b', text: '#d97706' },
    info: { bg: '#f0f9ff', border: '#3b82f6', text: '#2563eb' },
  }
  const c = colors[level]
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
    <span style="color:${c.text};font-weight:600;font-size:14px;">${text}</span>
  </div>`
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  const d = data as any

  switch (template) {
    case 'alerta-vencimento-documento': {
      const diasLabel = d.dias <= 0 ? 'VENCIDO' : `vence em ${d.dias} dia(s)`
      const level = d.dias <= 1 ? 'urgente' : d.dias <= 7 ? 'atencao' : 'info'
      return wrapTemplate(
        '📄 Alerta de Documento',
        'Controle de Documentos',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        ${renderAlertBox(level, `${d.documento} — ${diasLabel}`)}
        <p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">
          <strong>Tipo:</strong> ${d.tipo || 'Documento'}<br/>
          <strong>Validade:</strong> ${d.validade || 'N/I'}${d.empresa ? `<br/><strong>Empresa:</strong> ${d.empresa}` : ''}
        </p>
        <p style="color:${BRAND.mutedColor};font-size:14px;">Renove com antecedência para manter a regularidade.</p>`,
        'Ver Documentos', d.link || 'https://praefectus.com.br/documentos'
      )
    }

    case 'alerta-vencimento-plano': {
      const level = d.dias <= 1 ? 'urgente' : d.dias <= 3 ? 'atencao' : 'info'
      const emoji = d.dias <= 1 ? '🚨' : d.dias <= 3 ? '⚠️' : '📋'
      return wrapTemplate(
        `${emoji} Vencimento de Plano`,
        'Gestão de Assinatura',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        ${renderAlertBox(level, `Plano ${d.plano} vence em ${d.dias} dia(s) — ${d.dataFim}`)}
        <p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">
          <strong>Empresa:</strong> ${d.empresa}<br/>
          <strong>Plano:</strong> ${d.plano}
        </p>
        <p style="color:${BRAND.mutedColor};font-size:14px;">Renove para não perder acesso às funcionalidades.</p>`,
        'Renovar Plano', d.link || 'https://praefectus.com.br/configuracoes'
      )
    }

    case 'alerta-licitacao-urgente': {
      return wrapTemplate(
        '⏰ Prazo Urgente',
        'Monitoramento de Licitações',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        ${renderAlertBox('urgente', `Licitação ${d.numero} encerra em ${d.tempo}`)}
        <p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">
          <strong>Órgão:</strong> ${d.orgao}<br/>
          <strong>Objeto:</strong> ${d.objeto || 'N/I'}${d.valor ? `<br/><strong>Valor Est.:</strong> ${d.valor}` : ''}
        </p>`,
        'Ver no Kanban', d.link || 'https://praefectus.com.br/kanban'
      )
    }

    case 'alerta-licitacao-nova': {
      const itensHtml = (d.editais || []).map((e: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
            <strong style="color:${BRAND.textColor};font-size:13px;">${e.titulo || e.orgao}</strong><br/>
            <span style="color:#888;font-size:12px;">${e.orgao}${e.municipio ? ` • ${e.municipio}/${e.uf}` : ''}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
            <span style="color:${BRAND.textColor};font-weight:600;font-size:13px;">${e.valor || '–'}</span>
          </td>
        </tr>`).join('')

      return wrapTemplate(
        '🎯 Novos Editais Compatíveis',
        'Busca Inteligente',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        ${renderAlertBox('info', `${d.total || (d.editais || []).length} edital(is) compatível(is) encontrado(s)`)}
        ${itensHtml ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Licitação</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#888;text-transform:uppercase;">Valor</th>
          </tr></thead>
          <tbody>${itensHtml}</tbody>
        </table>` : ''}`,
        'Ver Editais', d.link || 'https://praefectus.com.br/monitoramento-editais'
      )
    }

    case 'alerta-compromisso': {
      const level = d.dias <= 1 ? 'urgente' : d.dias <= 3 ? 'atencao' : 'info'
      const label = d.dias <= 1 ? 'ÚLTIMO DIA' : `${d.dias} dia(s) restantes`
      return wrapTemplate(
        '🔔 Alerta de Compromisso',
        'Meus Compromissos',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        ${renderAlertBox(level, `Processo ${d.numero} — ${label}`)}
        <p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">
          <strong>Órgão:</strong> ${d.orgao}<br/>
          <strong>Objeto:</strong> ${d.objeto || 'N/I'}${d.valor ? `<br/><strong>Valor Est.:</strong> ${d.valor}` : ''}${d.portal ? `<br/><strong>Portal:</strong> ${d.portal}` : ''}
        </p>`,
        'Ver Compromissos', d.link || 'https://praefectus.com.br/meus-compromissos'
      )
    }

    case 'notificacao-sistema': {
      return wrapTemplate(
        `📢 ${d.titulo || 'Notificação'}`,
        'Sistema',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">Olá, <strong>${d.nome || ''}</strong>!</p>
        <p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">${d.mensagem}</p>`,
        d.ctaText || 'Acessar Plataforma', d.link || 'https://praefectus.com.br'
      )
    }

    case 'boletim-diario': {
      const tipoLabel = d.tipo === 'manha' ? 'Novas Licitações — Manhã' : d.tipo === 'meiodia' ? 'Alterações e Avisos — Meio-dia' : 'Resultados do Dia — Tarde'
      const itensHtml = (d.licitacoes || []).map((l: any) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
            <strong style="color:${BRAND.textColor};font-size:13px;">${l.titulo}</strong><br/>
            <span style="color:#888;font-size:12px;">${l.orgao}${l.municipio ? ` • ${l.municipio}/${l.uf}` : ''}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
            <span style="color:${BRAND.textColor};font-weight:600;font-size:13px;">${l.valor || '–'}</span>
          </td>
        </tr>`).join('')

      return wrapTemplate(
        `📋 ${tipoLabel}`,
        `Boletim Diário • ${d.data || new Date().toLocaleDateString('pt-BR')}`,
        `${renderAlertBox('info', `${(d.licitacoes || []).length} itens encontrados`)}
        ${itensHtml ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;">Licitação</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#888;text-transform:uppercase;">Valor Est.</th>
          </tr></thead>
          <tbody>${itensHtml}</tbody>
        </table>` : `<p style="color:#888;text-align:center;padding:20px;">Nenhum item encontrado para este período.</p>`}`,
        'Ver na Plataforma', d.link || 'https://praefectus.com.br'
      )
    }

    default:
      return wrapTemplate(
        'Notificação',
        'PRAEFECTUS',
        `<p style="color:${BRAND.mutedColor};font-size:14px;line-height:1.6;">${d.mensagem || 'Você tem uma nova notificação na plataforma.'}</p>`,
        'Acessar Plataforma', 'https://praefectus.com.br'
      )
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { template, to, subject, data, label }: TransactionalEmailRequest = await req.json()

    if (!template || !to || !subject) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: template, to, subject' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const html = renderTemplate(template, data || {})
    const messageId = `${template}-${crypto.randomUUID()}`

    // Enqueue to transactional_emails queue
    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to,
        from: 'PRAEFECTUS <noreply@notify.praefectus.com.br>',
        sender_domain: 'notify.praefectus.com.br',
        subject,
        html,
        purpose: 'transactional',
        label: label || template,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('Erro ao enfileirar e-mail:', enqueueError)
      return new Response(
        JSON.stringify({ error: 'Falha ao enfileirar e-mail', details: enqueueError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log as pending
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: label || template,
      recipient_email: to,
      status: 'pending',
    })

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro no envio transacional:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
