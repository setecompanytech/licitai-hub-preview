import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useUserRole } from '@/hooks/useUserRole';
import { isSectorAllowedForRoute } from '@/lib/route-permissions';

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
  { value: 'comissoes', label: 'Comissões', setores: ['financeiro', 'comercial'] },
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
  const { isAdmin: isGlobalAdmin, loading: roleLoading } = useUserRole();
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
    if (isGlobalAdmin || membro?.isEmpresaAdmin || isEmpresaAdminFromContext) return true;
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
    if (isGlobalAdmin || membro?.isEmpresaAdmin || isEmpresaAdminFromContext) return true;
    if (!membro) return false;
    // Setor 'geral' (não classificado) — limitar a rotas marcadas como 'geral'.
    return isSectorAllowedForRoute(membro.setor, path);
  };

  const isAnyAdmin = isGlobalAdmin || membro?.isEmpresaAdmin || isEmpresaAdminFromContext;
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
