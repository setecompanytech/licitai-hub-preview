import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Modulo = 'proposta' | 'precificacao' | 'precificacao_planilha';

interface UseRascunhoOptions {
  modulo: Modulo;
  licitacaoId?: string | null;
  debounceMs?: number;
}

interface RascunhoMeta {
  id: string;
  titulo: string | null;
  updated_at: string;
}

export function useRascunho<T extends Record<string, any>>({
  modulo,
  licitacaoId = null,
  debounceMs = 2000,
}: UseRascunhoOptions) {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<T | null>(null);
  const tituloRef = useRef<string | undefined>(undefined);
  const initialLoadDone = useRef(false);
  const [pending, setPending] = useState(false);

  // Load draft on mount or when licitacaoId changes
  const loadRascunho = useCallback(async (): Promise<T | null> => {
    if (!user) return null;

    let query = supabase
      .from('rascunhos')
      .select('*')
      .eq('user_id', user.id)
      .eq('modulo', modulo);

    if (licitacaoId) {
      query = query.eq('licitacao_id', licitacaoId);
    } else {
      query = query.is('licitacao_id', null);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('Erro ao carregar rascunho:', error);
      return null;
    }

    if (data) {
      setRascunhoId(data.id);
      setLastSaved(new Date(data.updated_at));
      const dados = data.dados as T;
      dataRef.current = dados;
      return dados;
    }
    return null;
  }, [user, modulo, licitacaoId]);

  // Save draft — find-then-update/insert to avoid onConflict issues with functional unique index
  const saveRascunho = useCallback(async (dados: T, titulo?: string) => {
    if (!user) return;
    setSaving(true);

    try {
      if (rascunhoId) {
        const { error } = await supabase
          .from('rascunhos')
          .update({ dados: dados as any, titulo: titulo || null })
          .eq('id', rascunhoId);
        if (error) console.error('Erro ao salvar rascunho:', error);
        else setLastSaved(new Date());
      } else {
        // Find existing before inserting (unique index uses COALESCE, can't use onConflict)
        let findQuery = supabase
          .from('rascunhos')
          .select('id')
          .eq('user_id', user.id)
          .eq('modulo', modulo);
        if (licitacaoId) findQuery = findQuery.eq('licitacao_id', licitacaoId);
        else findQuery = findQuery.is('licitacao_id', null);

        const { data: existing } = await findQuery.maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from('rascunhos')
            .update({ dados: dados as any, titulo: titulo || null })
            .eq('id', existing.id);
          if (error) console.error('Erro ao atualizar rascunho:', error);
          else {
            setRascunhoId(existing.id);
            setLastSaved(new Date());
          }
        } else {
          const { data: newData, error } = await supabase
            .from('rascunhos')
            .insert({ user_id: user.id, modulo, licitacao_id: licitacaoId || null, dados: dados as any, titulo: titulo || null })
            .select('id')
            .maybeSingle();
          if (error) console.error('Erro ao criar rascunho:', error);
          else if (newData) {
            setRascunhoId(newData.id);
            setLastSaved(new Date());
          }
        }
      }
    } finally {
      setSaving(false);
      dataRef.current = dados;
      setPending(false);
    }
  }, [user, modulo, licitacaoId, rascunhoId]);

  // Debounced auto-save
  const autoSave = useCallback((dados: T, titulo?: string) => {
    if (!user || !initialLoadDone.current) return;
    dataRef.current = dados;
    tituloRef.current = titulo;
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveRascunho(dados, titulo);
    }, debounceMs);
  }, [saveRascunho, debounceMs, user]);

  // Flush immediately (cancel debounce and persist now)
  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (dataRef.current && initialLoadDone.current) {
      await saveRascunho(dataRef.current, tituloRef.current);
    }
  }, [saveRascunho]);

  // Warn on tab close while there's pending unsaved data
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!pending) return;
      // Best-effort sync persistence (debounced changes ainda não enviadas)
      try { void flush(); } catch {}
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pending, flush]);


  // Delete draft
  const deleteRascunho = useCallback(async () => {
    if (!rascunhoId) return;
    await supabase.from('rascunhos').delete().eq('id', rascunhoId);
    setRascunhoId(null);
    setLastSaved(null);
    dataRef.current = null;
    toast.success('Rascunho excluído.');
  }, [rascunhoId]);

  // List all drafts for a module
  const listRascunhos = useCallback(async (): Promise<RascunhoMeta[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('rascunhos')
      .select('id, titulo, updated_at')
      .eq('user_id', user.id)
      .eq('modulo', modulo)
      .order('updated_at', { ascending: false });
    return (data || []) as RascunhoMeta[];
  }, [user, modulo]);

  // Mark initial load done
  const markLoaded = useCallback(() => {
    initialLoadDone.current = true;
    setLoaded(true);
  }, []);

  // Reset state when licitacaoId changes
  useEffect(() => {
    setRascunhoId(null);
    setLastSaved(null);
    dataRef.current = null;
    initialLoadDone.current = false;
    setLoaded(false);
  }, [licitacaoId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    loadRascunho,
    saveRascunho,
    autoSave,
    flush,
    deleteRascunho,
    listRascunhos,
    markLoaded,
    saving,
    lastSaved,
    loaded,
    pending,
    rascunhoId,
  };
}
