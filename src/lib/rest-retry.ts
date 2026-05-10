/**
 * Auto-retry com backoff exponencial para chamadas ao PostgREST do Lovable Cloud.
 *
 * Motivação: a API REST (PostgREST) sofre instabilidades pontuais (timeouts 544,
 * "Failed to fetch", 502/503/504, 429). Sem retry, qualquer dessas falhas
 * congela telas que dependem do dado (ex.: maintenance_mode, planos, faq).
 *
 * Regras:
 * - Apenas requisições GET/HEAD para `${SUPABASE_URL}/rest/v1/*` são retentadas
 *   (idempotentes; mutações ficam de fora para evitar duplicidade).
 * - Retentativas em: erro de rede (TypeError), 408, 425, 429, 500, 502, 503, 504.
 * - Backoff: 300ms, 900ms, 2000ms (+ jitter de até 200ms). Máx 3 tentativas extras.
 * - Respeita AbortSignal do chamador — se abortado, propaga sem novo retry.
 */

import {
  withCircuitBreaker,
  reportHttpResult,
  CircuitOpenError,
  getCircuitState,
} from './rest-circuit-breaker';

const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 544]);
const BASE_DELAYS_MS = [300, 900, 2000];

const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

export function installRestRetryInterceptor(supabaseUrl: string): void {
  if (typeof window === 'undefined' || !supabaseUrl) return;
  const w = window as any;
  if (w.__praefectus_rest_retry_installed__) return;
  w.__praefectus_rest_retry_installed__ = true;

  const originalFetch = window.fetch.bind(window);
  const restPrefix = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/`;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    const isRetriable =
      url.startsWith(restPrefix) && (method === 'GET' || method === 'HEAD');

    if (!isRetriable) {
      return originalFetch(input, init);
    }

    const signal =
      (init?.signal as AbortSignal | null | undefined) ??
      (input instanceof Request ? input.signal : null);

    let lastError: unknown;

    for (let attempt = 0; attempt <= BASE_DELAYS_MS.length; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      try {
        const response = await originalFetch(input, init);

        if (response.ok || !RETRY_STATUSES.has(response.status)) {
          return response;
        }

        // Status retryable — descarta corpo para liberar conexão.
        try { await response.body?.cancel(); } catch { /* ignore */ }

        if (attempt === BASE_DELAYS_MS.length) {
          return response; // sem mais tentativas — devolve o último erro real
        }

        lastError = new Error(`HTTP ${response.status}`);
      } catch (err) {
        // AbortError não deve ser retentado.
        if ((err as any)?.name === 'AbortError') throw err;
        lastError = err;
        if (attempt === BASE_DELAYS_MS.length) throw err;
      }

      const delay = BASE_DELAYS_MS[attempt] + Math.floor(Math.random() * 200);
      try {
        console.warn(
          `[REST Retry] ${method} ${url.split('?')[0]} — tentativa ${attempt + 2}/${BASE_DELAYS_MS.length + 1} em ${delay}ms`,
          lastError,
        );
      } catch { /* ignore */ }
      await sleep(delay, signal);
    }

    // Inalcançável — laço sempre retorna ou lança.
    throw lastError ?? new Error('REST retry esgotado');
  };
}
