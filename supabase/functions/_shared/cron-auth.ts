/**
 * Autenticação das funções chamadas por pg_cron.
 *
 * CONTEXTO (2026-08-13). Estas funções recebem o `CRON_SECRET` no header
 * `Authorization`, que não é um JWT. Enquanto `verify_jwt` não estava declarado
 * no `config.toml` (padrão = true), o gateway do Supabase rejeitava antes de a
 * função rodar, com `UNAUTHORIZED_INVALID_JWT_FORMAT` — e o pg_cron marcava o
 * job como `succeeded`, porque `net.http_post` é assíncrono. Foi assim que
 * essas rotinas ficaram meses quebradas sem ninguém notar.
 *
 * Ao liberar o gateway (`verify_jwt = false`), a proteção passa a ser
 * responsabilidade da própria função — é o que este helper padroniza.
 */

/** Aceita as duas formas em uso no repo: header dedicado ou Bearer. */
export function autorizadoComoCron(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const auth = (req.headers.get('authorization') || '').trim();
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const header = (req.headers.get('x-cron-secret') || '').trim();

  // Sem CRON_SECRET configurado, NÃO liberar: `mural-telemetria-alerta` tem um
  // `!CRON_SECRET ||` que faz exatamente o contrário e deixa a função aberta
  // quando o segredo some do ambiente. Aqui a ausência nega.
  if (cronSecret && (bearer === cronSecret || header === cronSecret)) return true;

  // O service_role é aceito porque `pncp-sync-diario` se auto-invoca em modo
  // orquestrador usando essa chave (index.ts, fan-out dos workers).
  if (serviceKey && bearer === serviceKey) return true;

  return false;
}

export function respostaNaoAutorizado(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
