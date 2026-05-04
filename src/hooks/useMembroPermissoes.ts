import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useUserRole } from '@/hooks/useUserRole';
import { isSectorAllowedForRoute } from '@/lib/route-permissions';

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
  const { empresaAtiva } = useEmpresa();
  const { isAdmin: isGlobalAdmin } = useUserRole();
  const [membro, setMembro] = useState<MembroInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !empresaAtiva) {
      setMembro(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('empresa_membros')
        .select('papel, equipe, permissoes')
        .eq('empresa_id', empresaAtiva.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const setor = ((data as any).equipe || 'geral') as Setor;
        const papel = (data as any).papel || 'operador';
        const permissoes = Array.isArray((data as any).permissoes) ? (data as any).permissoes : [];
        setMembro({
          setor,
          papel,
          permissoes,
          isEmpresaAdmin: papel === 'admin',
        });
      } else {
        setMembro(null);
      }
      setLoading(false);
    };

    load();
  }, [user, empresaAtiva]);

  const temPermissao = (modulo: ModuloSistema): boolean => {
    // Admin global do sistema ignora bloqueios.
    if (isGlobalAdmin) return true;
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
    if (isGlobalAdmin) return true;
    if (!membro) return false;
    // Setor 'geral' (não classificado) — limitar a rotas marcadas como 'geral'.
    return isSectorAllowedForRoute(membro.setor, path);
  };

  const isFinanceiro = isGlobalAdmin || membro?.setor === 'financeiro';
  const isComercial = isGlobalAdmin || membro?.setor === 'comercial';
  const isLogistica = isGlobalAdmin || membro?.setor === 'logistica';

  return {
    membro,
    loading,
    temPermissao,
    canAccessRoute,
    isFinanceiro,
    isComercial,
    isLogistica,
    /** Admin global do sistema (user_roles). */
    isAdmin: isGlobalAdmin,
    /** Admin dentro da empresa atual. */
    isEmpresaAdmin: membro?.isEmpresaAdmin ?? false,
    setor: membro?.setor ?? 'geral',
  };
}
