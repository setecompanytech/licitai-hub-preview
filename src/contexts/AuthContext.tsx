import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { stripePlans } from '@/data/stripe-config';
import type { PlanSlug } from '@/data/plan-features';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { purgeSupabaseAuthStorage } from '@/lib/auth-bootstrap';
import { queryClient, invalidatePermissionCaches } from '@/lib/query-client';

type SubscriptionState = {
  subscribed: boolean;
  planSlug: PlanSlug | null;
  subscriptionEnd: string | null;
  loading: boolean;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionState;
  refreshSubscription: () => Promise<void>;
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function productIdToPlanSlug(productId: string | null): PlanSlug | null {
  if (!productId) return null;
  for (const [slug, config] of Object.entries(stripePlans)) {
    if (config.product_id === productId) return slug as PlanSlug;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    planSlug: null,
    subscriptionEnd: null,
    loading: true,
  });
  const lastUserIdRef = useRef<string | null>(null);

  const checkSubscription = useCallback(async (accessToken?: string) => {
    const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setSubscription({ subscribed: false, planSlug: null, subscriptionEnd: null, loading: false });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      const data = response.ok ? await response.json() : null;

      if (response.ok && data) {
        setSubscription({
          subscribed: data.subscribed ?? false,
          planSlug: productIdToPlanSlug(data.product_id ?? null),
          subscriptionEnd: data.subscription_end ?? null,
          loading: false,
        });
      } else {
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription(prev => ({ ...prev, loading: false }));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    let initialLoad = true;

    // Safety timeout: se o SDK do Supabase travar (ex: renovação de token com rede offline),
    // força loading=false após 8s para o usuário ver a tela de login.
    const safetyTimer = window.setTimeout(() => {
      if (initialLoad) {
        console.warn('[Auth] safety timeout disparado — forçando loading=false sem purgar storage');
        setLoading(false);
        initialLoad = false;
      }
    }, 8000);

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refresh falhou — purga storage para próxima tentativa nascer limpa
      if (event === 'TOKEN_REFRESHED' && !session) {
        purgeSupabaseAuthStorage();
      }

      const prevUserId = lastUserIdRef.current;
      const nextUserId = session?.user?.id ?? null;
      lastUserIdRef.current = nextUserId;

      // Skip redundant updates from cross-tab TOKEN_REFRESHED events
      setSession(prev => prev?.user?.id === session?.user?.id && prev?.access_token === session?.access_token ? prev : session);
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));

      if (initialLoad) {
        setLoading(false);
        initialLoad = false;
      }

      // Em qualquer evento que mude/renove a identidade, invalidar caches
      // de role/permissões/empresa/plano para refletir mudanças sem logout.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        invalidatePermissionCaches();
      }
      if (prevUserId && nextUserId && prevUserId !== nextUserId) {
        // Troca de usuário na mesma aba — limpa todo cache para evitar vazamento.
        queryClient.clear();
      }

      if (session?.access_token) {
        setTimeout(() => checkSubscription(session.access_token), 0);
      } else {
        setSubscription({ subscribed: false, planSlug: null, subscriptionEnd: null, loading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('[Auth] getSession error (sessão mantida):', error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (initialLoad) {
        setLoading(false);
        initialLoad = false;
      }
    });

    return () => {
      window.clearTimeout(safetyTimer);
      authSub.unsubscribe();
    };
  }, [checkSubscription]);

  // Refresh por visibilidade de aba — só atualiza ao focar e se dado > 5 min
  useEffect(() => {
    if (!user) return;
    let lastCheck = Date.now();
    const STALE_MS = 5 * 60 * 1000;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > STALE_MS) {
        lastCheck = Date.now();
        checkSubscription();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, checkSubscription]);

  // Auto-logout após 10 min de inatividade — SOMENTE quando há usuário logado.
  // Sem essa guarda, o hook derrubava sessões recém-criadas usando 'last_activity' antigo do localStorage.
  useIdleTimeout(!!user);

  const getRedirectOrigin = (): string => {
    const origin = window.location.origin;
    if (origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost')) {
      return 'https://praefectus.com.br';
    }
    return origin;
  };

  const signUp = async (email: string, password: string, nomeCompleto: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getRedirectOrigin(),
        data: { nome_completo: nomeCompleto },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const t0 = Date.now();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    const dt = Date.now() - t0;
    if (error) {
      // Diagnóstico: distinguir backend indisponível (timeout/Load failed/522)
      // de credenciais inválidas. Aparece no console do navegador.
      const msg = (error as any)?.message ?? String(error);
      const isNetwork = /load failed|fetch|timeout|network|522|503|gateway/i.test(msg);
      console.error(`[Auth] signIn falhou em ${dt}ms — ${isNetwork ? 'BACKEND INDISPONÍVEL' : 'CREDENCIAL/AUTH'}: ${msg}`);
    }
    return { error };
  };

  const signOut = async () => {
    // 1. Encerrar sessão no servidor PRIMEIRO (evita estado inconsistente)
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
    }
    // 2. Limpar estado local DEPOIS
    localStorage.removeItem('praefectus_last_activity');
    localStorage.removeItem('praefectus_cookie_consent');
    setUser(null);
    setSession(null);
    setSubscription({ subscribed: false, planSlug: null, subscriptionEnd: null, loading: false });
    // 3. Limpa todo o cache do React Query (role, empresa, permissões, etc.)
    queryClient.clear();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getRedirectOrigin()}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      subscription,
      refreshSubscription: () => checkSubscription(),
      signUp, signIn, signOut, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
