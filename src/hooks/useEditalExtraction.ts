import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


export interface LicitacaoItem {
  id: string;
  licitacao_id: string;
  user_id: string;
  numero: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  lote: string;
  marca: string | null;
  fabricante: string | null;
  modelo: string | null;
  origem: string;
  created_at: string;
  updated_at: string;
}

export type LicitacaoItemInsert = Omit<LicitacaoItem, 'id' | 'created_at' | 'updated_at'>;

export function useEditalExtraction() {
  const { user } = useAuth();

  const fetchItens = useCallback(async (licitacaoId: string): Promise<LicitacaoItem[]> => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('licitacao_itens')
      .select('*')
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id)
      .order('numero', { ascending: true });
    if (error) {
      console.error('Erro ao buscar itens:', error);
      return [];
    }
    return (data as unknown as LicitacaoItem[]) || [];
  }, [user]);

  const saveItensManual = useCallback(async (
    licitacaoId: string,
    itens: Partial<LicitacaoItemInsert>[]
  ): Promise<LicitacaoItem[]> => {
    if (!user) return [];

    const rows = itens.map((item, idx) => ({
      licitacao_id: licitacaoId,
      user_id: user.id,
      numero: item.numero ?? idx + 1,
      descricao: item.descricao || '',
      quantidade: item.quantidade ?? 1,
      unidade: item.unidade || 'UN',
      valor_unitario: item.valor_unitario ?? 0,
      valor_total: item.valor_total ?? 0,
      lote: item.lote || 'Único',
      marca: item.marca || null,
      fabricante: item.fabricante || null,
      modelo: item.modelo || null,
      origem: item.origem || 'manual',
    }));

    const { data, error } = await supabase
      .from('licitacao_itens')
      .insert(rows)
      .select();

    if (error) {
      console.error('Erro ao salvar itens:', error);
      toast.error('Erro ao salvar itens.');
      return [];
    }
    return (data as unknown as LicitacaoItem[]) || [];
  }, [user]);

  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<LicitacaoItemInsert>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('licitacao_itens')
      .update(updates as any)
      .eq('id', itemId);
    if (error) {
      console.error('Erro ao atualizar item:', error);
      return false;
    }
    return true;
  }, []);

  const deleteItem = useCallback(async (itemId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('licitacao_itens')
      .delete()
      .eq('id', itemId);
    if (error) {
      console.error('Erro ao excluir item:', error);
      return false;
    }
    return true;
  }, []);

  const deleteLote = useCallback(async (licitacaoId: string, lote: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('licitacao_itens')
      .delete()
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id)
      .eq('lote', lote);
    if (error) {
      console.error('Erro ao excluir lote:', error);
      return false;
    }
    return true;
  }, [user]);

  const deleteAllItens = useCallback(async (licitacaoId: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('licitacao_itens')
      .delete()
      .eq('licitacao_id', licitacaoId)
      .eq('user_id', user.id);
    if (error) {
      console.error('Erro ao excluir itens:', error);
      return false;
    }
    return true;
  }, [user]);

  const extrairItensIA = useCallback(async (
    licitacaoId: string,
    fileText: string,
    opts?: { forceReExtract?: boolean }
  ): Promise<LicitacaoItem[]> => {
    if (!user) return [];

    if (!opts?.forceReExtract) {
      const existing = await fetchItens(licitacaoId);
      if (existing.length > 0) return existing;
    } else {
      await deleteAllItens(licitacaoId);
    }

    const normalizedText = fileText.replace(/\s+/g, ' ').trim();
    const lowerText = normalizedText.toLowerCase();
    const extractionMarkers = [
      'item',
      'lote',
      'quantidade',
      'unidade',
      'descrição',
      'descricao',
      'termo de referência',
      'termo de referencia',
      'especificação',
      'especificacao',
      'planilha',
      'anexo',
    ];
    const markerHits = extractionMarkers.filter((marker) => lowerText.includes(marker)).length;

    if (normalizedText.length < 500 || markerHits < 2) {
      toast.error('Não há texto real suficiente do edital para extrair itens com fidelidade.');
      return [];
    }

    const truncated = fileText.slice(0, 120000);

    const { data, error } = await supabase.functions.invoke('extrair-itens-edital', {
      body: { texto_edital: truncated },
    });

    if (error || !data?.success) {
      console.error('Erro ao extrair itens do edital:', error || data);
      toast.error(data?.error || 'Não foi possível extrair itens do edital.');
      return [];
    }

    const parsed = (Array.isArray(data.data) ? data.data : []) as Array<{
      item?: string | number;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valor_unitario?: number;
      valor_total?: number;
      lote?: string;
      marca?: string;
      fabricante?: string;
      modelo?: string;
    }>;

    if (parsed.length === 0) {
      toast.warning('Nenhum item encontrado no documento.');
      return [];
    }

    const itemsToSave: Partial<LicitacaoItemInsert>[] = parsed.map((p, idx) => ({
      numero: parseInt(String(p.item ?? idx + 1), 10) || (idx + 1),
      descricao: p.descricao || '',
      quantidade: p.quantidade || 1,
      unidade: p.unidade || 'UN',
      valor_unitario: p.valor_unitario || 0,
      valor_total: p.valor_total || (p.valor_unitario || 0) * (p.quantidade || 1),
      lote: p.lote || 'Único',
      marca: p.marca || null,
      fabricante: p.fabricante || null,
      modelo: p.modelo || null,
      origem: 'ia',
    }));

    const saved = await saveItensManual(licitacaoId, itemsToSave);
    toast.success(`${saved.length} itens extraídos e salvos!`);
    return saved;
  }, [user, fetchItens, saveItensManual, deleteAllItens]);

  return {
    fetchItens,
    saveItensManual,
    updateItem,
    deleteItem,
    deleteLote,
    deleteAllItens,
    extrairItensIA,
  };
}
