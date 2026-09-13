import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useUserRole } from '@/hooks/useUserRole';
import { isSectorAllowedForRoute, ehRotaAdministrativa, ehRotaDoOperador } from '@/lib/route-permissions';

const withTimeoutSignal = (ms = 6000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => window.clearTimeout(timeoutId) };
};

export type Setor = 'geral' | 'financeiro' | 'comercial' | 'logistica' | 'juridico' | 'contabil' | 'licitacoes' | 'documentos';

export const MODULOS_SISTEMA: { value: string; label: string; setores: string[] }[] = [
  { value: 'contratos', label: 'Gestão de Contratos', setores: ['comercial', 'financeiro'] },
  { value: 'pedidos', label: 'Pedidos / Ordens', setores: ['comercial', 'logistica'] },
  { value: 'custos', label: 'Custos e Despesas', setores: ['financeiro'] },
  { value: 'faturamento', label: 'Faturamento / NF', setores: ['financeiro'] },
  { value: 'financeiro', label: 'Módulo Financeiro', setores: ['financeiro'] },
  { value: 'estoque', label: 'Estoque', setores: ['logistica'] },
  { value: 'licitacoes', label: 'Licitações', setores: ['comercial', 'licitacoes'] },
  { value: 'juridico', label: 'Jurídico', setores: ['juridico'] },
  { value: 'contabil', label: 'Contábil', setores: ['contabil'] },
  { value: 'dashboard_custos', label: 'Dashboard Custos/Margem', setores: ['financeiro'] },
  { value: 'comissoes', label: 'Bonificações', setores: ['financeiro', 'comercial'] },
  { value: 'metas_comercial', label: 'Metas do Comercial', setores: ['comercial', 'financeiro'] },
];

export type ModuloSistema = string;

interface MembroInfo {
  setor: Setor;
  papel: string;
  permissoes: string[];
  /** Admin DENTRO da empresa (não é admin global do sistema). */
  isEmpresaAdmin: boolean;
}

export function useMembroPermissoes() {
  const { user } = useAuth();
  const { empresaAtiva, empresas, loading: empresaLoading } = useEmpresa();
  /**
   * ATENÇÃO ao que se lê daqui (corrigido em 13/09/2026).
   *
   * `useUserRole().isAdmin` diz "admin de QUALQUER natureza": verdadeiro tanto
   * para o operador do SaaS quanto para quem administra UMA empresa qualquer —
   * e a consulta que o alimenta não filtra pela empresa ativa. Este hook o
   * consumia sob o nome `isGlobalAdmin`, e o nome enganava duas decisões:
   *
   *  - o menu do operador (`/admin/*`) reaparecia para administrador de
   *    empresa, desfazendo a separação pedida no mesmo dia (a rota resistia,
   *    porque o `AdminGuard` usa `isSystemAdmin`, mas o menu anunciava);
   *  - quem administra a empresa A ganhava poderes de administrador DENTRO da
   *    empresa B, onde é só operador — `canAccessRoute` e `temPermissao`
   *    liberavam tudo, e `isFinanceiro`/`isComercial`/`isLogistica` ficavam
   *    verdadeiros. O RLS barrava os dados; a interface oferecia as portas.
   *
   * Agora são dois nomes que não se confundem: `ehOperadorDoSaaS` (só
   * `user_roles`) e a admin-da-empresa-ATIVA, que já existia logo abaixo.
   */
  const { isSystemAdmin: ehOperadorDoSaaS, loading: roleLoading } = useUserRole();
  const [membro, setMembro] = useState<MembroInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const isEmpresaAdminFromContext = useMemo(() => {
    if (!empresaAtiva) return empresas.some((empresa) => empresa.papel === 'admin');
    return empresas.some((empresa) => empresa.empresa_id === empresaAtiva.id && empresa.papel === 'admin');
  }, [empresaAtiva, empresas]);

  useEffect(() => {
    if (!user) {
      setMembro(null);
      setLoading(false);
      return;
    }

    if (empresaLoading || roleLoading) {
      setLoading(true);
      return;
    }

    if (!empresaAtiva) {
      setMembro(isEmpresaAdminFromContext
        ? { setor: 'geral', papel: 'admin', permissoes: [], isEmpresaAdmin: true }
        : null
      );
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const request = withTimeoutSignal();

      try {
        const { data } = await supabase
          .from('empresa_membros')
          .select('papel, equipe, permissoes')
          .eq('empresa_id', empresaAtiva.id)
          .eq('user_id', user.id)
          .abortSignal(request.signal)
          .maybeSingle();

        if (data) {
          const setor = ((data as any).equipe || 'geral') as Setor;
          const papel = (data as any).papel || 'operador';
          const permissoes = Array.isArray((data as any).permissoes) ? (data as any).permissoes : [];
          setMembro({
            setor,
            papel,
            permissoes,
            isEmpresaAdmin: papel === 'admin' || isEmpresaAdminFromContext,
          });
        } else {
          setMembro(isEmpresaAdminFromContext
            ? { setor: 'geral', papel: 'admin', permissoes: [], isEmpresaAdmin: true }
            : null
          );
        }
      } catch (error) {
        console.warn('[Permissões] Falha ao carregar membro; liberando interface com permissões padrão.', error);
        setMembro(isEmpresaAdminFromContext
          ? { setor: 'geral', papel: 'admin', permissoes: [], isEmpresaAdmin: true }
          : null
        );
      } finally {
        request.clear();
        setLoading(false);
      }
    };

    load();
  }, [user, empresaAtiva, empresaLoading, roleLoading, isEmpresaAdminFromContext]);

  const temPermissao = (modulo: ModuloSistema): boolean => {
    // Admin global ou ADMIN da empresa ignora bloqueios de módulo.
    if (ehOperadorDoSaaS || membro?.isEmpresaAdmin || isEmpresaAdminFromContext) return true;
    if (!membro) return false;
    // Permissão explícita
    if (membro.permissoes.includes(modulo)) return true;
    // Padrão por setor
    const moduloConfig = MODULOS_SISTEMA.find(m => m.value === modulo);
    if (moduloConfig && moduloConfig.setores.includes(membro.setor)) return true;
    return false;
  };

  /**
   * Verifica se a rota deve ser visível/acessível para o membro atual.
   * Admin global libera tudo. Caso contrário, valida pelo setor do membro.
   */
  const canAccessRoute = (path: string): boolean => {
    // O painel do operador do SaaS não se abre para assinante nenhum — nem
    // para o administrador da empresa, que passa por todo o resto.
    if (ehRotaDoOperador(path)) return ehOperadorDoSaaS;
    if (ehOperadorDoSaaS || membro?.isEmpresaAdmin || isEmpresaAdminFromContext) return true;
    // Administração da empresa é do administrador — setor não abre essa porta.
    if (ehRotaAdministrativa(path)) return false;
    if (!membro) return false;
    // Setor 'geral' (não classificado) — limitar a rotas marcadas como 'geral'.
    return isSectorAllowedForRoute(membro.setor, path);
  };

  const isAnyAdmin = ehOperadorDoSaaS || membro?.isEmpresaAdmin || isEmpresaAdminFromContext;
  const isFinanceiro = isAnyAdmin || membro?.setor === 'financeiro';
  const isComercial = isAnyAdmin || membro?.setor === 'comercial';
  const isLogistica = isAnyAdmin || membro?.setor === 'logistica';

  return {
    membro,
    loading,
    temPermissao,
    canAccessRoute,
    isFinanceiro,
    isComercial,
    isLogistica,
    /** Admin global do sistema ou ADMIN dentro da empresa atual. */
    isAdmin: !!isAnyAdmin,
    /** Admin dentro da empresa atual. */
    isEmpresaAdmin: !!(membro?.isEmpresaAdmin || isEmpresaAdminFromContext),
    setor: membro?.setor ?? 'geral',
  };
}
