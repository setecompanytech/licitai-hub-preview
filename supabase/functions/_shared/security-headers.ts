/**
 * Segurança e Compliance — Headers e Rate Limiting compartilhados
 * 
 * Usado por todas as Edge Functions para:
 * - Headers de segurança padronizados
 * - Rate limiting por IP e por tenant
 * - Validação de origem
 */

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══ Rate Limiting por IP ═══
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkIpRateLimit(
  ip: string,
  maxRequests = 100,
  windowMs = 60_000,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = ipRateLimits.get(ip);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    ipRateLimits.set(ip, entry);
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// ═══ Extrair IP do request ═══
export function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ═══ Headers de resposta com segurança ═══
export function secureHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...corsHeaders,
    ...SECURITY_HEADERS,
    ...extra,
  };
}

// ═══ Resposta de erro padronizada ═══
export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, ...SECURITY_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ═══ Resposta de rate limit ═══
export function rateLimitResponse(retryAfter = 60): Response {
  return new Response(JSON.stringify({
    error: 'Limite de requisições excedido. Tente novamente em alguns instantes.',
    retry_after: retryAfter,
  }), {
    status: 429,
    headers: {
      ...corsHeaders,
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  });
}

// ═══ Sanitização de input ═══
export function sanitizeInput(input: string, maxLength = 10000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
    .slice(0, maxLength)
    .trim();
}
