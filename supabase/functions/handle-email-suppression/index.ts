import { createClient } from 'npm:@supabase/supabase-js@2.57.2'

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

// Suppression event payload sent by the Go API when Mailgun reports
// a bounce, complaint, or unsubscribe.
interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
  is_retry: boolean
  retry_count: number
}

function parseSuppressionPayload(body: string): SuppressionPayload {
  const parsed = JSON.parse(body)
  if (!parsed.data) {
    throw new Error('Missing data field in payload')
  }
  const data = parsed.data as SuppressionPayload
  if (!data.email || !data.reason) {
    throw new Error('Missing required fields: email, reason')
  }
  return data
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Verify HMAC signature using the Lovable API Key (same as auth-email-hook)
  let payload: SuppressionPayload
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: parseSuppressionPayload,
    })
    payload = verified.payload
  } catch (error) {
    if (error instanceof WebhookError) {
      switch (error.code) {
        case 'invalid_signature':
          console.error('Invalid webhook signature')
          return jsonResponse({ error: 'Invalid signature' }, 401)
        case 'stale_timestamp':
          console.error('Stale webhook timestamp')
          return jsonResponse({ error: 'Stale timestamp' }, 401)
        case 'invalid_payload':
        case 'invalid_json':
          console.error('Invalid payload', { code: error.code })
          return jsonResponse({ error: 'Invalid payload' }, 400)
        default:
          console.error('Webhook verification failed', {
            code: error.code,
            message: error.message,
          })
          return jsonResponse({ error: 'Verification failed' }, 401)
      }
    }
    console.error('Unexpected error during verification', { error })
    return jsonResponse({ error: 'Internal error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    is_retry: payload.is_retry,
    retry_count: payload.retry_count,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
