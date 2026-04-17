import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const LAST_ACTIVITY_KEY = 'praefectus_last_activity';
const THROTTLE_MS = 30_000; // update storage at most every 30s

/**
 * Auto-logout por inatividade. SOMENTE atua quando há usuário autenticado.
 * Sem essa guarda, o hook lia 'last_activity' antigo do localStorage e
 * derrubava sessões recém-criadas de login.
 */
export function useIdleTimeout(enabled: boolean = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0);

  const logout = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  }, []);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current > THROTTLE_MS) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastWriteRef.current = now;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    if (!enabled) {
      // Limpa qualquer marcação prévia para não afetar logins futuros
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Só checa "ausência prolongada" se HAVIA atividade registrada para este user logado
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity);
      if (elapsed >= IDLE_TIMEOUT_MS) {
        logout();
        return;
      }
    }

    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    lastWriteRef.current = Date.now();

    const events: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, resetTimer, logout]);
}
