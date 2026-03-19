import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { streamAIChat } from '@/lib/ai-stream';

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

    // Check if items already exist
    if (!opts?.forceReExtract) {
      const existing = await fetchItens(licitacaoId);
      if (existing.length > 0) return existing;
    } else {
      await deleteAllItens(licitacaoId);
    }

    // Use up to 80K chars to capture large item lists (110+ items)
    const truncated = fileText.slice(0, 80000);

    return new Promise((resolve) => {
      let content = '';

      streamAIChat({
        messages: [{
          role: 'user',
          content: `Você é um extrator de dados de editais de licitação. Analise o texto REAL abaixo e extraia TODOS os itens/lotes com valores de referência.

REGRA FUNDAMENTAL: Extraia SOMENTE os itens que REALMENTE existem no texto. NÃO invente, NÃO suponha, NÃO adivinhe. Extraia TODOS os itens — não pare antes de chegar ao último.

Retorne APENAS um JSON array, sem markdown, sem explicações:
[
  {"item": "1", "descricao": "descrição FIEL ao documento", "quantidade": 10, "unidade": "UN", "valor_unitario": 150.00, "valor_total": 1500.00, "lote": "Lote 1", "marca": "", "fabricante": "", "modelo": ""}
]

REGRAS:
- Copie descrições FIELMENTE do documento, na MESMA ORDEM em que aparecem
- "item" = número do item EXATO conforme edital (não reordene alfabeticamente)
- "quantidade" e "unidade" EXATOS conforme o edital
- "valor_unitario" e "valor_total" EXATOS se mencionados, senão use 0
- "lote" conforme edital; se não houver lotes, use "Único"
- NÃO substitua por produtos diferentes do que está escrito
- NÃO reordene os itens — mantenha a sequência original do documento
- NÃO pare a extração no meio — extraia do primeiro ao último item
- Retorne [] se não encontrar itens

DOCUMENTO:
${truncated}`
        }],
        action: 'analise_edital',
        onDelta: (chunk) => { content += chunk; },
        onDone: async () => {
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
              toast.error('Não foi possível extrair itens do edital.');
              resolve([]);
              return;
            }
            const parsed = JSON.parse(jsonMatch[0]) as Array<{
              item: string;
              descricao: string;
              quantidade: number;
              unidade: string;
              valor_unitario: number;
              valor_total: number;
              lote?: string;
              marca?: string;
              fabricante?: string;
              modelo?: string;
            }>;

            if (parsed.length === 0) {
              toast.warning('Nenhum item encontrado no documento.');
              resolve([]);
              return;
            }

            const itemsToSave: Partial<LicitacaoItemInsert>[] = parsed.map((p, idx) => ({
              numero: parseInt(p.item) || (idx + 1),
              descricao: p.descricao,
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
            resolve(saved);
          } catch {
            toast.error('Erro ao processar itens do edital.');
            resolve([]);
          }
        },
        onError: (err) => {
          toast.error(err);
          resolve([]);
        },
      });
    });
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
