import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface IngestStatus {
  id?: string;
  licitacao_id: string;
  status: 'pending' | 'running' | 'success' | 'partial' | 'failed' | 'skipped';
  etapa?: string | null;
  fonte?: string | null;
  total_itens?: number | null;
  mensagem?: string | null;
  erro?: string | null;
  arquivos_baixados?: any;
  finalizado_em?: string | null;
}

/**
 * Hook unificado de auto-ingestão de edital.
 * - `trigger(licitacaoId, opts)` invoca a Edge Function `edital-auto-ingest` em background.
 * - Realtime: assina `processos_ingest_status` filtrado por user_id + licitacao_id.
 */
export function useEditalAutoIngest(licitacaoId: string | null) {
  const { user } = useAuth();
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [running, setRunning] = useState(false);

  // Hidrata estado atual + assinatura realtime
  useEffect(() => {
    if (!licitacaoId || !user) { setStatus(null); return; }
    let cancelled = false;

    supabase
      .from('processos_ingest_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('licitacao_id', licitacaoId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setStatus(data as any); });

    const ch = supabase
      .channel(`ingest-${licitacaoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'processos_ingest_status',
        filter: `licitacao_id=eq.${licitacaoId}`,
      }, (payload) => {
        const row = (payload.new ?? payload.old) as any;
        if (row) setStatus(row);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [licitacaoId, user]);

  const trigger = useCallback(async (id?: string, opts?: { replace?: boolean; silent?: boolean }) => {
    const lid = id ?? licitacaoId;
    if (!lid) return false;
    setRunning(true);
    try {
      if (!opts?.silent) toast.info('🔍 Lendo edital automaticamente…');
      const { data, error } = await supabase.functions.invoke('edital-auto-ingest', {
        body: { licitacao_id: lid, replace: !!opts?.replace },
      });
      if (error) throw error;
      if (data?.success) {
        if (!opts?.silent) toast.success(`✅ ${data.total} itens importados (${data.fonte}).`);
        return true;
      } else {
        if (!opts?.silent) toast.warning('Não foi possível extrair itens automaticamente. Use upload manual.');
        return false;
      }
    } catch (err: any) {
      console.error('[auto-ingest]', err);
      if (!opts?.silent) toast.error('Falha na leitura automática.');
      return false;
    } finally {
      setRunning(false);
    }
  }, [licitacaoId]);

  return { status, running, trigger };
}
