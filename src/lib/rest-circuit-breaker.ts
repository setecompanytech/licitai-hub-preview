/**
 * Circuit breaker global para chamadas REST ao Lovable Cloud (PostgREST).
 *
 * Motivação: durante crash-loops do PostgREST, o auto-retry exponencial em
 * `rest-retry.ts` continua martelando o servidor instável, agravando o
 * problema. O circuit breaker corta o fluxo após N falhas consecutivas,
 * dando respiro ao backend e evitando cascatas de timeouts no frontend.
 *
 * Estados:
 *  - CLOSED    : operação normal, todas as chamadas passam.
 *  - OPEN      : todas as chamadas falham imediatamente com CircuitOpenError
 *                até `OPEN_DURATION_MS` decorrer.
 *  - HALF_OPEN : libera UMA chamada de probe; sucesso → CLOSED, falha → OPEN.
 *
 * Eventos:
 *  - `circuit-state-change` no window com { state, lastChange } a cada transição.
 *
 * Falhas que CONTAM (problema do servidor):
 *  - Status 5xx, 544 (timeout do pooler Supabase)
 *  - Network errors / TypeError "Failed to fetch"
 *  - AbortError causado por timeout (não pelo usuário)
 *
 * Falhas que NÃO contam (problema do request):
 *  - 401, 403 (auth) · 404 · 422 (validação)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker aberto — backend instável') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

const FAILURE_THRESHOLD = 5;        // 5 falhas...
const FAILURE_WINDOW_MS = 30_000;   // ...em janela deslizante de 30s
const OPEN_DURATION_MS = 60_000;    // 60s em OPEN antes de tentar HALF_OPEN

let state: CircuitState = 'CLOSED';
let failures: number[] = [];        // timestamps das falhas recentes
let openedAt = 0;
let halfOpenInflight = false;       // garante 1 só probe em HALF_OPEN

const emit = (next: CircuitState) => {
  if (state === next) return;
  state = next;
  const lastChange = Date.now();
  try {
    window.dispatchEvent(
      new CustomEvent('circuit-state-change', { detail: { state, lastChange } }),
    );
    console.warn(`[CircuitBreaker] estado → ${state}`);
  } catch { /* ignore */ }
};

const pruneOldFailures = (now: number) => {
  const cutoff = now - FAILURE_WINDOW_MS;
  failures = failures.filter((t) => t >= cutoff);
};

const transitionToOpen = () => {
  openedAt = Date.now();
  failures = [];
  halfOpenInflight = false;
  emit('OPEN');
};

const transitionToClosed = () => {
  failures = [];
  openedAt = 0;
  halfOpenInflight = false;
  emit('CLOSED');
};

const maybePromoteToHalfOpen = () => {
  if (state === 'OPEN' && Date.now() - openedAt >= OPEN_DURATION_MS) {
    halfOpenInflight = false;
    emit('HALF_OPEN');
  }
};

export function getCircuitState(): CircuitState {
  maybePromoteToHalfOpen();
  return state;
}

/** Indica se um erro / status conta como falha de servidor. */
export function isServerFailure(input: { status?: number; error?: unknown }): boolean {
  const { status, error } = input;
  if (typeof status === 'number') {
    if (status === 544) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }
  if (error) {
    const name = (error as any)?.name;
    const message = String((error as any)?.message ?? error);
    // AbortError contamos só quando NÃO veio do usuário — heurística: não há
    // como distinguir aqui sem context, então tratamos AbortError como ruído
    // do servidor (timeouts internos do retry). Erros explícitos do usuário
    // chegam via signal próprio antes do circuit envelopar.
    if (name === 'AbortError') return true;
    if (name === 'TypeError') return true; // "Failed to fetch"
    if (/failed to fetch|networkerror|load failed/i.test(message)) return true;
  }
  return false;
}

const recordFailure = () => {
  const now = Date.now();
  failures.push(now);
  pruneOldFailures(now);

  if (state === 'HALF_OPEN') {
    transitionToOpen();
    return;
  }
  if (state === 'CLOSED' && failures.length >= FAILURE_THRESHOLD) {
    transitionToOpen();
  }
};

const recordSuccess = () => {
  if (state === 'HALF_OPEN') {
    transitionToClosed();
  } else if (state === 'CLOSED' && failures.length > 0) {
    failures = [];
  }
};

/**
 * Envelopa uma função assíncrona com a lógica do circuit breaker.
 * Usado pelo interceptor de fetch em `rest-retry.ts`.
 */
export async function withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  maybePromoteToHalfOpen();

  if (state === 'OPEN') {
    throw new CircuitOpenError();
  }

  if (state === 'HALF_OPEN') {
    if (halfOpenInflight) {
      // Já existe um probe em voo; rejeita imediatamente para evitar cascata.
      throw new CircuitOpenError('Circuit em probe — aguardando resultado');
    }
    halfOpenInflight = true;
  }

  try {
    const result = await fn();
    recordSuccess();
    return result;
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err;
    if (isServerFailure({ error: err })) {
      recordFailure();
    }
    throw err;
  } finally {
    if (state === 'HALF_OPEN') halfOpenInflight = false;
  }
}

/** Reporta manualmente uma resposta HTTP (usado pelo interceptor após fetch). */
export function reportHttpResult(status: number): void {
  if (isServerFailure({ status })) {
    recordFailure();
  } else if (status < 500) {
    recordSuccess();
  }
}
