import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Role = 'admin' | 'user' | 'viewer';

/**
 * Duas coisas diferentes que o sistema chamava pelo mesmo nome.
 *
 * `user_roles.role = 'admin'` é o admin do SISTEMA — quem administra o SaaS.
 * `empresa_membros.papel = 'admin'` é o admin de UMA EMPRESA assinante, que
 * manda na empresa dele e em mais nada.
 *
 * Colapsar os dois num único `isAdmin` fazia o admin de empresa passar por
 * porta de admin do sistema: o AdminGuard o deixava entrar em rota exclusiva, o
 * PlanGuard lhe dava bypass de plano, e o painel de contratos lhe oferecia um
 * job global que o banco recusaria. Quem precisa de "qualquer admin" continua
 * usando `isAdmin`; quem precisa do admin do SaaS usa `isSystemAdmin`.
 */
export type PapeisDoUsuario = {
  role: Role;
  isSystemAdmin: boolean;
  isCompanyAdmin: boolean;
};

async function fetchUserRole(userId: string, signal?: AbortSignal): Promise<PapeisDoUsuario> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6000);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const [{ data: rolesData, error: rolesError }, { data: empresaAdminData, error: empresaAdminError }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).abortSignal(controller.signal),
    supabase.from('empresa_membros').select('id').eq('user_id', userId).eq('papel', 'admin').limit(1).abortSignal(controller.signal),
  ]).finally(() => window.clearTimeout(timeoutId));

  if (rolesError) throw rolesError;
  if (empresaAdminError) throw empresaAdminError;

  const roles = (rolesData ?? []).map((item) => String(item.role));
  const isSystemAdmin = roles.includes('admin');
  const isCompanyAdmin = (empresaAdminData?.length ?? 0) > 0;

  const role: Role = isSystemAdmin || isCompanyAdmin
    ? 'admin'
    : roles.includes('viewer') ? 'viewer' : 'user';

  return { role, isSystemAdmin, isCompanyAdmin };
}

const SEM_PAPEL: PapeisDoUsuario = { role: 'user', isSystemAdmin: false, isCompanyAdmin: false };

export function useUserRole() {
  const { user } = useAuth();

  const { data: papeis = SEM_PAPEL, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: ({ signal }) => fetchUserRole(user!.id, signal),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return {
    role: papeis.role,
    /** Admin de qualquer natureza — sistema OU empresa. */
    isAdmin: papeis.role === 'admin',
    /** Só o admin do SaaS (user_roles). Use para porta que o banco também tranca. */
    isSystemAdmin: papeis.isSystemAdmin,
    /** Admin de alguma empresa (empresa_membros.papel). */
    isCompanyAdmin: papeis.isCompanyAdmin,
    loading: !!user && isLoading,
  };
}
