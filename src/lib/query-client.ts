import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient singleton compartilhado entre App.tsx e AuthContext.
 * Permite invalidar caches de permissões/role/subscription em eventos
 * de autenticação (SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED) sem exigir
 * que o usuário faça logout manual.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Chaves de cache sensíveis a permissões — invalidadas em todo evento
 * de autenticação para garantir que o frontend reflita imediatamente
 * mudanças de role/plano/empresa sem depender de refresh manual.
 */
export const PERMISSION_QUERY_KEYS: readonly (readonly unknown[])[] = [
  ["user-role"],
  ["empresa"],
  ["empresas"],
  ["empresa-membros"],
  ["membro-permissoes"],
  ["subscription"],
  ["plano"],
];

export function invalidatePermissionCaches() {
  for (const key of PERMISSION_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: key as unknown[] });
  }
}
