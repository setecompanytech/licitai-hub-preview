import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
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
  const location = useLocation();
  const urlId = searchParams.get('lid');
  const [processo, setProcesso] = useState<ProcessoAtivo | null>(null);
  const [loading, setLoading] = useState(false);

  // Pending switch (waiting for user confirmation due to dirty state)
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string | null; owners: string[] } | null>(null);
  const dirtyOwnersRef = useRef<Map<string, string>>(new Map());
  // Marca uma desvinculação pedida pelo usuário, para a reidratação não
  // ressuscitar o processo que ele acabou de soltar.
  const limpezaExplicitaRef = useRef(false);

  // O rastreio de rotas passou para RegistroDeRota, no roteador: agora existe
  // um histórico só, e a seta da pasta usa o mesmo Voltar do resto do sistema.

  // Reidrata o processo ativo SEMPRE que a URL ficar sem `lid` — não só na
  // montagem. O provider é global e não remonta na navegação interna: ir para
  // outro módulo pelo menu (URL sem ?lid=) deixava a barra dizendo "Nenhum
  // processo vinculado" mesmo com o processo em memória.
  useEffect(() => {
    if (urlId) return;
    // Limpeza explícita (usuário desvinculou) não deve ser desfeita.
    if (limpezaExplicitaRef.current) { limpezaExplicitaRef.current = false; return; }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('lid', stored);
        return next;
      }, { replace: true });
    }
  }, [urlId, setSearchParams]);

  // Persiste o processo ativo. Ausência de `lid` na URL NÃO apaga a memória:
  // navegar para uma tela sem o parâmetro chegava a apagar o processo ativo do
  // localStorage, e nem recarregar a página o trazia de volta. Quem apaga é a
  // desvinculação explícita (applySwitch(null)).
  useEffect(() => {
    if (urlId) localStorage.setItem(STORAGE_KEY, urlId);
  }, [urlId]);

  const { empresaAtiva } = useEmpresa();

  // Trocar de empresa limpa a seleção persistida: o processo ativo fica no
  // localStorage e sobrevivia à troca — quem mudava para a ETHOS continuava
  // com um processo da outra empresa selecionado na barra global.
  useEffect(() => {
    const donoDoProcesso = (processo as { empresa_id?: string | null } | null)?.empresa_id;
    if (empresaAtiva?.id && donoDoProcesso && donoDoProcesso !== empresaAtiva.id) {
      applySwitch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaAtiva?.id, processo]);

  const fetchProcesso = useCallback(async (id: string | null) => {
    if (!id || !user) { setProcesso(null); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('licitacoes')
      .select('id, numero, orgao, objeto, modalidade, status, valor_estimado, data_encerramento, uf, municipio, updated_at, empresa_id')
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
    if (!id) {
      // Desvinculação explícita: some da URL, da memória e do armazenamento.
      limpezaExplicitaRef.current = true;
      localStorage.removeItem(STORAGE_KEY);
    }
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
