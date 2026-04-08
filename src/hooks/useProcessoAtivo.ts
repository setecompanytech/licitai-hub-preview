import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useProcessoAtivo() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const processoId = searchParams.get('lid') || null;

  const setProcessoId = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) next.set('lid', id);
      else next.delete('lid');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchProcessos = useCallback(async (): Promise<ProcessoResumo[]> => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) { console.error('Erro ao buscar processos:', error); return []; }
    return (data || []) as ProcessoResumo[];
  }, [user]);

  /** Create a manual process from uploaded edital data */
  const criarProcessoManual = useCallback(async (seed: {
    numero?: string;
    orgao?: string;
    objeto?: string;
    modalidade?: string;
    valorEstimado?: number;
  }): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('licitacoes')
      .insert({
        user_id: user.id,
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
    setProcessoId(data.id);
    return data.id;
  }, [user, setProcessoId]);

  /** Ensure a process exists — create if needed, then set as active */
  const ensureProcesso = useCallback(async (seed: {
    numero?: string;
    orgao?: string;
    objeto?: string;
    modalidade?: string;
    valorEstimado?: number;
  }): Promise<string | null> => {
    if (processoId) return processoId;
    return criarProcessoManual(seed);
  }, [processoId, criarProcessoManual]);

  return {
    processoId,
    setProcessoId,
    fetchProcessos,
    criarProcessoManual,
    ensureProcesso,
  };
}
