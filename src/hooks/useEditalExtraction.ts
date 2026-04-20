import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isItemsLikelyMismatched } from '@/lib/licitacao-item-consistency';

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

type ExtractedItemPayload = {
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
};

const MIN_TEXT_LENGTH = 500;
const SINGLE_PASS_LIMIT = 120000;
const CHUNK_SIZE = 90000;
const CHUNK_OVERLAP = 5000;

function sanitizeExtractionText(text: string): string {
  return text.replace(/\u0000/g, '').replace(/\r/g, '').trim();
}

function buildExtractionChunks(text: string): string[] {
  const sanitized = sanitizeExtractionText(text);

  if (sanitized.length <= SINGLE_PASS_LIMIT) {
    return [sanitized.slice(0, SINGLE_PASS_LIMIT)];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < sanitized.length) {
    let end = Math.min(sanitized.length, start + CHUNK_SIZE);

    if (end < sanitized.length) {
      const breakIndex = sanitized.lastIndexOf('\n', end);
      if (breakIndex > start + Math.floor(CHUNK_SIZE * 0.65)) {
        end = breakIndex;
      }
    }

    const chunk = sanitized.slice(start, end).trim();
    if (chunk.length >= MIN_TEXT_LENGTH) {
      chunks.push(chunk);
    }

    if (end >= sanitized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function buildItemDedupKey(item: ExtractedItemPayload): string {
  return [
    String(item.item ?? ''),
    (item.descricao || '').toLowerCase().replace(/\s+/g, ' ').trim(),
    String(item.quantidade ?? ''),
    (item.unidade || '').toLowerCase().trim(),
  ].join('|');
}

export function useEditalExtraction() {
  const { user } = useAuth();

  const fetchItens = useCallback(async (licitacaoId: string): Promise<LicitacaoItem[]> => {
    if (!user) return [];
    const [{ data, error }, { data: licitacaoMeta, error: licitacaoError }] = await Promise.all([
      supabase
        .from('licitacao_itens')
        .select('*')
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id)
        .order('numero', { ascending: true }),
      supabase
        .from('licitacoes')
        .select('objeto')
        .eq('id', licitacaoId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (error) {
      console.error('Erro ao buscar itens:', error);
      return [];
    }

    if (licitacaoError) {
      console.error('Erro ao buscar metadados da licitação:', licitacaoError);
      return [];
    }

    const itens = (data as unknown as LicitacaoItem[]) || [];

    if (isItemsLikelyMismatched(licitacaoMeta?.objeto, itens.map((item) => item.descricao))) {
      console.warn('[useEditalExtraction] Itens incoerentes removidos automaticamente', {
        licitacaoId,
        totalItens: itens.length,
      });

      const { error: cleanupError } = await supabase
        .from('licitacao_itens')
        .delete()
        .eq('licitacao_id', licitacaoId)
        .eq('user_id', user.id);

      if (cleanupError) {
        console.error('Erro ao limpar itens incoerentes:', cleanupError);
      } else {
        toast.warning('Itens incompatíveis com este processo foram descartados. Faça uma nova extração do edital.');
      }

      return [];
    }

    return itens;
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

  const invokeExtraction = useCallback(async (
    textoEdital: string,
    skipMinLength = false,
    extraParams?: { pdf_base64?: string; pdf_url?: string; orgao_cnpj?: string; ano_compra?: number; sequencial?: number }
  ): Promise<ExtractedItemPayload[]> => {
    const { data, error } = await supabase.functions.invoke('extrair-itens-edital', {
      body: {
        texto_edital: textoEdital,
        skip_min_length: skipMinLength,
        ...extraParams,
      },
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'Não foi possível extrair itens do edital.');
    }

    return Array.isArray(data.data) ? (data.data as ExtractedItemPayload[]) : [];
  }, []);

  const extrairItensDoTexto = useCallback(async (
    fileText: string,
    opts?: { skipValidation?: boolean; pdf_base64?: string; pdf_url?: string; orgao_cnpj?: string; ano_compra?: number; sequencial?: number }
  ): Promise<ExtractedItemPayload[]> => {
    // Se PDF base64 ou URL disponível, enviar direto (sem chunking - Claude processa nativo)
    if (opts?.pdf_base64 || opts?.pdf_url) {
      try {
        const directItems = await invokeExtraction('', true, {
          pdf_base64: opts.pdf_base64,
          pdf_url: opts.pdf_url,
          orgao_cnpj: opts.orgao_cnpj,
          ano_compra: opts.ano_compra,
          sequencial: opts.sequencial,
        });
        if (directItems.length > 0) return directItems;
      } catch (e) {
        console.warn('[useEditalExtraction] PDF direto falhou, tentando texto:', e);
      }
    }

    const normalizedText = sanitizeExtractionText(fileText).replace(/\s+/g, ' ').trim();
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

    if (!opts?.skipValidation && (normalizedText.length < MIN_TEXT_LENGTH || markerHits < 2)) {
      toast.error('Não há texto real suficiente do edital para extrair itens com fidelidade. Tente enviar o edital em formato PDF ou DOC.');
      return [];
    }

    const chunks = buildExtractionChunks(fileText);
    const extractedItems: ExtractedItemPayload[] = [];
    let hasProcessedChunk = false;

    for (const chunk of chunks) {
      try {
        const chunkItems = await invokeExtraction(chunk, !!opts?.skipValidation);
        hasProcessedChunk = true;
        if (chunkItems.length > 0) {
          extractedItems.push(...chunkItems);
        }
      } catch (error) {
        console.error('Erro ao extrair chunk do edital:', error);
      }
    }

    if (!hasProcessedChunk) {
      toast.error('Não foi possível extrair itens do edital.');
      return [];
    }

    const seen = new Set<string>();
    const parsed = extractedItems.filter((item) => {
      const descricao = (item.descricao || '').trim();
      if (!descricao) return false;
      const key = buildItemDedupKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (parsed.length === 0) {
      toast.warning('Nenhum item encontrado no documento.');
      return [];
    }

    return parsed;
  }, [invokeExtraction]);

  const extrairItensIA = useCallback(async (
    licitacaoId: string,
    fileText: string,
    opts?: { forceReExtract?: boolean; skipValidation?: boolean }
  ): Promise<LicitacaoItem[]> => {
    if (!user) return [];

    if (!opts?.forceReExtract) {
      const existing = await fetchItens(licitacaoId);
      if (existing.length > 0) return existing;
    } else {
      await deleteAllItens(licitacaoId);
    }

    const parsed = await extrairItensDoTexto(fileText, { skipValidation: opts?.skipValidation });
    if (parsed.length === 0) return [];

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
  }, [user, fetchItens, saveItensManual, deleteAllItens, extrairItensDoTexto]);

  return {
    fetchItens,
    saveItensManual,
    updateItem,
    deleteItem,
    deleteLote,
    deleteAllItens,
    extrairItensDoTexto,
    extrairItensIA,
  };
}
