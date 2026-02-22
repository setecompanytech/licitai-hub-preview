import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole('user'); setLoading(false); return; }

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole((data?.role as any) || 'user');
        setLoading(false);
      });
  }, [user]);

  return { role, isAdmin: role === 'admin', loading };
}
