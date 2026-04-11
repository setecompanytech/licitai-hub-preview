import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const LAST_ACTIVITY_KEY = 'praefectus_last_activity';
const THROTTLE_MS = 30_000; // update storage at most every 30s

export function useIdleTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0);

  const logout = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
  }, []);

  const resetTimer = useCallback(() => {
    const now = Date.now();

    // Throttle localStorage writes
    if (now - lastWriteRef.current > THROTTLE_MS) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastWriteRef.current = now;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    // On mount, check if user was away too long (closed tab scenario)
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity);
      if (elapsed >= IDLE_TIMEOUT_MS) {
        logout();
        return;
      }
    }

    // Set initial activity
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
  }, [resetTimer, logout]);
}
