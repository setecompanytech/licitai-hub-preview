/**
 * aurelia-proxy — Proxy seguro para Anthropic Claude API
 * 
 * A API key Anthropic é mantida exclusivamente no servidor (Supabase Vault).
 * O frontend NUNCA acessa a chave diretamente.
 * 
 * Rate limit: 60 req/min por tenant; burst: 10 req/s
 * Modelos suportados: claude-sonnet-4, claude-haiku-4
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/security-headers.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Rate limiting in-memory (per Edge Function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const BURST_LIMIT = 10;
const burstMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(tenantId: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();

  const burstKey = tenantId;
  let burst = burstMap.get(burstKey);
  if (!burst || burst.resetAt <= now) {
    burst = { count: 0, resetAt: now + 1000 };
    burstMap.set(burstKey, burst);
  }
  if (burst.count >= BURST_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((burst.resetAt - now) / 1000) };
  }

  let rl = rateLimitMap.get(tenantId);
  if (!rl || rl.resetAt <= now) {
    rl = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(tenantId, rl);
  }
  if (rl.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((rl.resetAt - now) / 1000) };
  }

  rl.count++;
  burst.count++;

  return { allowed: true, remaining: RATE_LIMIT_MAX - rl.count };
}

const ALLOWED_MODELS: Record<string, string> = {
  'claude-sonnet-4': 'gpt-4o',
  'claude-haiku-4': 'claude-haiku-4-20250514',
  'claude-sonnet': 'gpt-4o',
  'claude-haiku': 'claude-haiku-4-20250514',
};

Deno.serve(async (req) => {
  const corsH = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsH });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = user.id;
    const rlResult = checkRateLimit(tenantId);
    if (!rlResult.allowed) {
      return new Response(JSON.stringify({
        error: 'Limite de requisições excedido. Tente novamente em alguns instantes.',
        retry_after: rlResult.retryAfter,
      }), {
        status: 429,
        headers: {
          ...corsH,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
          'Retry-After': String(rlResult.retryAfter || 60),
        },
      });
    }

    const body = await req.json();
    const { messages, model, system, max_tokens, stream, temperature, thinking } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Campo "messages" obrigatório e deve ser um array não vazio' }), {
        status: 400,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    const requestedModel = model || 'claude-sonnet-4';
    const resolvedModel = ALLOWED_MODELS[requestedModel] || ALLOWED_MODELS['claude-sonnet-4'];

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY não encontrada no Vault');
      return new Response(JSON.stringify({ error: 'Configuração interna incompleta' }), {
        status: 500,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    const anthropicPayload: Record<string, unknown> = {
      model: resolvedModel,
      messages,
      max_tokens: Math.min(max_tokens || 8192, 32000),
    };

    if (system) {
      anthropicPayload.system = system;
    }

    if (stream === true) {
      anthropicPayload.stream = true;
    }

    if (typeof temperature === 'number') {
      anthropicPayload.temperature = Math.max(0, Math.min(1, temperature));
    }

    if (thinking && typeof thinking === 'object') {
      anthropicPayload.thinking = thinking;
    }

    const anthropicResp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(anthropicPayload),
      signal: AbortSignal.timeout(120000),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error(`Anthropic API error: ${anthropicResp.status} - ${errText.slice(0, 500)}`);

      if (anthropicResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições da IA excedido. Aguarde alguns instantes.' }), {
          status: 429,
          headers: { ...corsH, 'Content-Type': 'application/json' },
        });
      }
      if (anthropicResp.status === 400) {
        return new Response(JSON.stringify({ error: 'Requisição inválida para o modelo de IA' }), {
          status: 400,
          headers: { ...corsH, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Erro ao processar requisição de IA' }), {
        status: 502,
        headers: { ...corsH, 'Content-Type': 'application/json' },
      });
    }

    const responseHeaders: Record<string, string> = {
      ...corsH,
      'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
      'X-RateLimit-Remaining': String(rlResult.remaining),
      'X-Model-Used': resolvedModel,
    };

    if (stream) {
      responseHeaders['Content-Type'] = 'text/event-stream';
      return new Response(anthropicResp.body, { headers: responseHeaders });
    }

    responseHeaders['Content-Type'] = 'application/json';
    const data = await anthropicResp.json();
    return new Response(JSON.stringify(data), { headers: responseHeaders });

  } catch (error) {
    console.error('aurelia-proxy error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro interno do proxy',
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
