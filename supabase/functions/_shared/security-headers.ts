/**
 * Segurança — Headers e Rate Limiting compartilhados
 * CORS restrito por origem (nunca wildcard *)
 */

// Origens permitidas
const ALLOWED_ORIGINS = new Set([
  'https://praefectus.com.br',
  'https://www.praefectus.com.br',
  'https://app.praefectus.com.br',
  'http://localhost:8080',
  'http://localhost:3000',
]);

const CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, ' +
  'x-supabase-client-platform, x-supabase-client-platform-version, ' +
  'x-supabase-client-runtime, x-supabase-client-runtime-version';

/** Retorna headers CORS corretos para a origem da requisição. */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isLovable = /https:\/\/[a-z0-9-]+\.(lovableproject\.com|lovable\.app)$/.test(origin);
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) || isLovable
    ? origin : 'https://praefectus.com.br';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

/** @deprecated Use getCorsHeaders(req) */
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://praefectus.com.br',
  'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
};

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

// ═══ Rate Limiting por IP ═══
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkIpRateLimit(ip: string, maxRequests = 100, windowMs = 60_000)
  : { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = ipRateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    ipRateLimits.set(ip, entry);
  }
  if (entry.count >= maxRequests) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || 'unknown';
}

export function secureHeaders(req: Request, extra: Record<string, string> = {}) {
  return { ...getCorsHeaders(req), ...SECURITY_HEADERS, ...extra };
}

export function errorResponse(message: string, status = 500, req?: Request): Response {
  const cors = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...cors, ...SECURITY_HEADERS, "Content-Type": "application/json" },
  });
}

export function rateLimitResponse(retryAfter = 60, req?: Request): Response {
  const cors = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify({
    error: "Limite excedido. Tente novamente em alguns instantes.",
    retry_after: retryAfter,
  }), { status: 429,
    headers: { ...cors, ...SECURITY_HEADERS, "Content-Type": "application/json",
      "Retry-After": String(retryAfter) } });
}

export function sanitizeInput(input: string, maxLength = 10_000): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, maxLength).trim();
}
