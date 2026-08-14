import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

const STORAGE_KEY = 'praefectus.processoAtivo';

export interface ProcessoAtivo {
  id: string;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  modalidade: string | null;
  status: string | null;
  valor_estimado: number | null;
  data_encerramento: string | null;
  uf: string | null;
  municipio: string | null;
  updated_at: string;
}

interface DirtyOwner {
  id: string;
  label: string;
}

interface Ctx {
  processoId: string | null;
  processo: ProcessoAtivo | null;
  loading: boolean;
  setProcessoId: (id: string | null, opts?: { force?: boolean }) => void;
  refreshProcesso: () => Promise<void>;
  /** Register that a form has unsaved changes; returns an unregister fn */
  registerDirty: (owner: DirtyOwner) => () => void;
}

const ProcessoAtivoCtx = createContext<Ctx | null>(null);

export function ProcessoAtivoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlId = searchParams.get('lid');
  const [processo, setProcesso] = useState<ProcessoAtivo | null>(null);
  const [loading, setLoading] = useState(false);

  // Pending switch (waiting for user confirmation due to dirty state)
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string | null; owners: string[] } | null>(null);
  const dirtyOwnersRef = useRef<Map<string, string>>(new Map());

  // Hydrate from localStorage if URL has no lid
  useEffect(() => {
    if (urlId) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('lid', stored);
        return next;
      }, { replace: true });
    }
  }, []); // eslint-disable-line

  // Persist to localStorage and load full processo
  useEffect(() => {
    if (urlId) localStorage.setItem(STORAGE_KEY, urlId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [urlId]);

  const fetchProcesso = useCallback(async (id: string | null) => {
    if (!id || !user) { setProcesso(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio, updated_at')
      .eq('id', id)  // sem user_id: processo é da empresa; RLS limita o acesso
      .maybeSingle();
    setLoading(false);
    if (error || !data) { setProcesso(null); return; }
    setProcesso(data as ProcessoAtivo);
  }, [user]);

  useEffect(() => { fetchProcesso(urlId); }, [urlId, fetchProcesso]);

  // Realtime: keep processo data fresh + react to status updates from other modules
  useEffect(() => {
    if (!urlId || !user) return;
    const channel = supabase
      .channel(`processo-ativo-${urlId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'licitacoes',
        filter: `id=eq.${urlId}`,
      }, () => { fetchProcesso(urlId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [urlId, user, fetchProcesso]);

  const applySwitch = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) next.set('lid', id);
      else next.delete('lid');
      return next;
    }, { replace: true });
    dirtyOwnersRef.current.clear();
  }, [setSearchParams]);

  const setProcessoId = useCallback((id: string | null, opts?: { force?: boolean }) => {
    if (id === urlId) return;
    if (opts?.force || dirtyOwnersRef.current.size === 0) {
      applySwitch(id);
      return;
    }
    setPendingSwitch({ id, owners: Array.from(dirtyOwnersRef.current.values()) });
  }, [urlId, applySwitch]);

  const registerDirty = useCallback((owner: DirtyOwner) => {
    dirtyOwnersRef.current.set(owner.id, owner.label);
    return () => { dirtyOwnersRef.current.delete(owner.id); };
  }, []);

  const refreshProcesso = useCallback(() => fetchProcesso(urlId), [urlId, fetchProcesso]);

  return (
    <ProcessoAtivoCtx.Provider value={{
      processoId: urlId,
      processo,
      loading,
      setProcessoId,
      refreshProcesso,
      registerDirty,
    }}>
      {children}
      <AlertDialog open={!!pendingSwitch} onOpenChange={(o) => { if (!o) setPendingSwitch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Existem dados em edição neste processo:
              <ul className="list-disc list-inside mt-2 text-sm">
                {pendingSwitch?.owners.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
              Deseja realmente trocar de processo? As alterações não salvas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSwitch(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingSwitch) applySwitch(pendingSwitch.id);
              setPendingSwitch(null);
            }}>Trocar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProcessoAtivoCtx.Provider>
  );
}

export function useProcessoAtivoContext() {
  const ctx = useContext(ProcessoAtivoCtx);
  if (!ctx) throw new Error('useProcessoAtivoContext must be used within ProcessoAtivoProvider');
  return ctx;
}
