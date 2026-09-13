import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/**
 * Um nome enganoso abria duas portas (13/09/2026).
 *
 * `useUserRole().isAdmin` significa "admin de QUALQUER natureza" — operador do
 * SaaS **ou** administrador de uma empresa qualquer —, e a consulta que o
 * alimenta não filtra pela empresa ativa. Este hook o lia como
 * `isGlobalAdmin`, e a partir daí:
 *
 *  - o menu do operador (`/admin/*`) voltava a aparecer para administrador de
 *    empresa, desfazendo a separação pedida no mesmo dia;
 *  - quem administra a empresa A recebia poderes de administrador DENTRO da
 *    empresa B, onde é apenas operador.
 *
 * Nenhum dos dois dá para ver lendo um arquivo só: um mora em `useUserRole`,
 * o outro em quem o consome. Estes casos são a junção.
 */
const estado = {
  papeis: { isAdmin: false, isSystemAdmin: false, isCompanyAdmin: false, loading: false },
  empresaAtiva: { id: 'empresa-B' } as { id: string } | null,
  empresas: [] as { empresa_id: string; papel: string }[],
  papelDoMembro: 'operador',
};

/**
 * Os mocks devolvem SEMPRE o mesmo objeto. Devolver um literal novo a cada
 * chamada faria `user` e o contexto de empresa mudarem de identidade a cada
 * render; o efeito de carga depende deles e dispararia em laço, deixando
 * `loading` preso em `true` para sempre. No app são estado de contexto,
 * referência estável.
 */
const AUTH = { user: { id: 'u1' } };
const contextoDeEmpresa = { empresaAtiva: estado.empresaAtiva, empresas: estado.empresas, loading: false };

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => AUTH }));
vi.mock('@/contexts/EmpresaContext', () => ({ useEmpresa: () => contextoDeEmpresa }));
vi.mock('./useUserRole', () => ({
  useUserRole: () => estado.papeis,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            abortSignal: () => ({
              maybeSingle: async () => ({
                data: { papel: estado.papelDoMembro, equipe: 'geral', permissoes: [] },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const montar = async () => {
  const { useMembroPermissoes } = await import('./useMembroPermissoes');
  const r = renderHook(() => useMembroPermissoes());
  await waitFor(() => expect(r.result.current.loading).toBe(false));
  return r;
};

describe('fronteira entre operador do SaaS e admin de empresa', () => {
  beforeEach(() => {
    vi.resetModules();
    estado.papeis = { isAdmin: false, isSystemAdmin: false, isCompanyAdmin: false, loading: false };
    estado.empresaAtiva = { id: 'empresa-B' };
    estado.empresas = [];
    estado.papelDoMembro = 'operador';
    contextoDeEmpresa.empresaAtiva = estado.empresaAtiva;
    contextoDeEmpresa.empresas = estado.empresas;
  });

  it('admin da empresa A não vira admin dentro da empresa B', async () => {
    // O papel global diz "admin" porque a pessoa administra ALGUMA empresa.
    estado.papeis = { isAdmin: true, isSystemAdmin: false, isCompanyAdmin: true, loading: false };
    contextoDeEmpresa.empresas = [
      { empresa_id: 'empresa-A', papel: 'admin' },
      { empresa_id: 'empresa-B', papel: 'operador' },
    ];
    const { result } = await montar();

    expect(result.current.isEmpresaAdmin).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    // E não herda os setores por tabela: aqui ela é operador.
    expect(result.current.isFinanceiro).toBe(false);
  });

  it('o painel do operador não se abre para admin de empresa nenhuma', async () => {
    estado.papeis = { isAdmin: true, isSystemAdmin: false, isCompanyAdmin: true, loading: false };
    contextoDeEmpresa.empresas = [{ empresa_id: 'empresa-B', papel: 'admin' }];
    estado.papelDoMembro = 'admin';
    const { result } = await montar();

    // Manda na própria empresa...
    expect(result.current.isEmpresaAdmin).toBe(true);
    expect(result.current.canAccessRoute('/equipe')).toBe(true);
    // ...e em nada do SaaS.
    expect(result.current.canAccessRoute('/admin/templates')).toBe(false);
    expect(result.current.canAccessRoute('/admin/metricas-saas')).toBe(false);
  });

  it('o operador do SaaS continua entrando no painel dele', async () => {
    estado.papeis = { isAdmin: true, isSystemAdmin: true, isCompanyAdmin: false, loading: false };
    const { result } = await montar();
    expect(result.current.canAccessRoute('/admin/templates')).toBe(true);
  });

  it('admin da empresa ativa mantém o que sempre teve', async () => {
    contextoDeEmpresa.empresas = [{ empresa_id: 'empresa-B', papel: 'admin' }];
    estado.papelDoMembro = 'admin';
    const { result } = await montar();
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.temPermissao('financeiro')).toBe(true);
  });
});
