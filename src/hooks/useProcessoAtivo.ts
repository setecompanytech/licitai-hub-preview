import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useProcessoAtivoContext } from '@/contexts/ProcessoAtivoContext';

export interface ProcessoResumo {
  id: string;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  status: string | null;
  valor_estimado: number | null;
  updated_at: string;
}

/**
 * Sincronização global do "Processo Ativo".
 * URL (?lid=) + localStorage + Realtime. Provider em ProcessoAtivoContext.
 */
export function useProcessoAtivo() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const { processoId, processo, loading, setProcessoId, refreshProcesso, registerDirty } = useProcessoAtivoContext();

  const fetchProcessos = useCallback(async (): Promise<ProcessoResumo[]> => {
    if (!user) return [];
    let q = supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, updated_at')
      // Seletor de trabalho: só o que ocupa a mesa. Sem este filtro, processos
      // arquivados reapareciam aqui eternamente — e pareciam "erro no sistema".
      .is('arquivado_em', null);
    if (empresaAtiva) q = q.eq('empresa_id', empresaAtiva.id);
    const { data, error } = await q
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) { console.error('Erro ao buscar processos:', error); return []; }
    return (data || []) as ProcessoResumo[];
  }, [user, empresaAtiva]);

  const criarProcessoManual = useCallback(async (seed: {
    numero?: string; orgao?: string; objeto?: string; modalidade?: string; valorEstimado?: number;
  }): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('licitacoes')
      .insert({
        user_id: user.id,
        // Sem empresa, o processo some do realizado do módulo de metas —
        // a view de participações filtra por empresa_id.
        empresa_id: empresaAtiva?.id ?? null,
        numero: seed.numero || 'Processo Manual',
        orgao: seed.orgao || '',
        objeto: seed.objeto || '',
        modalidade: seed.modalidade || 'Pregão Eletrônico',
        valor_estimado: seed.valorEstimado || null,
        status: 'proposta',
      })
      .select('id')
      .single();
    if (error || !data) { console.error('Erro ao criar processo:', error); return null; }
    setProcessoId(data.id, { force: true });
    return data.id;
  }, [user, empresaAtiva?.id, setProcessoId]);

  const ensureProcesso = useCallback(async (seed: {
    numero?: string; orgao?: string; objeto?: string; modalidade?: string; valorEstimado?: number;
  }): Promise<string | null> => {
    if (processoId) return processoId;
    return criarProcessoManual(seed);
  }, [processoId, criarProcessoManual]);

  /** Hook helper: registra/desregistra "dirty" automaticamente */
  const useDirty = (isDirty: boolean, label: string, ownerId: string) => {
    useEffect(() => {
      if (!isDirty) return;
      const off = registerDirty({ id: ownerId, label });
      return off;
    }, [isDirty, label, ownerId]);
  };

  return {
    processoId,
    processo,
    loading,
    setProcessoId,
    refreshProcesso,
    registerDirty,
    useDirty,
    fetchProcessos,
    criarProcessoManual,
    ensureProcesso,
  };
}
