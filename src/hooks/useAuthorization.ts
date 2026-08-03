/**
 * useAuthorization — Middleware único de autorização do frontend.
 *
 * Consolida todas as verificações de acesso da aplicação em um ponto único:
 *  - Admin global do sistema (tabela `user_roles`)
 *  - Admin da empresa ativa (tabela `empresa_membros.papel = 'admin'`)
 *  - Setor do membro e mapeamento por rota
 *  - Permissões granulares por módulo
 *  - Bloqueios por plano de assinatura
 *
 * Regra de ouro: **se o usuário é admin (global OU da empresa), ele
 * ignora TODOS os bloqueios** — plano, setor, módulo e rotas internas.
 * Rotas exclusivas de admin global continuam restritas via `isSystemAdmin`.
 *
 * Use este hook em guards (PlanGuard/AdminGuard), na navegação (AppTopNav) e
 * em qualquer página que precise condicionar UI por permissão. NÃO repita
 * a lógica de bypass em outros lugares.
 */
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMembroPermissoes, type ModuloSistema, type Setor } from '@/hooks/useMembroPermissoes';
import { hasAccessToRoute } from '@/data/plan-features';

export interface AuthorizationAPI {
  /** Carregando role/membro/empresa. */
  loading: boolean;
  /** Admin global do sistema (user_roles.role = 'admin'). */
  isSystemAdmin: boolean;
  /** Admin DENTRO da empresa ativa (empresa_membros.papel = 'admin'). */
  isCompanyAdmin: boolean;
  /** Atalho: é admin de qualquer natureza (global ou empresa). */
  isAdmin: boolean;
  /** Setor do membro na empresa ativa. */
  setor: Setor;
  /** Tem permissão para um módulo (bypass automático para admin). */
  can: (modulo: ModuloSistema) => boolean;
  /** Pode acessar uma rota (considera setor + bypass de admin). */
  canAccessRoute: (path: string) => boolean;
  /** Pode acessar uma rota considerando o plano (bypass de admin). */
  canAccessByPlan: (path: string) => boolean;
  /** Resposta consolidada para guards: combina rota + plano + admin. */
  isAllowed: (path: string) => boolean;
}

export function useAuthorization(): AuthorizationAPI {
  const { subscription } = useAuth();
  const { isAdmin: isSystemAdmin, loading: roleLoading } = useUserRole();
  const {
    loading: membroLoading,
    temPermissao,
    canAccessRoute,
    isEmpresaAdmin: isCompanyAdmin,
    setor,
  } = useMembroPermissoes();

  return useMemo<AuthorizationAPI>(() => {
    const isAdmin = isSystemAdmin || isCompanyAdmin;

    const canAccessByPlan = (path: string) => {
      if (isAdmin) return true;
      // Sem dados de plano ainda → libera (guard mostra loading separadamente).
      if (subscription.loading) return true;
      return hasAccessToRoute(subscription.planSlug, path);
    };

    const isAllowed = (path: string) => {
      if (isAdmin) return true;
      return canAccessRoute(path) && canAccessByPlan(path);
    };

    return {
      loading: roleLoading || membroLoading,
      isSystemAdmin,
      isCompanyAdmin,
      isAdmin,
      setor,
      can: temPermissao,
      canAccessRoute,
      canAccessByPlan,
      isAllowed,
    };
  }, [
    isSystemAdmin,
    isCompanyAdmin,
    roleLoading,
    membroLoading,
    setor,
    temPermissao,
    canAccessRoute,
    subscription.loading,
    subscription.planSlug,
  ]);
}
