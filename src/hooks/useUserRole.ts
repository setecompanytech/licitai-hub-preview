import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'admin' | 'user' | 'viewer';

async function fetchUserRole(userId: string, signal?: AbortSignal): Promise<Role> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6000);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const [{ data: rolesData, error: rolesError }, { data: empresaAdminData, error: empresaAdminError }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).abortSignal(controller.signal),
    supabase.from('empresa_membros').select('id').eq('user_id', userId).eq('papel', 'admin').limit(1).abortSignal(controller.signal),
  ]);

  window.clearTimeout(timeoutId);

  if (rolesError) throw rolesError;
  if (empresaAdminError) throw empresaAdminError;

  const roles = (rolesData ?? []).map((item) => String(item.role));
  if (roles.includes('admin') || (empresaAdminData?.length ?? 0) > 0) return 'admin';
  if (roles.includes('viewer')) return 'viewer';
  return 'user';
}

export function useUserRole() {
  const { user } = useAuth();

  const { data: role = "user", isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: ({ signal }) => fetchUserRole(user!.id, signal),
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
