import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'admin' | 'user' | 'viewer';

async function fetchUserRole(userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from('user_roles').select('role').eq('user_id', userId);
  if (error) throw error;
  const roles = (data ?? []).map((item) => String(item.role));
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('viewer')) return 'viewer';
  return 'user';
}

export function useUserRole() {
  const { user } = useAuth();

  const { data: role = "user", isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: () => fetchUserRole(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return {
    role,
    isAdmin: role === 'admin',
    loading: !!user && isLoading,
  };
}
