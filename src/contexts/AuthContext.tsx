import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { stripePlans } from '@/data/stripe-config';
import type { PlanSlug } from '@/data/plan-features';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

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

  const checkSubscription = useCallback(async (accessToken?: string) => {
    const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      setSubscription({ subscribed: false, planSlug: null, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!error && data) {
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
    }
  }, []);

  useEffect(() => {
    let initialLoad = true;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip redundant updates from cross-tab TOKEN_REFRESHED events
      // Comparing user IDs avoids new object references triggering re-renders & route unmounts
      setSession(prev => prev?.user?.id === session?.user?.id && prev?.access_token === session?.access_token ? prev : session);
      setUser(prev => prev?.id === session?.user?.id ? prev : (session?.user ?? null));

      if (initialLoad) {
        setLoading(false);
        initialLoad = false;
      }

      if (session?.access_token) {
        // Defer to avoid Supabase client deadlock
        setTimeout(() => checkSubscription(session.access_token), 0);
      } else {
        setSubscription({ subscribed: false, planSlug: null, subscriptionEnd: null, loading: false });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (initialLoad) {
        setLoading(false);
        initialLoad = false;
      }
    });

    return () => authSub.unsubscribe();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => checkSubscription(), 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  // Auto-logout after 10 min of inactivity
  useIdleTimeout();

  const getRedirectOrigin = (): string => {
    const origin = window.location.origin;
    if (origin.includes('lovableproject.com') || origin.includes('lovable.app') || origin.includes('localhost')) {
      return 'https://app.praefectus.com.br';
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
