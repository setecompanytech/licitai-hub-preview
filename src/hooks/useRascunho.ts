import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Modulo = 'proposta' | 'precificacao';

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
  const initialLoadDone = useRef(false);

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

  // Save (upsert) draft
  const saveRascunho = useCallback(async (dados: T, titulo?: string) => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      modulo,
      licitacao_id: licitacaoId || null,
      dados: dados as any,
      titulo: titulo || null,
    };

    if (rascunhoId) {
      const { error } = await supabase
        .from('rascunhos')
        .update({ dados: dados as any, titulo: titulo || null })
        .eq('id', rascunhoId);
      if (error) console.error('Erro ao salvar rascunho:', error);
      else setLastSaved(new Date());
    } else {
      const { data, error } = await supabase
        .from('rascunhos')
        .upsert(payload, { onConflict: 'user_id,modulo,licitacao_id' })
        .select('id')
        .maybeSingle();
      if (error) {
        // Fallback: try insert
        const { data: insertData, error: insertErr } = await supabase
          .from('rascunhos')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (insertErr) console.error('Erro ao criar rascunho:', insertErr);
        else if (insertData) {
          setRascunhoId(insertData.id);
          setLastSaved(new Date());
        }
      } else if (data) {
        setRascunhoId(data.id);
        setLastSaved(new Date());
      }
    }

    setSaving(false);
    dataRef.current = dados;
  }, [user, modulo, licitacaoId, rascunhoId]);

  // Debounced auto-save
  const autoSave = useCallback((dados: T, titulo?: string) => {
    if (!user || !initialLoadDone.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveRascunho(dados, titulo);
    }, debounceMs);
  }, [saveRascunho, debounceMs, user]);

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
    deleteRascunho,
    listRascunhos,
    markLoaded,
    saving,
    lastSaved,
    loaded,
    rascunhoId,
  };
}
