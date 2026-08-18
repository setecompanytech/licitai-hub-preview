import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { usaProcessoAtivo } from '@/lib/navegacao/rotasDoProcesso';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';


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
  // O processo ativo vem SÓ da URL, e a URL só o carrega quando a pessoa veio
  // da pasta. Por decisão do dono do produto: quem administra dezenas de
  // certames não quer que um vínculo o siga pelos módulos — é assim que
  // documento de um processo vai parar na pasta de outro, e o erro só aparece
  // depois, no envio ao órgão.
  //
  // Antes o vínculo era reidratado da memória local a cada tela, e por isso
  // reaparecia ao entrar num módulo pelo menu, horas depois, sem ninguém pedir.
  const processoId = urlId;
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

  // Tela que não usa o processo tampouco carrega o parâmetro: um `lid` que
  // sobrou de uma URL colada não deve vincular nada por acidente.
  useEffect(() => {
    if (!urlId || usaProcessoAtivo(location.pathname)) return;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('lid');
      return next;
    }, { replace: true });
  }, [urlId, location.pathname, setSearchParams]);

  // Sem memória entre telas, de propósito: o vínculo dura o percurso, não o dia.

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

  useEffect(() => { fetchProcesso(processoId); }, [processoId, fetchProcesso]);

  // Realtime: keep processo data fresh + react to status updates from other modules
  useEffect(() => {
    if (!processoId || !user) return;
    const channel = supabase
      .channel(`processo-ativo-${processoId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'licitacoes',
        filter: `id=eq.${processoId}`,
      }, () => { fetchProcesso(processoId); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [processoId, user, fetchProcesso]);

  const applySwitch = useCallback((id: string | null) => {
    if (!id) limpezaExplicitaRef.current = true;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      // Vincular a partir de uma tela que não usa o processo (o Kanban, por
      // exemplo) guarda em memória sem sujar o endereço.
      if (id && usaProcessoAtivo(location.pathname)) next.set('lid', id);
      else next.delete('lid');
      return next;
    }, { replace: true });
    dirtyOwnersRef.current.clear();
  }, [setSearchParams, location.pathname]);

  const setProcessoId = useCallback((id: string | null, opts?: { force?: boolean }) => {
    if (id === processoId) return;
    if (opts?.force || dirtyOwnersRef.current.size === 0) {
      applySwitch(id);
      return;
    }
    setPendingSwitch({ id, owners: Array.from(dirtyOwnersRef.current.values()) });
  }, [processoId, applySwitch]);

  const registerDirty = useCallback((owner: DirtyOwner) => {
    dirtyOwnersRef.current.set(owner.id, owner.label);
    return () => { dirtyOwnersRef.current.delete(owner.id); };
  }, []);

  const refreshProcesso = useCallback(() => fetchProcesso(processoId), [processoId, fetchProcesso]);

  return (
    <ProcessoAtivoCtx.Provider value={{
      processoId,
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
