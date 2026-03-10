import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';

export function useActivityLog() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();

  const logActivity = useCallback(async (
    acao: string,
    modulo: string,
    descricao?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user || !empresaAtiva) return;
    
    await supabase.from('atividades_colaborador' as any).insert({
      user_id: user.id,
      empresa_id: empresaAtiva.id,
      acao,
      modulo,
      descricao,
      metadata: metadata || {},
    });
  }, [user, empresaAtiva]);

  return { logActivity };
}
