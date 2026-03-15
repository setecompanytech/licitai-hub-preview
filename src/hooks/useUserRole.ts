import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRole = async () => {
      if (!user) {
        if (!active) return;
        setRole('user');
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!active) return;

      if (error) {
        console.error('Erro ao carregar roles:', error);
        setRole('user');
        setLoading(false);
        return;
      }

      const roles = (data ?? []).map((item) => String(item.role));

      if (roles.includes('admin')) {
        setRole('admin');
      } else if (roles.includes('viewer')) {
        setRole('viewer');
      } else {
        setRole('user');
      }

      setLoading(false);
    };

    void loadRole();

    return () => {
      active = false;
    };
  }, [user]);

  return { role, isAdmin: role === 'admin', loading };
}
