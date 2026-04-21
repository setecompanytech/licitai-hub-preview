import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AutoPrepareState {
  prepared: boolean;
  running: boolean;
  editalPdfPath: string | null;
  totalItens: number | null;
}

/**
 * Dispara em background a preparação automática da Pasta do Processo:
 *  - download do edital original (PDF) para `processo-arquivos`
 *  - extração automática de itens (edital-auto-ingest)
 *
 * Idempotente: a Edge Function não reprocessa se já houve sucesso.
 * Silencioso por padrão (sem toasts) — usado em mounts e gatilhos automáticos.
 */
export function useProcessoAutoPrepare(licitacaoId: string | null, opts?: { autoRun?: boolean }) {
  const { user } = useAuth();
  const [state, setState] = useState<AutoPrepareState>({
    prepared: false,
    running: false,
    editalPdfPath: null,
    totalItens: null,
  });

  const refresh = useCallback(async () => {
    if (!licitacaoId || !user) return;
    const { data } = await supabase
      .from('processos_ingest_status')
      .select('status, arquivos_baixados, total_itens')
      .eq('user_id', user.id)
      .eq('licitacao_id', licitacaoId)
      .maybeSingle();
    const arquivos = (data?.arquivos_baixados ?? {}) as any;
    setState((s) => ({
      ...s,
      prepared: data?.status === 'success' && !!arquivos?.edital_pdf_path,
      editalPdfPath: arquivos?.edital_pdf_path ?? null,
      totalItens: data?.total_itens ?? null,
      running: data?.status === 'running',
    }));
  }, [licitacaoId, user]);

  const trigger = useCallback(
    async (force = false) => {
      if (!licitacaoId || !user) return false;
      setState((s) => ({ ...s, running: true }));
      try {
        const { data, error } = await supabase.functions.invoke('processo-auto-prepare', {
          body: { licitacao_id: licitacaoId, force },
        });
        if (error) throw error;
        await refresh();
        return !!data?.success;
      } catch (e) {
        console.error('[auto-prepare]', e);
        return false;
      } finally {
        setState((s) => ({ ...s, running: false }));
      }
    },
    [licitacaoId, user, refresh],
  );

  // Hidrata estado + assina realtime
  useEffect(() => {
    if (!licitacaoId || !user) return;
    refresh();
    const ch = supabase
      .channel(`auto-prep-${licitacaoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processos_ingest_status',
          filter: `licitacao_id=eq.${licitacaoId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [licitacaoId, user, refresh]);

  // Auto-disparo silencioso (1 vez por montagem) se ainda não preparado
  useEffect(() => {
    if (!opts?.autoRun || !licitacaoId || !user) return;
    let cancelled = false;
    (async () => {
      // Espera estado hidratar
      const { data } = await supabase
        .from('processos_ingest_status')
        .select('status, arquivos_baixados')
        .eq('user_id', user.id)
        .eq('licitacao_id', licitacaoId)
        .maybeSingle();
      const arquivos = (data?.arquivos_baixados ?? {}) as any;
      const alreadyOk = data?.status === 'success' && !!arquivos?.edital_pdf_path;
      const isRunning = data?.status === 'running';
      if (!cancelled && !alreadyOk && !isRunning) {
        trigger(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opts?.autoRun, licitacaoId, user, trigger]);

  return { ...state, trigger, refresh };
}
