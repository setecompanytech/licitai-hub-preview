/**
 * AUTH BOOTSTRAP — Resiliência de sessão sem intervenção do usuário
 * ------------------------------------------------------------------
 * Este módulo roda ANTES do client Supabase ser instanciado.
 * Garante que tokens corrompidos, expirados ou em estado inválido sejam
 * removidos automaticamente, eliminando a necessidade de o usuário limpar
 * cache/cookies manualmente.
 *
 * Camadas de proteção:
 *  1. Validação estrutural do JSON da sessão no localStorage
 *  2. Verificação de expiração do refresh_token (decodificação JWT segura)
 *  3. Auto-purge em caso de qualquer inconsistência
 *  4. Marcador de "última recuperação" para evitar loop em rede instável
 */

const SUPABASE_KEY_PATTERNS = [/^sb-/, /supabase\.auth/];
const RECOVERY_FLAG = 'praefectus_auth_recovery_at';
const RECOVERY_COOLDOWN_MS = 30_000;

function isSupabaseAuthKey(key: string): boolean {
  return SUPABASE_KEY_PATTERNS.some((re) => re.test(key));
}

export function purgeSupabaseAuthStorage(): number {
  let removed = 0;
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (isSupabaseAuthKey(k)) {
        localStorage.removeItem(k);
        removed++;
      }
    }
    // Também limpa sessionStorage por segurança
    const sessionKeys = Object.keys(sessionStorage);
    for (const k of sessionKeys) {
      if (isSupabaseAuthKey(k)) {
        sessionStorage.removeItem(k);
        removed++;
      }
    }
  } catch {
    /* storage indisponível */
  }
  return removed;
}

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Inspeciona o storage e remove qualquer sessão Supabase inválida.
 * Retorna true se algo foi removido.
 */
export function validateAndCleanAuthStorage(): boolean {
  let cleaned = false;
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (!isSupabaseAuthKey(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      // 1) Estrutura JSON válida?
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        localStorage.removeItem(key);
        cleaned = true;
        continue;
      }

      // 2) Campos esperados de uma sessão Supabase
      const access = parsed?.access_token ?? parsed?.currentSession?.access_token;
      const refresh = parsed?.refresh_token ?? parsed?.currentSession?.refresh_token;
      const expiresAt =
        parsed?.expires_at ?? parsed?.currentSession?.expires_at;

      // Chaves auxiliares (code-verifier, etc.) — ignora se não tem token
      if (!access && !refresh) continue;

      // 3) Refresh token ausente quando access expirou = sessão morta
      const now = Math.floor(Date.now() / 1000);
      const accessExp = typeof expiresAt === 'number' ? expiresAt : decodeJwtExp(access ?? '');

      if (accessExp && accessExp < now && !refresh) {
        localStorage.removeItem(key);
        cleaned = true;
        continue;
      }

      // 4) Refresh token estruturalmente inválido
      if (refresh && typeof refresh !== 'string') {
        localStorage.removeItem(key);
        cleaned = true;
        continue;
      }
    }
  } catch (err) {
    console.warn('[Auth Bootstrap] storage scan falhou:', err);
  }

  if (cleaned) {
    console.info('[Auth Bootstrap] sessão local inválida removida automaticamente');
  }
  return cleaned;
}

/**
 * Executa recuperação completa: purga storage + recarrega a página.
 * Possui cooldown para evitar loops em redes instáveis.
 */
export function recoverFromAuthFailure(reason: string): void {
  try {
    const last = Number(localStorage.getItem(RECOVERY_FLAG) || '0');
    if (Date.now() - last < RECOVERY_COOLDOWN_MS) {
      console.warn('[Auth Recovery] cooldown ativo, ignorando:', reason);
      return;
    }
    localStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    /* ignore */
  }

  console.warn('[Auth Recovery] auto-recuperação acionada:', reason);
  purgeSupabaseAuthStorage();

  // Recarrega na tela de login (mantém UX previsível)
  try {
    const onAuthPage = window.location.pathname.startsWith('/auth');
    if (!onAuthPage) {
      window.location.replace('/auth');
    } else {
      window.location.reload();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Instala interceptador global para erros de fetch contra o endpoint de auth.
 * Quando detecta refresh_token_not_found / invalid_grant / 401 em /auth/v1/token,
 * dispara a auto-recuperação.
 */
export function installAuthFetchInterceptor(supabaseUrl: string): void {
  if (typeof window === 'undefined' || !supabaseUrl) return;
  const w = window as any;
  if (w.__praefectus_auth_interceptor_installed__) return;
  w.__praefectus_auth_interceptor_installed__ = true;

  const originalFetch = window.fetch.bind(window);
  const authPathRe = new RegExp(
    `${supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/auth/v1/`
  );

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    const isAuthCall = authPathRe.test(url);

    try {
      const response = await originalFetch(input, init);

      if (isAuthCall && (response.status === 400 || response.status === 401 || response.status === 403)) {
        // Clona para inspecionar sem consumir o body original
        try {
          const clone = response.clone();
          const text = await clone.text();
          const lower = text.toLowerCase();
          if (
            lower.includes('refresh_token_not_found') ||
            lower.includes('invalid_grant') ||
            lower.includes('invalid refresh token') ||
            lower.includes('session_not_found') ||
            lower.includes('token is expired')
          ) {
            // Apenas purga — não recarrega aqui (deixa o AuthContext decidir)
            purgeSupabaseAuthStorage();
          }
        } catch {
          /* leitura do body falhou — segue */
        }
      }
      return response;
    } catch (err) {
      // Falha de rede em endpoint de auth: pode ser cache corrompido do SW
      if (isAuthCall) {
        console.warn('[Auth Interceptor] falha de rede em', url, err);
      }
      throw err;
    }
  };
}
