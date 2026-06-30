import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

function parseEmailWebhookPayload(body: string): any {
  return JSON.parse(body)
}
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

type WebhookErrorCode =
  | 'missing_secret'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'stale_timestamp'
  | 'body_too_large'
  | 'invalid_signature'
  | 'invalid_payload'
  | 'invalid_json'

class WebhookError extends Error {
  constructor(public code: WebhookErrorCode, message: string) {
    super(message)
  }
}

async function computeSignature(signedPayload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  return 'sha256=' + Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function parseTimestamp(timestamp: string): number {
  const numeric = Number(timestamp)
  if (Number.isFinite(numeric)) {
    return Math.abs(numeric) < 1e12 ? numeric * 1000 : numeric
  }

  const parsed = Date.parse(timestamp)
  if (!Number.isNaN(parsed)) return parsed

  throw new WebhookError('invalid_timestamp', 'Invalid webhook timestamp')
}

async function verifyWebhookRequest<T>({
  req,
  secret,
  parser,
  signatureHeader = 'x-lovable-signature',
  timestampHeader = 'x-lovable-timestamp',
  toleranceMs = 5 * 60 * 1000,
  maxBodyBytes = 1 << 20,
}: {
  req: Request
  secret: string
  parser: (body: string) => T
  signatureHeader?: string
  timestampHeader?: string
  toleranceMs?: number
  maxBodyBytes?: number
}): Promise<{ body: string; payload: T; timestamp: string }> {
  if (!secret) {
    throw new WebhookError('missing_secret', 'Missing webhook secret')
  }

  const signature = req.headers.get(signatureHeader)
  const timestamp = req.headers.get(timestampHeader)

  if (!timestamp) {
    throw new WebhookError('missing_timestamp', 'Missing webhook timestamp')
  }

  const timestampMs = parseTimestamp(timestamp)
  if (Math.abs(Date.now() - timestampMs) > toleranceMs) {
    throw new WebhookError('stale_timestamp', 'Webhook timestamp outside tolerance window')
  }

  const body = await req.text()
  if (new TextEncoder().encode(body).length > maxBodyBytes) {
    throw new WebhookError('body_too_large', 'Webhook body exceeds size limit')
  }

  const expected = await computeSignature(`${timestamp}.${body}`, secret)
  if (!signature || !constantTimeEqual(signature, expected)) {
    throw new WebhookError('invalid_signature', 'Invalid webhook signature')
  }

  try {
    return { body, payload: parser(body), timestamp }
  } catch {
    throw new WebhookError('invalid_payload', 'Failed to parse webhook payload')
  }
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirme seu e-mail — PRAEFECTUS',
  invite: 'Você foi convidado — PRAEFECTUS',
  magiclink: 'Seu link de acesso — PRAEFECTUS',
  recovery: 'Redefinir sua senha — PRAEFECTUS',
  email_change: 'Confirme a alteração de e-mail — PRAEFECTUS',
  reauthentication: 'Seu código de verificação — PRAEFECTUS',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "PRAEFECTUS"
const SENDER_DOMAIN = "praefectus.com.br"
const ROOT_DOMAIN = "app.praefectus.com.br"
const FROM_DOMAIN = "praefectus.com.br"

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://levo-licita.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Standard Webhooks verification (https://www.standardwebhooks.com/)
// Supabase Auth Hook uses this format: secret stored as "v1,whsec_<base64>"
// Signed content: "<webhook-id>.<webhook-timestamp>.<body>"
// Signature header: "webhook-signature: v1,<base64-hmac-sha256>"
async function verifyStandardWebhook(req: Request, rawBody: string, secret: string): Promise<boolean> {
  try {
    // Strip "v1,whsec_" prefix and base64-decode to get raw key bytes
    const b64 = secret.replace(/^v1,whsec_/, '')
    const keyBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])

    const msgId = req.headers.get('webhook-id') ?? ''
    const msgTs = req.headers.get('webhook-timestamp') ?? ''
    const sigHeader = req.headers.get('webhook-signature') ?? ''

    const signed = `${msgId}.${msgTs}.${rawBody}`

    for (const part of sigHeader.split(' ')) {
      const [version, b64sig] = part.split(',')
      if (version !== 'v1') continue
      const sig = Uint8Array.from(atob(b64sig), c => c.charCodeAt(0))
      if (await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(signed))) return true
    }
    return false
  } catch {
    return false
  }
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const hookSecret = Deno.env.get('HOOK_SECRET')

  if (!hookSecret) {
    console.error('HOOK_SECRET not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Read body first (needed for signature verification)
  const rawBody = await req.text()

  if (!(await verifyStandardWebhook(req, rawBody, hookSecret))) {
    console.error('Invalid Standard Webhooks signature')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse the body payload sent by Supabase Auth
  // Supabase Auth sends: { user: { email, ... }, email_data: { email_action_type, token, token_hash, redirect_to, site_url, ... } }
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const emailType = payload.email_data?.email_action_type
  const recipientEmail = payload.user?.email
  const tokenHash = payload.email_data?.token_hash
  const token = payload.email_data?.token
  const redirectTo = payload.email_data?.redirect_to || `https://${ROOT_DOMAIN}`
  const newEmail = payload.email_data?.token_hash_new ? payload.user?.new_email : undefined
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  // Build the confirmation link users will click
  const confirmationUrl = tokenHash
    ? `${supabaseUrl}/auth/v1/verify?token=${tokenHash}&type=${emailType}&redirect_to=${encodeURIComponent(redirectTo)}`
    : redirectTo

  console.log('Received auth event', { emailType, email: recipientEmail })

  if (!emailType || !recipientEmail) {
    console.error('Webhook payload missing required fields', { emailType, recipientEmail })
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: recipientEmail,
    confirmationUrl,
    token,
    email: recipientEmail,
    newEmail,
  }

  // Render React Email to HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  // Enqueue email for async processing by the dispatcher (process-email-queue).
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipientEmail,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: recipientEmail })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
